# Lexx 修复计划（2026-10）

## 0. 需求基线（评审结论摘要 = 本计划的验收前提）

2026-10 整体代码评审确认了以下缺陷，本计划的目标是按批次消除其中 P0/P1 项：

- **数据丢失路径（P0）**：① `task-list-input.ts:67-70` 在已有 bullet list 中输入 `[ ] `/`[x] ` 会用仅含当前项的新 taskList 替换整个 bulletList，同级列表项被销毁；② `source-editor.ts:46-50` CodeMirror `setContent` 进撤销历史，进入源码模式后按一次 Cmd+Z 文档清空 → onChange → autosave 把空内容写盘；③ `App.vue:710` `if (md)` 把空串当无内容，源码模式清空全文后退出被静默回滚；④ `App.vue:520` autosave 失败 `catch {}` 静默 + `file_io.rs:59` 非原子 `fs::write`；⑤ `fix-content-parsing.ts:51-91` 覆写的 `setContent` 丢弃 `emitUpdate` 参数，`setContent(md, false)` 仍触发 update → dirty → autosave。
- **死功能（P1）**：`capabilities/default.json` 无 `updater:default`/`process:allow-restart`（自动更新 ACL 被拒）；`windows: ["main"]` 使 `ws-*`/`file-*` 新窗口无任何 capability（新窗口功能空壳）。
- **安全收敛（P1）**：`mermaid-block.ts:65` KaTeX `trust: true`；`temp.rs:20` `temp_dir.join(&filename)` 路径遍历；`temp.rs:61` `delete_temp_file` 用 `contains("temp")` 子串匹配做防护；`Cargo.toml` release 启用 devtools。
- **UI bug 群（P1）**：`StatusBar.vue:36-46` 字数不随编辑刷新；`App.vue:581` 源码模式切 tab 未传 emitUpdate=false；`App.vue:857-867` 打开文件去重在 await 之前（竞态双开）；`App.vue:613-623` 关后台 tab 抢走活跃视图；`SidebarTree.vue:44-51` 不响应 rootPath 变化；`App.vue:1013-1022` 关窗时保存失败仍 destroy；多个 Untitled 共用一个 temp 文件、Discard 后 temp 不删。
- **导出（P1）**：`docx.ts:431-477` walk 无 img 分支（DOCX 丢全部图片）；`pdf.ts:26-36` 整篇单 canvas（超限导出全白 PDF 且无报错）。
- **卫生（P2/P3）**：CI 无 npm test/cargo test/clippy 且用 npm install；死代码（`FileError`+thiserror、`serde_json`、`ToolbarButton.vue`、`Sidebar.vue rootName`）；`lexx-image.ts` 序列化器不转义；`utils.ts:64-71` base64 逐字节拼接。

## 1. 目标与范围

**目标**：消除上述 P0/P1，交付可验证的修复；App.vue 拆分到可维护结构。

**不做（明确出界）**：assetProtocol scope 保持 `"**"`（编辑器打开任意路径文件是核心场景，收敛会破坏功能；以入口加固降低触发面，风险记录于 §6）；single-instance 插件；Linux 文件关联；全文搜索；AI 相关一切。这些记入 roadmap 另行决策。

## 2. 第一批：数据丢失 + 死功能（P0，最小 diff，先行合入）

每项一个独立 commit，便于单独 revert。

### 2.1 task-list 输入规则
- 修法：`task-list-input.ts` 的 `replaceWith` 范围从整个 bulletList 改为仅替换当前 listItem，并把其余兄弟 listItem 一并转换后组合成完整 taskList（保持顺序与各兄弟自身内容）。
- 验收：3 项 bullet list 中在第 2 项输入 `[x] ` → 3 项全部保留且 1/3 项转为未勾选 task item、第 2 项勾选、光标在第 2 项内。
- 测试：新增单测（多兄弟、单项目、嵌套 bulletList 三用例），先写失败用例再修（红→绿）。

### 2.2 CodeMirror setContent 隔离历史（重建 state 方案）
- 修法：~~isolateHistory~~（只重置合并计时，不阻止入历史栈）~~addToHistory annotation~~（仅防本次入栈，不清旧栈）**均不采用**——sourceEditor 是跨文件复用的单例（懒创建一次，switchToFile 反复 setContent 装载不同文件），旧文件的 undo 记录仍在栈内，切 tab 后 Cmd+Z 会把前一文件内容写进当前文件。主方案：**setContent 改为 `view.setState(EditorState.create(...))` 整体重建**（已核实 @codemirror/view setState 走重建路径、不经事务分发），state 的 extensions 列表抽成单一 factory 复用；重建即清空 undo 栈，语义 = "每次进入源码模式都是新编辑会话"。防御性兜底：setContent 期间置内部标志，过滤 updateListener 的首次回调（若 setState 实现确实不触发 listener 则该标志为无害冗余）。
- 验收：① 进入源码模式后立即 Cmd+Z：文档内容不变；② 源码模式编辑 → 切 tab → 切回 → Cmd+Z：不得出现前一文件的内容（undo 栈已空）；③ setContent 不触发 onChange。
- 测试：source-editor.test.ts 增加 ①②③ 三用例。**既有用例 `fires onChange when content changes`（source-editor.test.ts:57-63）断言 setContent 触发 onChange，与新行为冲突，需改写**为通过 `view.dispatch({changes})` 模拟真实编辑触发（保留原意）或删除由新用例③替代——此为计划内测试变更，不违反 §8"现有测试全绿"门槛。

### 2.3 空串判断修正
- 修法：`App.vue:710` 改为 `if (md !== null)`；同步检查 `switchToFile`/`performAutoSave` 同类路径的空串处理。
- 验收：源码模式清空全文 → 退出 → PM 为空文档；autosave 落盘为空文件（与用户意图一致）。
- 测试：手动 smoke；如有可提取的纯函数则加单测。

### 2.4 FixContentParsing 尊重 emitUpdate
- 修法（已核实 @tiptap/core 2.10 源码）：core 的 `setContent` 在委托 `insertContentAt` 前会执行 `tr.setMeta('preventUpdate', !emitUpdate)`，update 事件据该 meta 抑制；`FixContentParsing` 覆写后丢失了这一步。修法 = 在 `fix-content-parsing.ts` 两个分支委托 `insertContentAt` 前补 `props.tr.setMeta('preventUpdate', !emitUpdate)`，照抄 core 机制，不引入自定义 meta、不改 App.vue 监听器。
- 影响面（行为变化点）：`App.vue:504`（performAutoSave 同步）、`App.vue:637`（handleSave 同步）、`App.vue:581`（switchToFile 同步，现为单参调用）——三者均属 CM→PM 内部同步、非用户编辑，统一显式传 `emitUpdate=false`；修复后它们不再误触发 update/dirty，与 tiptap 原生语义一致。`App.vue:712`（toggleSourceMode 退出）已显式传 false，修复后语义首次生效。
- 验收：① `setContent(md, false)` 不触发 update、不置 dirty；② `setContent(md)`（core 默认 emitUpdate=false）同样不触发；③ 上述三个同步调用点在源码模式往返后不置 dirty、不产生新的 autosave 调度；④ 写盘成功后 `dirty=false`。
- 测试：单测断言 ①②；③④ 归入附录 A smoke 第 3/4 条。

### 2.5 capabilities 修复（死功能复活）
- 修法：`capabilities/default.json` 补 `updater:default`、`process:allow-restart`；新增 capability 条目（或扩展现有 windows 数组）覆盖 `ws-*`/`file-*`，授予以 `core:default` + `dialog:default` + 事件/窗口所需最小集，**并包含 `updater:default`**（新窗口加载同一前端，onMounted 无条件 checkForUpdate，缺权限则 dev 日志仍报 ACL 拒绝）。
- 验收：`npm run tauri:dev` 下：① 打开文件夹新窗口能 fileRead 并显示内容、窗口标题正确；② 主窗口与新窗口**分别**核对 dev 日志，检查更新不再报 ACL 拒绝。
- 测试：手动验证 + 在计划执行报告中附验证日志摘录。

### 2.6 autosave 原子写 + 失败可见
- 修法：`file_io.rs` 的 `file_write`/`file_write_binary` 改**同目录** `.<name>.tmp` 写入 + `fs::rename` 原子替换（同目录保证同卷原子性；rename 失败删除残留 temp）；**仅 performAutoSave 的空 catch（App.vue:520-522）**改为 toast（沿用现有英文 toast 约定，如 `Auto-save failed`；handleSave 的 catch 已有 'Save failed' toast，不动）；**performAutoSave 改为返回 boolean（写盘成功才置 `dirty=false`）**，`App.vue:1013-1022` 关窗流程据返回值决定：保存失败 → 不 destroy，弹确认（复用 confirmUnsaved 风格），用户确认后才 destroy——否则调用方拿不到成败信号，仍会无条件 destroy。
- 验收：① 构造 autosave 写失败（文件**所在目录只读**，或 rename 目标被目录占用——注意 rename 不检查目标文件自身权限，"只读文件"不构成失败场景）→ 出 toast、原文件不损坏；② 正常路径行为不变；③ 关窗时写失败有确认而不是静默丢。
- 测试：Rust 侧 temp+rename 单测——`fs::rename` 无法直接 mock，改为封装接受目标路径的内部函数并构造真实失败场景（同验收①：目标目录只读 / rename 目标被目录占用），断言失败时原文件内容完整不变；前端 toast 路径手动验证。

### 2.7 Untitled 临时文件
- 修法：`createFileSlot` 未命名文件用唯一名（**uuid 或毫秒时间戳前缀**，跨窗口唯一——`idCounter` 是每窗口计数器，temp 目录 app 级共享，`Untitled-<id>` 在双窗口下会互相覆盖）；slot 记录 `tempSave` 返回的完整 temp 路径（现被丢弃，App.vue:517）供清理使用；`closeFile` 的 Discard 分支调用 `deleteTempFile` 清理对应 temp；**handleSave 另存为成功（slot.filePath 从 null 变为有值）后同步 `deleteTempFile` 清理该 slot 的 temp**，否则另存后 dirty=false 不走 Discard 分支，temp 残留导致下次启动对陈旧副本弹恢复提示。
- 验收：开两个未命名文档各写内容 → 崩溃恢复能救回两个；Discard 后下次启动不再推销。
- 测试：Rust temp 测试补唯一名用例；前端流程手动验证。

## 3. 第二批：安全收敛（P1）

### 3.1 KaTeX trust 白名单
- 修法：`mermaid-block.ts:65` `trust: true` 改为回调白名单：默认 false，仅放行显式需要的命令（首版直接 `trust: false`，若现有文档用到 `\href` 再按 `[context.command === '\\href' && url 以 http(s)/mailto 开头]` 放行）。
- 验收：含 `\href{javascript:alert(1)}{x}` 的 md 渲染不产出 javascript: 链接；正常数学公式渲染不变。
- 测试：mermaid-block.test.ts 增加恶意 payload 用例（javascript: href、\includegraphics、\htmlClass）。

### 3.2 temp 命令路径清洗
- 修法：`temp.rs` `temp_save` 拒绝含路径分隔符/`..`/绝对路径的 filename（返回 Err）；`delete_temp_file` 签名增加 `app: tauri::AppHandle` 以取得 temp 根（前端调用点仍传完整 path，无需改）；对**两侧路径均做 canonicalize**（如测试用 `std::env::temp_dir()` 在 macOS 解析为 `/var/folders/...` 而 canonicalize 后为 `/private/var/...`，只归一输入侧会造成永假拒绝）后校验必须位于 temp 目录前缀内；canonicalize 失败且路径不存在时直接返回 Ok（兼容既有 `delete_temp_file_nonexistent_is_ok` 语义）；删除 `contains("temp")` 判断，并**修正将该弱校验固化为预期的既有测试**。
- 验收（行为断言）：① `temp_save("../../x")` 返回错误；② temp 目录外的**存在**文件路径 `delete_temp_file` 返回 Err 且**目标文件不被删除**；③ 不存在的路径返回 Ok（文件自然也未被删除）。校验逻辑抽成不依赖 AppHandle 的纯函数便于单测（签名加 AppHandle 后直接单测需 `tauri::test::mock_app`，优先纯函数方案）。
- 测试：Rust 单测覆盖遍历拒绝用例。

### 3.3 devtools 门控
- 修法：release 构建不启用 devtools（实现时按 Tauri 2 机制选型：Cargo feature 拆分或 `cfg(debug_assertions)` 动态启用，倾向最小 diff 方案）。
- 验收：`tauri build` 产物无 devtools（右键无检查菜单）；`tauri dev` 保留。

### 3.4 accepted risk 记录
- assetProtocol `"**"` 保留，理由与缓解措施（入口已加固、CSP 不动）写入 `docs/current-status.md` 的风险小节。

## 4. 第三批：App.vue 拆分 + UI bug 群（P1）

拆分与 bug 修复同批进行（bug 多为耦合症状）。拆分按现有行为平移，不改行为；bug 修复列明如下：

| Bug | 修法 | 验收 |
|---|---|---|
| StatusBar 计数停滞 | 改为由父组件在 editor update 事件里传入计数（或传入响应式版本号），computed 消费 | 输入时字数实时变化 |
| `App.vue:581` 切 tab 标脏 | **已由 2.4 完成（第一批）**，本批仅作回归验证 | 源码模式切 tab 不置 dirty、不触发 autosave |
| 打开文件竞态双开 | 去重检查移到 `await fileRead` 之后、`createFileSlot` 之前 | 快速双击树节点只开一个 slot |
| 关后台 tab 抢焦点 | 仅当关闭的是 activeFile 时才 switchToFile | 关后台 tab 视图不动 |
| SidebarTree 不刷新 | 增加 `watch(() => props.rootPath)` 重新 loadRoot | 重新 Open Folder 后树更新 |
| Untitled temp（已在 2.7） | — | — |

**拆分结构**（composables，App.vue 目标 <300 行）：`useFileSlots`（slot/editor 生命周期，editor 创建移出模板 ref 回调）、`useAutoSave`（计时器+写盘+失败上报）、`useSourceMode`（CM↔PM 同步收敛、统一 emitUpdate 语义）、`useQuickOpen`（扫描/token 原样搬）、`useShortcuts`（合并两套 keydown 分发 + menu-event handler map 去重）。

- 回归保障：**commit 编排**——先合入上表 bug 修复（每项独立 commit），再做纯拆分 commit 序列（拆分 commit 不夹带行为变更），保证"拆分引入回归 → revert 拆分序列"不会连带回滚 bug 修复；现有 65 前端测试 + cargo test 全绿为硬门槛；手动 smoke 清单（附录 A）执行通过。
- 组件测试：StatusBar（计数随 update 事件刷新）与 SidebarTree（rootPath 变化触发 loadRoot）补组件级单测，复用现有 vitest + @vue/test-utils 基建；竞态双开如无法组件级模拟则保持 smoke 覆盖并在代码注释标注。**拆分后的 useSourceMode 补一条 emitUpdate 语义单测**（复用 2.4 的断言口径），其余 composables 以 smoke 覆盖为既定决策（在 §8 验收证据中注明）。

## 5. 第四批：导出与 CI（P1/P2）

- DOCX 图片：`docx.ts` extractRuns 增加 img 分支（asset URL 图片经 canvas 转 PNG 后 ImageRun；data URL 直接解码）。
- PDF 分页：废除整篇单 canvas，改为**按块放置、普通块永不切断；块自身高于一页（长代码块/长表格/大图）时从新页顶开始、在页边界切片（接受截断尾部，写入导出实现的代码注释）**的分批渲染；实现时先验证 WKWebView canvas 限制的实测值，定分批阈值。§5 验收与此定义同一句为准。
- base64 分块转换（`utils.ts`）。
- CI：build.yml 增加 `npm test`、`cargo test`、`clippy`（允许 warning 不阻塞）；`npm install` → `npm ci`。
- 死代码清理：`FileError`+thiserror、`serde_json`、`ToolbarButton.vue`、`rootName`、`lexx-image.ts` 序列化转义修复。
- 验收：含 图片×2 + mermaid×1 + KaTeX×1 + **一个超页高代码块** 的 fixture 文档导出 DOCX（图片在）、PDF（非空白；普通段落行不得在页边界截断，超页高块允许整体移入下页——分批渲染方案按块边界切分保证这点）；CI 以现有 build.yml matrix 全绿为准。

## 6. 风险与回滚

- 全程无 DB/数据迁移、无认证/PII/权限红线域触碰（本地文件命令层加固属于收缩攻击面，不新增权限）。
- 每项独立 commit；第一批任一项引发回归 → revert 单项 commit 即可。
- 第三批拆分前基于当版打分支 `refactor/app-split-backup`；因 bug 修复 commit 先行、拆分 commit 纯平移（见 §4 回归保障），拆分引入难定位回归 → 仅 revert 拆分序列，bug 修复保留。
- 2.4（emitUpdate）与 2.2（CM history）是行为语义变更，若 smoke 发现既有功能依赖旧行为（如依赖退出源码模式自动置 dirty），记录并回退该项，不阻塞其他项。
- 已知未复现项：DOCX 丢图/PDF 全白基于代码审查推断，第四批开工前先用 fixture 实测确认现状（若无法复现则该项降级为加测试防回归）。

## 7. 执行顺序与依赖

1 → 2 → 3 → 4 严格串行（第三批拆分会搬动第一批修改的代码，必须在其后）。批内 2.1–2.7 相互独立可并行。第一批合入并验证后即可发布一版（用户可提前拿到数据丢失修复）。

## 8. 验收总表

- `npm run typecheck` 通过；`npm test` 全绿（含新增用例）；`cargo test` 全绿。
- 附录 A 手动 smoke 清单逐项通过。
- 每个 P0/P1 项在执行报告中有对应的验证证据（测试名 / 命令输出 / 日志摘录）。

## 附录 A：手动 smoke 清单

1. 打开含图片的 md 文档（fixture：自造测试文档，≥7 张相对路径引用图片，放 `docs/img/` 风格目录；`水印操作指南-甲方版.md` 为用户本地文档、不在仓库）：全部图片显示；保存后文件仍为相对路径。
2. WYSIWYG 输入 `- a` 回车 `- b` 回车 `[x] `：a、b 均在且 b 为勾选项。
3. 进源码模式 → 立即 Cmd+Z：内容不变；清空全文 → 退出源码模式：文档为空。
4. 编辑后等 autosave：状态栏 Saved；autosave 写失败场景（文件所在目录只读）：出失败 toast、原文件不损坏。
5. Cmd+F 查找/替换、Cmd+P QuickOpen、Cmd+W 关 tab（后台 tab 关闭不动视图）；源码模式下切换 tab：状态栏保持 Saved、无新 autosave 触发，且 Cmd+Z 不改变当前文档内容（不得出现前一文件的内容）。
6. 新窗口打开文件夹：内容与标题正确。
7. 两个 Untitled 写内容 → 退出进程 → 重启：两条都能恢复。
