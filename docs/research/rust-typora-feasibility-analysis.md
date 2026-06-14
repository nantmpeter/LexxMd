# 基于 Rust 重构 Typora 式 WYSIWYG Markdown 编辑器：技术可行性综合分析

> 研究日期：2026 年 4 月
> 涵盖范围：Rust GUI 框架（2024-2026 状态）、文本/Markdown 处理、渲染方案、架构对比、关键技术挑战

---

## 目录

1. [Rust GUI 框架现状（2024-2026）](#1-rust-gui-框架现状2024-2026)
2. [Rust 文本/Markdown 处理生态](#2-rust-文本markdown-处理生态)
3. [渲染方案对比分析](#3-渲染方案对比分析)
4. [架构对比：Electron vs Rust 方案](#4-架构对比electron-vs-rust-方案)
5. [混合架构方案](#5-混合架构方案)
6. [关键技术挑战](#6-关键技术挑战)
7. [真实世界 Rust 编辑器项目](#7-真实世界-rust-编辑器项目)
8. [推荐架构](#8-推荐架构)
9. [总结与建议](#9-总结与建议)

---

## 1. Rust GUI 框架现状（2024-2026）

### 1.1 Tauri（Rust + Web 前端）

**架构概述：** Tauri 是一个使用 Rust 构建后端、使用系统原生 WebView（Windows 上是 WebView2/Edge，macOS 上是 WKWebView/Safari，Linux 上是 WebKitGTK）作为前端渲染层的桌面应用框架。Tauri 2.0 已于 2024 年正式发布稳定版，并新增了 iOS 和 Android 移动端支持。

**成熟度：**
- Tauri 2.0 是目前 Rust GUI 生态中最成熟的生产级方案
- 插件系统完善，社区活跃，文档齐全
- 已有大量生产应用（包括多个 Markdown 编辑器）

**优势：**
- 安装包极小：3-15 MB vs Electron 的 85-200 MB（20-50 倍差距）
- 内存占用极低：空闲时 30-40 MB vs Electron 的 200-300 MB
- 使用系统 WebView，不捆绑 Chromium
- Rust 后端提供内存安全和性能保障
- 支持任意前端框架（React、Vue、Svelte 等）
- Tauri 2.0 支持 iOS/Android，真正跨平台

**劣势：**
- 不同平台的 WebView 渲染一致性需要额外处理
- 某些高级特性受限于系统 WebView 的能力
- 前端仍使用 JavaScript/TypeScript，非纯 Rust
- 调试体验不如 Electron 的 DevTools 成熟

### 1.2 Dioxus

**架构概述：** Dioxus 是一个 Rust 原生的跨平台 UI 框架，使用类似 React 的 TSX 声明式语法（在 Rust 中通过 RSX 宏实现）。Dioxus 0.6 是当前主要版本，支持 Web、桌面和移动端。

**2025 状态：**
- Dioxus 0.6 获得社区高度评价（Reddit/HN 讨论热烈）
- 桌面端通过 WebView2（Windows）和 WebKitGTK（Linux/macOS）渲染
- 支持热重载，开发体验显著提升
- 单一代码库可同时编译到 Web、桌面、移动端

**优势：**
- 全栈 Rust，前后端统一语言
- 类 React 的编程模型，上手成本低
- 支持服务端渲染（SSR）

**劣势：**
- 生态成熟度不如 Tauri
- 桌面端实际也依赖 WebView，非纯原生渲染
- 社区规模相对较小

### 1.3 Iced（Elm 风格）

**架构概述：** Iced 是一个受 Elm Architecture 启发的纯 Rust GUI 库，采用保留模式（retained mode），使用 State -> Messages -> View 的模式。

**2025 状态：**
- 被社区评为 2025 年"最完整的纯 Rust GUI 库"
- System76 的 COSMIC 桌面环境基于 Iced 构建——这是最重大的实际验证
- 支持 Windows、macOS、Linux 和 Web（通过 WASM）
- 使用 cosmic-text 进行文本渲染

**优势：**
- 纯 Rust，无 WebView 依赖
- 有 COSMIC 桌面这样的大型项目验证
- Elm 架构清晰，状态管理可预测
- 跨平台支持好

**劣势：**
- 开发节奏有时被社区关注
- 富文本编辑能力有限
- 复杂布局和自定义渲染需要额外工作
- 不如 Tauri 适合构建复杂文本编辑界面

### 1.4 Slint（声明式 UI 工具包）

**架构概述：** Slint 是一个声明式 GUI 工具包，使用自定义 DSL 描述 UI，编译为原生代码。支持 Rust、C++、JavaScript 和 Python 绑定。

**2025 状态：**
- 被列为 2025 年嵌入式 HMI 框架前五名
- 主要面向嵌入式系统和桌面应用
- 使用自有 DSL（.slint 文件）而非 Rust 宏

**优势：**
- 极轻量，适合资源受限环境
- 声明式 DSL 设计清晰
- 多语言绑定
- 编译到原生代码，性能好

**劣势：**
- 主要面向嵌入式场景，桌面应用生态不够成熟
- 学习自有 DSL 有额外成本
- 富文本编辑场景的支持有限
- 社区规模较小

### 1.5 egui/eframe（即时模式 GUI）

**架构概述：** egui 是一个简单、快速、高度可移植的即时模式（immediate mode）GUI 库。eframe 是其桌面应用封装。

**2025 状态：**
- 社区活跃，是最流行的 Rust GUI 库之一
- 已有实际项目使用 egui 构建了 Markdown 编辑器（Ferrite）
- 支持原生桌面和 Web（WASM）
- 可直接在浏览器中体验（[egui.rs](https://www.egui.rs/)）

**优势：**
- API 极其简洁易用
- 即时模式编程简单直观
- 高度可移植（Web、桌面、游戏内嵌入）
- 适合快速原型开发

**劣势：**
- 即时模式不适合复杂布局
- 每帧重绘所有内容，对复杂 UI 性能有影响
- 缺乏高级布局系统
- 不适合构建精细的 WYSIWYG 编辑界面

### 1.6 Xilem（Druid 继任者）

**架构概述：** Xilem 是一个实验性的纯 Rust GUI 框架，构建在 Masonry（Druid 的继任者）之上。由 Raph Levien（Xi-Editor 的创建者）主导开发。

**2025 状态：**
- 仍处于早期实验阶段
- 核心理念创新，但尚不适合生产使用
- 位于 Linebender 生态系统（与 Vello、Parley 同一团队）

**优势：**
- 设计理念先进
- 由经验丰富的团队打造
- 与 Vello（GPU 矢量渲染器）和 Parley（文本布局）深度集成

**劣势：**
- 非常早期，API 不稳定
- 不适合任何生产项目
- 文档和示例缺乏

### 1.7 框架对比总结表

| 框架 | 模式 | 渲染方式 | 生产就绪 | 富文本适配性 | 跨平台 |
|------|------|----------|----------|-------------|--------|
| **Tauri** | Web 前端 + Rust 后端 | 系统 WebView | **非常成熟** | **最佳** | 桌面 + 移动 |
| **Dioxus** | RSX 声明式 | 系统 WebView | 中等 | 好 | 桌面 + Web + 移动 |
| **Iced** | Elm 架构 | 自绘（wgpu/Glow） | 中高 | 一般 | 桌面 + Web |
| **Slint** | 声明式 DSL | 自绘 | 中高 | 一般 | 嵌入式 + 桌面 |
| **egui** | 即时模式 | 自绘（wgpu/Glow） | 中 | 较弱 | 桌面 + Web |
| **Xilem** | 实验性 | 自绘（Vello） | 未就绪 | 待定 | 桌面 |

**结论：对于构建 Typora 式 WYSIWYG Markdown 编辑器，Tauri 2.0 是当前最成熟、最可行的 Rust GUI 方案。**

---

## 2. Rust 文本/Markdown 处理生态

### 2.1 pulldown-cmark

**定位：** Rust 生态中最成熟的 CommonMark 拉取解析器（pull parser）。

**特性：**
- 基于迭代器的拉取解析模型，流式处理
- 最新版本相比 v0.9.0 有约 30% 的性能提升
- 历史基准测试中，pulldown-cmark 约 180us/迭代，comrak 约 380us/迭代（约 2 倍速度优势）
- 适合实时渲染和流式处理场景

**适用场景：**
- 实时 Markdown 渲染
- 流式处理大型文档
- 需要高性能的场景

### 2.2 comrak

**定位：** GitHub-Flavored Markdown (GFM) 的 Rust 实现，是 cmark-gfm C 参考实现的 1:1 翻译。

**特性：**
- 完整的 CommonMark + GFM 支持
- 生成 AST，适合需要操作文档结构的场景
- 与 GitHub 的 Markdown 渲染结果完全一致

**适用场景：**
- 需要完整 GFM 兼容性
- 需要操作文档 AST
- 需要与 GitHub 渲染结果一致

### 2.3 markdown-rs

**定位：** 较新的 CommonMark 兼容 Markdown 解析器，由 wooorm 开发。

**特性：**
- 使用状态机实现，支持 `#![no_std]`
- 发出具体的 token 序列
- 设计目标是正确性和可移植性
- 可编译到 WASM，在浏览器中使用

### 2.4 tree-sitter-markdown

**定位：** 基于 tree-sitter 的增量 Markdown 解析器。

**特性：**
- 提供增量解析能力，适合编辑器场景
- 包含两个语法：块级结构和行内内容
- 输出具体语法树（CST），保留原始输入
- 2025 年有 Arborium 项目（fasterthanli.me）计划整合 96+ 个 tree-sitter 语法

**适用场景：**
- 编辑器中的实时语法分析
- 增量解析（只重新解析变更部分）
- 语法高亮和结构化编辑

### 2.5 解析器对比

| 解析器 | 解析模型 | GFM 支持 | 增量解析 | 性能 | 适用场景 |
|--------|---------|---------|---------|------|---------|
| **pulldown-cmark** | 拉取（迭代器） | 部分 | 否 | 最快 | 实时渲染 |
| **comrak** | AST | 完整 | 否 | 中等 | GFM 兼容 |
| **markdown-rs** | 状态机 | 否 | 否 | 快 | 嵌入式/WASM |
| **tree-sitter-md** | 增量 CST | 部分 | **是** | 编辑器级 | 编辑器集成 |

### 2.6 Syntect（语法高亮）

**定位：** Rust 语法高亮库，使用 Sublime Text 语法定义（TextMate 语法）。

**特性：**
- 利用 Sublime Text 丰富的语法高亮生态
- 性能优异——Zig 社区的测试表明自定义实现仍然比 syntect 慢 4 倍以上
- 是 Rust 生态中最成熟的语法高亮方案
- 被 Zola 等知名项目使用

**与 JavaScript 解析器的性能对比：**
- Rust Markdown 解析器普遍比 JavaScript 解析器（如 marked.js、markdown-it）快 5-10 倍
- syntect 的语法高亮性能远超 JavaScript 的 Prism.js/highlight.js
- 增量解析（tree-sitter）在编辑场景中有更大的性能优势

---

## 3. 渲染方案对比分析

### 3.1 Rust 核心 + WebView 渲染（Tauri 模式）

**工作原理：**
- Rust 负责后端逻辑：文件 I/O、Markdown 解析、语法分析
- WebView 负责 UI 渲染：编辑界面、实时预览、样式
- 两者通过 Tauri 的 IPC 机制通信

**优势：**
- WebView（尤其 Chromium 内核的 WebView2）的文本渲染质量极高
- CSS 提供强大的排版能力
- 可以直接使用成熟的 Web 富文本编辑库（Tiptap、Lexical、ProseMirror）
- 开发效率高，前端生态丰富

**劣势：**
- 仍依赖 WebView/浏览器引擎
- 跨平台 WebView 差异需要处理

### 3.2 自定义文本布局引擎

Rust 生态中的文本渲染栈：

| 库 | 角色 | 维护者 | 使用者 |
|----|------|--------|--------|
| **cosmic-text** | 全文本管线（整形、布局、渲染） | System76 | Iced, COSMIC, Bevy, Zed, Lapce |
| **parley** | 文本布局 | Linebender | Xilem 生态 |
| **swash** | 底层字体整形和字形渲染 | cosmic-text 依赖 | cosmic-text |
| **glyphon** | wgpu 上的 2D 文本渲染 | 社区 | 基于 wgpu 的项目 |
| **ab_glyph** | 字体光栅化 | 社区 | egui 等 |

**cosmic-text 是 Rust 文本渲染的事实标准：**
- 提供高级文本整形（text shaping）、布局和渲染
- 支持多行文本处理
- 被 Iced、COSMIC 桌面、Bevy 游戏引擎、Zed 编辑器、Lapce 等广泛使用
- 纯 Rust 实现，无外部 C 依赖

**与 Chromium 渲染的对比：**
- Chromium 的文本渲染管线（包括 HarfBuzz + FreeType + Skia）经过十余年打磨，在复杂文本（BiDi、连字、CJK）方面最为成熟
- cosmic-text 在基本拉丁文本和 CJK 文本上表现良好，但在极端复杂的文本布局场景中仍有差距
- 纯 Rust 渲染的优势是完全可控、无外部依赖、跨平台一致

### 3.3 GPU 加速文本渲染

**wgpu + glyphon 方案：**
- glyphon 是 wgpu 上的文本渲染库，基于 cosmic-text 构建
- 利用 GPU 进行文本光栅化和渲染
- 不需要额外的渲染通道，可集成到现有渲染管线中
- 已被推荐为 wgpu_glyph 的继任者

**Zed 的实践：**
- Zed 使用自定义的 GPUI 框架，像渲染游戏一样渲染 UI（120 FPS）
- 2025 年从 Blade 迁移到 wgpu 作为图形后端
- 在 Windows 上使用 DirectWrite 进行文本整形
- 实现了每秒 100 万像素的渲染速度

---

## 4. 架构对比：Electron vs Rust 方案

### 4.1 二进制大小

| 方案 | 安装包大小 |
|------|-----------|
| Electron（Typora） | 85-200 MB |
| Tauri 2.0 | 3-15 MB |
| 纯 Rust（egui） | 5-20 MB |
| 纯 Rust（Iced） | 10-25 MB |

**Tauri 比 Electron 小 20-50 倍。**

### 4.2 内存使用

| 方案 | 空闲内存 | 说明 |
|------|---------|------|
| Electron | 200-500 MB | 包含完整 Chromium 进程 |
| Tauri 2.0 | 30-40 MB | 使用系统 WebView |
| 纯 Rust（egui） | 20-50 MB | 无浏览器引擎 |
| 纯 Rust（Iced） | 30-60 MB | 自绘 UI |

### 4.3 启动时间

| 方案 | 启动时间 | 说明 |
|------|---------|------|
| Electron | 2-5 秒 | 需要启动 Chromium |
| Tauri 2.0 | 0.5-1.5 秒 | 系统 WebView 已预热 |
| 纯 Rust | 0.1-0.5 秒 | 原生启动 |

### 4.4 CPU/电池使用

- Electron：由于 Chromium 的持续运行，CPU 和电池消耗较高
- Tauri：WebView 的 CPU 使用取决于前端复杂度，后端 Rust 几乎零开销
- 纯 Rust：CPU 使用最低，电池续航最长

### 4.5 跨平台一致性

- **Electron：** 最好——所有平台使用相同的 Chromium 内核
- **Tauri：** 中等——不同平台的 WebView 引擎不同（Edge/Safari/WebKitGTK）
- **纯 Rust：** 取决于渲染后端——wgpu 提供良好的一致性

### 4.6 开发体验

| 维度 | Electron | Tauri | 纯 Rust |
|------|---------|-------|---------|
| 调试工具 | DevTools（优秀） | 有限 | 有限 |
| 热重载 | 支持 | 部分支持 | 不支持 |
| 生态成熟度 | 非常高 | 高 | 中等 |
| 学习曲线 | 低 | 中 | 高 |
| UI 开发效率 | 高 | 高 | 低-中 |

---

## 5. 混合架构方案

### 5.1 Tauri 2.0（Rust 后端 + Web 前端）—— 最佳平衡点

这是当前最受推荐的方案。已有多个成功的 Markdown 编辑器案例：

**已知项目：**
- **Otterly：** 基于 Tauri 2.0 + Svelte 5 的本地优先 WYSIWYG Markdown 笔记应用
- **CrabPad：** 基于 Tauri + React/TypeScript 的桌面 Markdown 编辑器
- **AI Markdown Editor：** 基于 Tauri v2 + Svelte 的极简 WYSIWYG Markdown 编辑器

**架构模式：**
```
┌─────────────────────────────────────────┐
│              前端（WebView）              │
│  ┌───────────┐  ┌────────────────────┐  │
│  │ 编辑器 UI  │  │ 实时预览/渲染      │  │
│  │ Tiptap/   │  │ HTML/CSS           │  │
│  │ ProseMirror│  │ KaTeX/Mermaid      │  │
│  └─────┬─────┘  └────────┬───────────┘  │
│        │        IPC 通信  │              │
├────────┼─────────────────┼──────────────┤
│        ▼                 ▼              │
│              Rust 后端                   │
│  ┌───────────┐  ┌────────────────────┐  │
│  │ Markdown  │  │ 文件系统/           │  │
│  │ 解析引擎  │  │ 原生 API           │  │
│  │ pulldown- │  │ 导出/PDF           │  │
│  │ cmark     │  │                    │  │
│  └───────────┘  └────────────────────┘  │
└─────────────────────────────────────────┘
```

### 5.2 Rust 核心 + 自定义渲染

**模式：** 使用 Rust 处理所有逻辑（解析、编辑操作），使用 wgpu/GPUI 进行自定义 GPU 渲染。

**代表：** Zed 编辑器

**优势：**
- 最高性能
- 完全控制渲染管线
- 不依赖任何浏览器引擎

**劣势：**
- 开发成本极高
- 需要自建所有 UI 组件
- 复杂文本排版需要大量工作

### 5.3 Rust 文本引擎 + WebView 编辑表面

**模式：** Rust 处理文本编辑核心逻辑（rope 数据结构、撤销/重做、语法分析），WebView 仅作为编辑表面的渲染层。

**优势：**
- Rust 核心逻辑可复用于不同平台
- WebView 提供成熟的编辑体验
- 可以逐步迁移到纯 Rust 渲染

**劣势：**
- Rust 和 WebView 之间的状态同步需要精心设计
- IPC 延迟可能影响编辑响应速度

---

## 6. 关键技术挑战

### 6.1 如何实现 contenteditable 类似行为

**在 WebView 中：**
- 直接使用 Web 的 contenteditable API
- 或使用成熟的富文本编辑库：Tiptap（基于 ProseMirror）、Lexical（Meta 开源）、BlockNote
- 这些库已解决了光标定位、选区管理、行内格式化等复杂问题

**在纯 Rust 中：**
- 需要自行实现完整的文本编辑状态机
- 参考案例：
  - **Zed：** 使用基于 SumTree 的 Rope 数据结构管理文本，自定义 GPUI 组件处理编辑交互
  - **Lapce：** 使用 Xi-Editor 的 Rope Science 方法，Floem UI 框架
  - **egui 的 TextEdit：** 提供基础文本编辑组件，但功能有限
- 这是纯 Rust 方案最大的技术挑战之一

### 6.2 IME（输入法编辑器）支持

**当前状态：**
- IME 支持是 Rust GUI 生态中公认的痛点
- Zed 编辑器在 CJK 输入方面已有较好的支持（经过专门优化）
- winit（Rust 窗口库）提供了基础的 IME 事件处理，但不同平台的行为存在差异
- Warp Terminal 等项目仍报告 CJK IME 问题

**Tauri 方案的优势：**
- WebView 的 IME 支持由浏览器引擎处理，与系统原生 IME 无缝集成
- 这是选择 Tauri 构建编辑器的重要理由之一

**纯 Rust 方案的挑战：**
- 需要为每个平台（Windows 的 TSF、macOS 的 NSTextInputClient、Linux 的 IBus/Fcitx）单独处理 IME
- composing text（预编辑文本）的显示和确认逻辑复杂
- 2025 年的情况有所改善，但仍然是主要的工程挑战

### 6.3 复杂文本布局（BiDi、连字等）

**当前状态（2025）：**
- boringcactus 的 2025 年 Rust GUI 调查显示，复杂文本布局仍是大多数 Rust GUI 库的弱点
- cosmic-text 提供了基础的 BiDi 和连字支持（通过 swash 使用 HarfBuzz 算法）
- 但与浏览器引擎的完整文本布局能力相比仍有差距
- 调查中只有不到 10% 的 Rust GUI 库达到了功能完备的阈值

**实际影响：**
- 对于主要处理 LTR（从左到右）文本和 CJK 文本的 Markdown 编辑器，cosmic-text 已基本满足需求
- 对于需要处理阿拉伯语、希伯来语等 RTL 语言的场景，WebView 方案更可靠

### 6.4 大规模实时语法高亮

**Rust 方案：**
- **syntect：** 使用 TextMate 语法，性能优异，支持数百种语言
- **tree-sitter：** 增量解析，适合编辑器场景
- Zed 使用 tree-sitter 实现了高性能的语法高亮
- Rust 方案的性能显著优于 JavaScript 的 Prism.js/highlight.js

**实现策略：**
- 对于代码块：使用 syntect 或 tree-sitter 进行语法高亮
- 对于 Markdown 标记：使用自定义高亮规则
- 增量高亮：只重新高亮变更的行/块

### 6.5 LaTeX/数学公式渲染

**纯 Rust 方案：**
- **RaTeX：** 2025 年出现的重要项目——纯 Rust 的 KaTeX 兼容数学渲染引擎
  - 不依赖 JavaScript、WebView 或 DOM
  - 一个 Rust 核心，一个显示列表，多平台渲染
  - 支持 KaTeX 的大部分语法
- **katex-rs：** KaTeX 的 Rust 重写，将 LaTeX 转换为 HTML/MathML
- **Typst：** 用 Rust 编写的现代排版系统，有自己的数学语法和 PDF 输出能力

**WebView 方案：**
- 直接使用 KaTeX 或 MathJax，这是最成熟的方案

### 6.6 Mermaid/图表渲染

**纯 Rust 方案：**
- **mmdr（mermaid-rs-renderer）：** 2025 年的突破性项目
  - 原生 Rust Mermaid 渲染器
  - 比官方 mermaid-cli 快 500-1000 倍（官方 CLI 需要启动无头 Chromium）
  - 直接渲染到 SVG，可选 PNG（通过 resvg）
  - 完全不需要 Chromium
- **rusty-mermaid-diagrams：** 另一个纯 Rust 方案，支持 25 种图表类型和 5 种渲染后端
- **Ferrite 编辑器：** 已集成原生 Mermaid 图表渲染

**WebView 方案：**
- 直接使用 mermaid.js，功能最完整

### 6.7 无浏览器引擎的 PDF 导出

**Rust 方案：**
- **Typst：** 最有前景的方案
  - 纯 Rust 排版系统，设计目标是与 LaTeX 一样强大但更易学
  - 可作为 CLI 工具或 Rust 库使用
  - 支持 PDF 1.7 和 PDF 2.0 输出
  - Typst 0.14（2025 年发布）增强了 PDF 生成管线
  - 支持编译到 WASM，在浏览器中生成 PDF（无需服务器）
  - 已有 `mdbook-typst-pdf` 将 Markdown 转为 PDF
- **resvg：** SVG 渲染为 PNG/位图
- **genpdf：** 简单的 PDF 生成库

**实现策略：**
1. 将 Markdown 解析为内部 AST
2. 通过 Typst 的 Rust 库 API 排版为 PDF
3. 对于包含 Mermaid 图表的文档，先用 mmdr 渲染为 SVG，再嵌入 PDF

---

## 7. 真实世界 Rust 编辑器项目

### 7.1 Zed 编辑器

**技术栈：** Rust + GPUI（自研 GPU 加速 UI 框架）+ wgpu

**架构要点：**
- **GPUI：** 混合即时/保留模式的 GPU 加速 UI 框架
- **文本存储：** 基于 SumTree（B 树变体）的 Rope 数据结构
- **渲染：** 像游戏一样以 120 FPS 渲染 UI，达到每秒 100 万像素
- **图形后端：** 2025 年从 Blade 迁移到 wgpu，以获得更好的跨平台支持
- **文本整形：** Windows 上使用 DirectWrite
- **2025 年里程碑：** Windows 版本发布（使用 DirectX 11 后端）

**关键启示：**
- 纯 Rust 可以构建高性能文本编辑器
- GPU 加速渲染是性能的关键
- 但开发成本极高——Zed 有全职团队和商业支持
- GPUI 组件库（如 Longbridge 的 gpui-component）已提供带 Rope + tree-sitter 的代码编辑器组件

### 7.2 Lapce

**技术栈：** Rust + Floem（自研 UI 框架）+ wgpu

**架构要点：**
- 纯 Rust，UI 使用 Floem（自定义 Rust 原生 UI 工具包）
- 使用 Xi-Editor 的 Rope Science 方法
- GPU 加速渲染（Floem + wgpu）
- WASI 插件系统
- Vim 风格模态编辑

**2025 状态：**
- 社区报告处于**半放弃状态**——创建者主要为个人使用维护
- 这是 Rust 编辑器项目可持续性的一个警示案例

### 7.3 Xi Editor（已归档）

**技术栈：** Rust 核心 + 平台原生前端

**经验教训（来自创建者 Raph Levien 的回顾）：**
- 花费了"相当多的创新点"——过于追求架构新颖性
- 前端/后端分离使用 JSON-RPC 的架构增加了不必要的复杂性
- 没有在早期交付可用的产品
- 最终因为缺乏前端集成而失败
- 核心技术创新（Rope 数据结构、CRDT）被后续项目（Zed、Lapce）继承

**关键启示：**
- 不要过度工程化——先交付可用产品
- 前端渲染层的选择至关重要
- 文本编辑器的"最后一公里"（UI 交互、平台集成）占 80% 的工作量

### 7.4 Helix

**技术栈：** Rust，终端编辑器

**架构要点：**
- 模态编辑器（类似 Vim 但选择优先）
- 内置 LSP 和 tree-sitter 支持
- 终端 UI，不依赖 GUI 框架
- 2025 年持续活跃开发（Release 25.07）

**与本项目相关性：** 有限——Helix 是终端编辑器，不涉及 GUI 渲染。但其文本处理和 tree-sitter 集成方案有参考价值。

### 7.5 Ferrite

**技术栈：** Rust + egui

**特性：**
- 2025 年发布的原生 Markdown 编辑器
- 支持 WYSIWYG 编辑、实时预览、分屏视图
- 原生 Mermaid 图表渲染（不依赖 JS）
- 40+ 语言语法高亮
- 代码 minimap 和禅模式
- 完全无 Electron，纯原生性能
- 800+ GitHub Stars
- 有趣的是，全部 15000+ 行 Rust 代码由 AI 生成

**关键启示：**
- 证明了纯 Rust（egui）可以构建功能完整的 Markdown 编辑器
- 但 egui 的即时模式在复杂编辑场景中可能受限
- 原生 Mermaid 渲染已可行

### 7.6 基于 Tauri 的 Markdown 编辑器

多个项目验证了 Tauri 用于 Markdown 编辑器的可行性：
- Otterly（Tauri 2.0 + Svelte 5）
- CrabPad（Tauri + React）
- AI Markdown Editor（Tauri v2 + Svelte）

---

## 8. 推荐架构

基于以上所有研究，推荐以下分层架构用于构建现代 Typora 替代品：

### 8.1 推荐 Rust 框架：Tauri 2.0

**理由：**
1. 最成熟的生产级 Rust GUI 方案
2. WebView 提供最佳的文本编辑和渲染体验
3. 极小的二进制大小和内存占用
4. 可以使用 Web 富文本编辑库（Tiptap、ProseMirror、Lexical）
5. IME/CJK 输入由 WebView 原生处理
6. 支持桌面 + 移动端
7. 已有多个成功的 Markdown 编辑器案例

### 8.2 Markdown 处理管线

```
用户输入
    │
    ▼
┌──────────────────────────┐
│  编辑层（WebView）         │
│  Tiptap/ProseMirror       │
│  - 光标/选区管理           │
│  - 行内格式化              │
│  - contenteditable        │
└──────────┬───────────────┘
           │ Markdown 文本
           ▼
┌──────────────────────────┐
│  Rust 解析引擎             │
│                            │
│  pulldown-cmark            │  ← 快速解析，实时渲染
│  comrak                    │  ← GFM 完整支持
│  tree-sitter-markdown      │  ← 增量解析，结构编辑
│  syntect                   │  ← 代码块语法高亮
└──────────┬───────────────┘
           │ AST/渲染指令
           ▼
┌──────────────────────────┐
│  渲染输出                  │
│  - WebView HTML/CSS       │  ← 主编辑器
│  - Typst PDF              │  ← PDF 导出
│  - RaTeX 数学公式          │  ← 数学渲染
│  - mmdr Mermaid 图表       │  ← 图表渲染
└──────────────────────────┘
```

### 8.3 WYSIWYG 编辑策略

**推荐方案：Tiptap（基于 ProseMirror）作为编辑引擎**

1. **Tiptap** 是一个无头（headless）富文本编辑器框架
   - 提供 WYSIWYG 编辑的完整基础设施
   - 支持自定义节点类型（对应 Markdown 块级元素）
   - 有成熟的 Markdown 序列化/反序列化插件
   - 可以精确控制编辑行为

2. **编辑流程：**
   - 用户在 Tiptap 编辑器中输入
   - Tiptap 维护内部文档模型
   - 通过 Tiptap 的 Markdown 插件实时同步 Markdown 源码
   - Rust 后端通过 Tauri IPC 接收 Markdown 文本
   - Rust 后端负责文件保存、语法分析、导出等

3. **Typora 式的无缝体验：**
   - 实现 Tiptap 自定义节点，使 Markdown 语法标记（`#`、`**`、`` ` ``）在获得焦点时显示，失去焦点时隐藏
   - 块级元素（标题、列表、代码块）始终以渲染后的样式显示
   - 行内元素在编辑时显示 Markdown 语法，非编辑时显示渲染结果

### 8.4 渲染策略

| 渲染需求 | 方案 | 说明 |
|---------|------|------|
| **主编辑界面** | WebView + CSS | 最高质量的文本渲染和排版 |
| **实时预览** | WebView + CSS | 与编辑器共享渲染引擎 |
| **代码高亮** | syntect（Rust）+ CSS 类名 | 后端高亮，前端只负责着色 |
| **数学公式** | RaTeX（纯 Rust）或 KaTeX（WebView） | 纯 Rust 方案可离线渲染 |
| **Mermaid 图表** | mmdr（纯 Rust）→ SVG | 比官方 JS 方案快 500-1000x |
| **PDF 导出** | Typst（Rust 库） | 无需浏览器引擎 |

### 8.5 导出管线

```
Markdown 源码
    │
    ├──→ HTML 导出：pulldown-cmark → HTML → CSS 注入
    │
    ├──→ PDF 导出：pulldown-cmark → AST → Typst 排版 → PDF
    │    （数学公式：RaTeX 渲染为 SVG/路径嵌入）
    │    （图表：mmdr 渲染为 SVG 嵌入）
    │
    ├──→ DOCX 导出：pulldown-cmark → AST → docx-rs 或 pandoc（通过命令行）
    │
    └──→ 图片导出：resvg 或 WebView 截图
```

### 8.6 插件/扩展系统

**推荐方案：WASI（WebAssembly System Interface）**

1. **核心思路：**
   - 插件以 WASM 模块形式分发
   - 运行在沙箱环境中，安全隔离
   - 可用任何可编译到 WASM 的语言编写（Rust、C、Go 等）

2. **插件 API：**
   - Markdown AST 转换钩子
   - 自定义块级/行内元素渲染器
   - 主题/样式钩子
   - 导出格式扩展点

3. **参考案例：**
   - Lapce 的 WASI 插件系统
   - Zed 的扩展系统（虽然使用不同的技术）

---

## 9. 总结与建议

### 9.1 可行性评估

| 维度 | 评估 | 说明 |
|------|------|------|
| **技术可行性** | **高** | Rust 生态已具备构建完整 Markdown 编辑器所需的所有组件 |
| **性能可行性** | **极高** | Rust 方案在各方面都优于 Electron（体积、内存、CPU） |
| **开发效率** | **中高** | Tauri + Web 前端可复用成熟的 Web 编辑器生态 |
| **IME/CJK 支持** | **中高** | Tauri/WebView 方案可获得原生级 IME 支持 |
| **跨平台一致性** | **中高** | WebView 差异需额外处理，但可控 |
| **生态成熟度** | **中高** | Markdown 解析、语法高亮、PDF 导出等核心库已成熟 |
| **维护可持续性** | **高** | Rust 生态活跃，核心库（Tauri、pulldown-cmark、cosmic-text）持续发展 |

### 9.2 核心建议

1. **首选 Tauri 2.0 作为框架**——它是当前最成熟的 Rust GUI 方案，平衡了性能和开发效率。

2. **前端使用 Tiptap/ProseMirror**——已解决了富文本编辑的核心难题，无需重新发明轮子。

3. **Rust 负责后端核心**——文件系统、Markdown 解析、语法高亮、导出管线。

4. **逐步替代 Web 依赖**——先使用 KaTeX/Mermaid.js（WebView 中），后续逐步替换为 RaTeX/mmdr（纯 Rust）。

5. **PDF 导出使用 Typst**——这是最成熟的 Rust PDF 方案，可作为库直接集成。

6. **不推荐纯 Rust 自绘方案**——开发成本极高（参考 Zed 的大型团队和 Lapce 的可持续性问题）。除非有充足的团队和资金。

### 9.3 风险与缓解

| 风险 | 严重程度 | 缓解策略 |
|------|---------|---------|
| WebView 跨平台差异 | 中 | 建立跨平台测试矩阵，针对差异编写 polyfill |
| Tiptap/ProseMirror 许可证 | 低 | Tiptap 核心开源（MIT），商业功能需确认许可 |
| Rust 生态库的 API 稳定性 | 低 | 使用 1.0+ 版本的库，锁定依赖版本 |
| IME 兼容性问题 | 中 | 优先使用 WebView 方案，减少自定义文本输入 |
| 开发周期较长 | 中 | 分阶段交付，先核心编辑功能，后高级特性 |

### 9.4 与 Typora 的对比预期

| 维度 | Typora (Electron) | 推荐方案 (Tauri + Rust) |
|------|-------------------|------------------------|
| 安装包大小 | ~100 MB | ~10 MB |
| 内存使用 | 200-300 MB | 30-50 MB |
| 启动时间 | 2-3 秒 | <1 秒 |
| 编辑体验 | 优秀 | 可达到同等水平（使用相同 Web 编辑技术） |
| PDF 导出 | 依赖 Chromium | 使用 Typst，更轻量 |
| 数学渲染 | KaTeX | KaTeX 或 RaTeX（纯 Rust） |
| 图表渲染 | Mermaid.js | mmdr（纯 Rust，更快）或 Mermaid.js |
| 跨平台 | 一致（Chromium） | 良好（WebView，需额外测试） |
| 插件系统 | 无 | WASI 插件系统 |

---

## 参考来源

- [Tauri v2 vs Electron 完整对比](https://www.oflight.co.jp/en/columns/tauri-v2-vs-electron-comparison)
- [Tauri vs Electron 性能基准](https://www.levminer.com/blog/tauri-vs-electron)
- [2025 Rust GUI 库调查（boringcactus）](https://www.boringcactus.com/2025/04/13/2025-survey-of-rust-gui-libraries.html)
- [Dioxus 0.6 发布博客](https://dioxuslabs.com/blog/release-060/)
- [Zed 编辑器 GPU 渲染](https://zed.dev/blog/videogame)
- [Zed 的 Rope & SumTree 实现](https://zed.dev/blog/zed-decoded-rope-sumtree)
- [Zed 2025 年度回顾](https://zed.dev/2025)
- [GPUI 深度技术分析](https://beckmoulton.medium.com/gpui-a-technical-overview-of-the-high-performance-rust-ui-framework-powering-zed-ac65975cda9f)
- [cosmic-text GitHub](https://github.com/pop-os/cosmic-text)
- [RaTeX - 纯 Rust KaTeX 兼容数学渲染](https://github.com/erweixin/RaTeX)
- [mmdr - 原生 Rust Mermaid 渲染器](https://www.reddit.com/r/rust/comments/1qkzmpg/mmdr_a_native_rust_mermaid_renderer_5001000x/)
- [Typst PDF 导出](https://typst.app/blog/2025/automated-generation/)
- [Ferrite Markdown 编辑器](https://getferrite.dev/)
- [Otterly - Tauri + Svelte Markdown 编辑器](https://www.reddit.com/r/tauri/comments/1rdf5sy/otterly_a_localfirst_markdown_editor_built_with/)
- [Xi Editor 回顾（Raph Levien）](https://raphlinus.github.io/xi/2020/06/27/xi-retrospective.html)
- [Lapce GitHub](https://github.com/lapce/lapce)
- [pulldown-cmark crates.io](https://crates.io/crates/pulldown-cmark)
- [comrak GitHub](https://github.com/kivikakk/comrak)
- [tree-sitter-markdown 文档](https://docs.rs/tree-sitter-md)
- [syntect GitHub](https://github.com/trishume/syntect/)
- [glyphon - wgpu 文本渲染](https://github.com/grovesNL/glyphon)
- [Typora Electron 版本升级 Issue](https://github.com/typora/typora-issues/issues/6508)
- [Tauri 2.0 官方架构文档](https://v2.tauri.app/concept/architecture/)
- [Iced 官方网站](https://iced.rs/)
- [Slint 官方网站](https://slint.dev/)
