# NotebookLM 引用跳转功能 — 深度研究报告

> 研究日期: 2026-04-17

## 一、NotebookLM 的引用系统长什么样

### 1.1 三面板布局

NotebookLM 的设计由 Jason Spielman 主导，核心是 **Sources → Chat → Studio** 三面板结构：

```
┌─────────────┬───────────────────────────┬──────────────┐
│             │                           │              │
│   Source    │       Chat Panel          │   Studio     │
│   Panel     │   (AI 回答 + 引用标记)     │   Panel      │
│             │                           │              │
│  ┌────────┐ │  "Secure Boot 与 TPM      │  (Notes,     │
│  │ Source │ │   2.0 互补的工作方式 [1]  │   Audio,     │
│  │ Guide  │ │   如下所述..."            │   Reports    │
│  │ ───────│ │                           │   ...)       │
│  │ > 高亮  │ │  "三个关键差异: [2]       │              │
│  │   文本  │ │   第一..."               │              │
│  └────────┘ │                           │              │
│             │                           │              │
└─────────────┴───────────────────────────┴──────────────┘
     左面板              中间面板                右面板
```

引用交互发生在 **左面板 (Source) ↔ 中间面板 (Chat)** 之间。

### 1.2 引用标记的视觉形态

AI 回答中，每个事实性陈述后面跟着一个**小号数字编号**，渲染为灰色小椭圆/药丸形徽章：

```
Secure Boot 和 TPM 2.0 是互补的安全措施 (1)
Smith 等人专注于静态分析 (2)，而当前方法使用动态追踪 (3)
```

来源描述一致：**"se mostraron como pequeños números en óvalos grises junto a la información"**（灰色椭圆中的小数字）。

### 1.3 两层交互：Hover → Click

NotebookLM 的引用跳转实际上是 **两层交互**，不是一上来就跳转：

#### 第一层：Hover（悬停预览）

- 鼠标悬停在引用编号上时，出现**原文引用预览**
- 显示的是**源文档中的真实原文片段**（direct quote），不是摘要
- 不需要离开当前聊天视图

Nick Babich（产品设计师）的描述：
> "Source Passage is an actual quote from the data source. You don't need to click '1' to open the data source and read details."

关键洞察：**Hover 就能看到完整引用内容，Click 是为了在源文档中定位上下文。**

#### 第二层：Click（点击跳转）

- 点击引用编号后，**左侧 Source Panel 打开**（或切换到对应的源文档）
- 源文档**自动滚动到引用段落**
- **该段落被高亮显示**，在长文档中一目了然

XDA 的实际使用描述：
> "I could click or hover over a citation for a quick review. NotebookLM also highlights the citation text, making it easier to find."

DataCamp 的描述：
> "When I click the reference number 3 in the answer, the 'Source guide' opens on the left side showing me the specific reference for that statement in the answer. The specific place is highlighted."

Steven Johnson（NotebookLM 团队成员）的描述：
> "The chat responses come with inline citations, allowing you to jump directly to the underlying passages that the model used to formulate its answers."

### 1.4 多位置引用

同一个源文档可能被多次引用。XDA 用户的实际案例：
> "I asked NotebookLM whether the Windows 11 security PDF mentioned Secure Boot. It was there, and it even showed me **the three places** where the PDF topic was on the left panel."

说明：点击不同引用编号 → 左面板中可能**同时高亮同一源文档的多个位置**，或者跳转到同一文档的不同段落。

### 1.5 引用持久性问题

Reddit 用户发现的一个已知限制：
> "When you generate a chat response, the hyperlinks to the reference work and pull up the citation. But once you save or pin this response, the numbered reference is baked in and doesn't [link anymore]."

即：引用跳转在**实时对话中可用**，但**保存为笔记后变成纯文本**，交互性丢失。

---

## 二、NotebookLM 引用跳转的设计哲学

### 2.1 "Built-in, not bolted-on"

Jason Spielman 在 LinkedIn 回顾中强调：

> "Very quickly we saw a massive user desire for in-line citations so our team quickly pivoted to build and launch."

引用不是附加功能，而是**用户反馈驱动的核心功能**。发布后用户立刻要求增强引用体验，团队快速响应。

### 2.2 核心心智模型

```
Inputs (Sources) → Chat (with Citations) → Outputs (Notes/Studio)
```

引用是连接 "输入" 和 "对话" 的桥梁——用户通过引用**验证 AI 回答的可信度**，建立信任。

### 2.3 面板的动态调整

Jason Spielman 设计的面板系统会**根据用户焦点动态调整**：

| 模式 | 面板组合 | 场景 |
|---|---|---|
| Standard | Sources + Chat + Studio | 默认视图 |
| Reading + Chat | Sources + Chat | 引用验证场景 |
| Chat + Writing | Chat + Studio | 写作/草稿场景 |
| Reading + Writing | Sources + Studio | 参考源 + 创作 |

引用跳转的核心交互发生在 **Reading + Chat** 模式——左侧看源文档，中间看 AI 回答。

---

## 三、NotebookLM vs 传统引用系统的差异

| 维度 | 传统引用（学术论文） | NotebookLM 引用 |
|---|---|---|
| 位置 | 文末参考文献列表 | **行内**，紧跟在陈述后面 |
| 格式 | `[Author, Year]` | **编号徽章** `(1)` `(2)` |
| 悬停 | 无预览 | **显示原文引用** |
| 点击 | 跳转到文末参考文献 | **跳转到源文档对应段落 + 高亮** |
| 方向 | 单向（文→文献） | **双向**（回答↔源文档） |
| 粒度 | 页面/章节级 | **段落/句子级** |
| 实时性 | 静态 | **动态**（每次对话生成新引用） |

---

## 四、映射到 mdeditor 的设计方案

### 4.1 架构差异

NotebookLM 是**三面板 Web 应用**（Sources / Chat / Studio），mdeditor 是**单文档桌面编辑器**。核心区别：

| NotebookLM | mdeditor |
|---|---|
| 源文档在左面板（只读） | 文档就是编辑器主体（可编辑） |
| 聊天在中间面板 | 聊天需要在侧栏 |
| 点击引用 → 左面板跳转 + 高亮 | 点击引用 → 编辑器自身跳转 + 高亮 |

**mdeditor 的优势**：编辑器本身就是"源文档"，不需要额外的 Source Panel。引用跳转直接在编辑器内完成，交互更紧凑。

### 4.2 推荐布局

```
┌────────────────────────────────┬──────────────────┐
│                                │                  │
│                                │   AI Chat        │
│         Editor                 │   Panel          │
│     (Tiptap / ProseMirror)     │                  │
│                                │   AI: "Secure    │
│   ▓▓▓ 高亮的引用段落 ▓▓▓       │   Boot 与 TPM    │
│                                │   互补... (1)    │
│                                │                  │
│                                │   Hover [1] →    │
│                                │   ┌────────────┐ │
│                                │   │ 原文引用:   │ │
│                                │   │ "Secure     │ │
│                                │   │  Boot..."   │ │
│                                │   └────────────┘ │
│                                │                  │
└────────────────────────────────┴──────────────────┘
```

### 4.3 交互设计：三层引用体验

参考 NotebookLM 的 Hover → Click 模式，设计三层：

#### 层级 1：Hover（悬停预览）

```
交互：鼠标悬停在引用标记 [1] 上
反馈：弹出 tooltip，显示：
  - 被引用的原文片段（前 100-200 字）
  - 所属标题（如 "under ## Security"）
  - 来源文件名（跨 Tab 场景）
```

对应 NotebookLM 的 "Source Passage is an actual quote" 行为。

实现：CSS tooltip 或 floating element，内容在构建 chunks 时已经缓存。

```vue
<!-- 引用标记 hover 预览 -->
<span
  class="citation-tag"
  @mouseenter="showPreview(chunk)"
  @mouseleave="hidePreview"
>
  1
</span>

<!-- Tooltip -->
<Teleport to="body">
  <div v-if="previewChunk" class="citation-preview">
    <div class="citation-preview-source">{{ previewChunk.heading }}</div>
    <div class="citation-preview-text">"{{ previewChunk.text }}"</div>
  </div>
</Teleport>
```

#### 层级 2：Click（跳转 + 高亮）

```
交互：点击引用标记 [1]
反馈：
  1. 编辑器滚动到目标段落（smooth scroll）
  2. 目标段落被高亮（accent color 背景，2s 渐隐动画）
  3. 光标移动到目标位置
  4. （如果跨文档）切换到目标 Tab
```

对应 NotebookLM 的 "click → Source guide opens → specific place is highlighted" 行为。

**高亮的视觉设计**（参考 NotebookLM 的行为，但做得更精致）：

```css
.citation-highlight {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  transition: background 1.5s ease-out;
}

/* 渐隐动画 */
.citation-highlight-fading {
  animation: citation-fade 2.5s ease-out forwards;
}

@keyframes citation-fade {
  0%   { background: color-mix(in srgb, var(--accent) 30%, transparent); }
  70%  { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  100% { background: transparent; }
}
```

#### 层级 3：双向引用面板

```
交互：右键编辑器中的文字 → "Find citations"
反馈：侧栏显示所有引用该段落的 AI 回答列表
```

这是 NotebookLM 没有做、但在本地编辑器中很有价值的方向——反向查看"AI 在哪些回答中引用了这个段落"。

### 4.4 引用标记的精确视觉规格

基于 NotebookLM 的设计语言，适配 mdeditor 风格：

```
行内文本中的引用标记：

    Secure Boot 和 TPM 2.0 是互补的安全措施 (1)(2)

    其中 (1) (2) 渲染为：
    - 圆角小药丸形
    - 背景: accent 色的 12% 透明度
    - 文字: accent 色, 10px, monospace
    - 尺寸: 最小 18×18px
    - hover 时背景加深到 25%
    - active 时有 scale(0.95) 的按压感
```

### 4.5 跨 Tab 跳转

NotebookLM 通过 Source Panel 展示多个源文档。mdeditor 的等价物是 **多 Tab**：

```typescript
// 跨 Tab 引用数据结构
interface Citation {
  chunkId: string
  tabId: string          // 目标 Tab ID（App.vue 的 FileSlot.id）
  fileName: string       // 显示用
  from: number           // ProseMirror doc offset
  to: number
  text: string           // hover 预览用
}

// 点击跨 Tab 引用的处理
async function handleCrossTabCitation(citation: Citation) {
  // 1. 切换到目标 Tab
  switchTab(citation.tabId)

  // 2. 等待 Editor 实例就绪（nextTick 或 watch）
  await nextTick()

  // 3. 获取目标 Editor 实例
  const editor = getEditorForTab(citation.tabId)
  const container = getContainerForTab(citation.tabId)

  // 4. 执行跳转 + 高亮
  jumpToChunk(editor, container, citation)
}
```

跨 Tab 引用标记需要额外的视觉提示：

```
(3 📄 report.md)   ← 跨文档引用，显示文件名
(1)(2)             ← 当前文档内的引用，无额外标记
```

---

## 五、NotebookLM 引用的局限（mdeditor 可以做得更好）

| NotebookLM 局限 | mdeditor 优化机会 |
|---|---|
| 保存笔记后引用变成纯文本 | 编辑器内容即源文档，引用永远可交互 |
| 源文档只读，不能直接编辑 | 引用跳转后可以直接修改目标文本 |
| 只能从 Chat → Source 单向跳 | 可以做双向：编辑器 → 查看引用它的 AI 回答 |
| 面板固定布局，空间有限 | 桌面端可以用浮动窗口、split view 等灵活布局 |
| 源文档必须是独立上传的文件 | 编辑器中的文档天然就是源，零配置 |
| 引用高亮是临时的 | 可以做持久化的 annotation/批注系统 |

---

## 六、实现优先级建议

### Phase 1：核心跳转引擎（无 AI）

纯编辑器能力，不依赖 LLM：

- [ ] 抽取 `scrollEditorTo(editor, from, to, container)` 工具函数（从 OutlineView 提取）
- [ ] 实现 `buildChunks(editor)` — 生成文档分块索引
- [ ] 实现 `highlightRange(editor, from, to, duration)` — ProseMirror Decoration 高亮
- [ ] `Cmd+Shift+J` 段落搜索面板 — 验证跳转 + 高亮体验

### Phase 2：AI Chat + 引用标记

- [ ] 右侧 AI Chat 面板 UI
- [ ] Prompt 设计：让 LLM 返回带 chunk_id 引用的回答
- [ ] 引用标记渲染（药丸形徽章 + hover tooltip）
- [ ] 点击 → 跳转 + 高亮

### Phase 3：增强体验

- [ ] Hover 预览（显示原文引用片段）
- [ ] 跨 Tab 引用跳转
- [ ] 双向引用（编辑器段落 → 查看哪些 AI 回答引用了它）
- [ ] 引用持久化（与文档一起保存的 annotation）

---

## 来源

- [Jason Spielman — Designing NotebookLM](https://jasonspielman.com/notebooklm) （设计负责人，三面板架构设计者）
- [FSU Service Center — How NotebookLM's Inline Citations Work](https://servicecenter.fsu.edu/s/article/How-do-NotebookLM-s-inline-citations-work-and-why-are-they-important)
- [Steven Johnson — How to Use NotebookLM as a Research Tool](https://stevenberlinjohnson.com/how-to-use-notebooklm-as-a-research-tool-6ad5c3a227cc) （团队核心成员）
- [DataCamp — NotebookLM Tutorial](https://www.datacamp.com/tutorial/notebooklm)
- [XDA — NotebookLM turned my scattered PDF research into something usable](https://www.xda-developers.com/notebooklm-scattered-pdf-research-usable/)
- [Nick Babich — NotebookLM for Product Designers](https://www.linkedin.com/pulse/notebooklm-product-designers-nick-babich-coiqe)
- [Reddit — Citations in saved notes](https://www.reddit.com/r/notebooklm/comments/1ge2v7z/citations_in_saved_notes/)
- [Google Support — Use chat in NotebookLM](https://support.google.com/notebooklm/answer/16179559?hl=en)
- [Codecademy — How to Use NotebookLM](https://www.codecademy.com/article/how-to-use-notebooklm)
