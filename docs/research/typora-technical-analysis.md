# Typora Markdown 编辑器技术实现深度分析

## 目录

1. [技术栈概览](#1-技术栈概览)
2. [WYSIWYG 渲染管线](#2-wysiwyg-渲染管线)
3. [行内/块级编辑切换机制](#3-行内块级编辑切换机制)
4. [Markdown 解析方案](#4-markdown-解析方案)
5. [实时预览与同步编辑](#5-实时预览与同步编辑)
6. [文件与存储架构](#6-文件与存储架构)
7. [主题与 CSS 样式系统](#7-主题与-css-样式系统)
8. [关键 UI/UX 技术挑战](#8-关键-uiux-技术挑战)
9. [代码语法高亮](#9-代码语法高亮)
10. [数学公式 (LaTeX/KaTeX) 渲染](#10-数学公式-latexkatex-渲染)
11. [导出管线 (PDF, HTML 等)](#11-导出管线-pdf-html-等)
12. [图片、链接与嵌入内容处理](#12-图片链接与嵌入内容处理)
13. [开源替代方案对比](#13-开源替代方案对比)

---

## 1. 技术栈概览

### 核心框架

Typora 基于 **Electron** 构建，利用 Chromium 内核进行渲染，Node.js 进行文件系统访问和原生 API 调用。这使得 Typora 能够跨平台运行于 Windows、macOS 和 Linux。

| 层级 | 技术 |
|------|------|
| **桌面外壳** | Electron |
| **渲染引擎** | Chromium（内嵌于 Electron） |
| **后端/文件系统** | Node.js（通过 Electron 主进程） |
| **编辑表面** | 浏览器 `contenteditable` API |
| **代码编辑器** | CodeMirror（用于代码围栏和 TeX 编辑） |
| **数学渲染** | MathJax 3.x |
| **导出引擎** | Pandoc（非原生格式）+ Chromium 打印（PDF） |
| **图表渲染** | Mermaid.js |
| **源码保护** | app.asar 加密 + JavaScript 混淆 |

### 源码保护机制

Typora 的核心代码打包在 `app.asar` 归档文件中，并经过**重度 JavaScript 混淆**处理：

- **变量/函数名混淆**：将标识符重命名为无意义的短字符串
- **控制流扁平化**：重构代码逻辑以增加逆向难度
- **字符串编码/加密**：对字符串字面量进行编码
- **死代码注入**：添加非功能性代码干扰分析

社区曾出现 `typoraCracker` 等工具（已下架）用于解密 `app.asar`，说明 Typora 采用了自定义加密方案而非标准 Electron 打包。

### 与同类编辑器的对比

| 编辑器 | 框架 | UI 框架 | 编辑引擎 |
|--------|------|---------|----------|
| **Typora** | Electron | 自定义 | 自研 contenteditable |
| **MarkText** | Electron | Vue.js + Vuex | 自研 Muya |
| **Obsidian** | Electron | 自定义 | CodeMirror 6 |
| **Zettlr** | Electron | Vue.js | CodeMirror |

---

## 2. WYSIWYG 渲染管线

### 核心理念："所见即所得"的单面板编辑

Typora 的核心创新在于**消除传统 Markdown 编辑器的预览窗口**。不同于分屏式编辑器（左侧源码，右侧预览），Typora 实现了一种"即时渲染"模式——在单面板中同时呈现源码和渲染结果。

### 渲染管线架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户输入（键盘/鼠标）                    │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Markdown 源文本（Single Source of Truth）       │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Markdown → AST 解析器（实时增量解析）            │
│              - 块级元素：标题、列表、引用、代码块等               │
│              - 行内元素：粗体、斜体、链接、数学公式等             │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AST → DOM 渲染                               │
│              - 块级元素：完整渲染为 HTML                     │
│              - 行内元素：双模态渲染（渲染态/源码态）            │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│         contenteditable 容器（Chromium DOM）              │
│         - 每个块是一个独立的 DOM 节点                       │
│         - 光标所在的块显示为 Markdown 源码                   │
│         - 其他块显示为渲染后的 HTML                          │
└─────────────────────────────────────────────────────────┘
```

### 双模态渲染机制

Typora 的关键"魔法"在于**逐块切换**渲染模式：

1. **当光标离开某个块时**：该块从 Markdown 源码转换为渲染后的 HTML
2. **当光标进入某个块时**：该块从渲染后的 HTML 还原为 Markdown 源码
3. **行内格式**（如 `**粗体**`）：当光标在该行时显示 Markdown 语法符号；离开后隐藏符号，仅显示渲染效果

这种设计使用户**始终在编辑 Markdown 源文本**，但视觉上**几乎只看到渲染结果**。

---

## 3. 行内/块级编辑切换机制

### 块级切换（Block-level Switching）

```
状态 A：光标不在该块 → 渲染模式
┌──────────────────────────┐
│  ## 这是一个标题           │  →  <h2>这是一个标题</h2>
│  **粗体文字**              │  →  <p><strong>粗体文字</strong></p>
│  - 列表项 1               │  →  <ul><li>列表项 1</li></ul>
└──────────────────────────┘

状态 B：光标移入该块 → 源码模式
┌──────────────────────────┐
│  ## 这是^一个标题          │  ← 显示 ## 标记
│  **粗体^文字**             │  ← 显示 ** 标记
│  - 列表^项 1              │  ← 显示 - 标记
└──────────────────────────┘
```

### 切换实现原理

每个块在 DOM 中有两种表示形式：

| 状态 | DOM 结构 | 说明 |
|------|---------|------|
| **渲染态** | 完整的 HTML 元素（如 `<h2>`、`<pre><code>`） | 非编辑状态下的展示形式 |
| **编辑态** | 包含原始 Markdown 的可编辑区域 | 焦点进入时切换至此 |

切换过程：

1. **进入编辑（focus/blur 事件）**：
   - 捕获光标所在的块节点
   - 用该块对应的 Markdown 源文本替换渲染后的 DOM
   - 将光标定位到源文本中的正确位置

2. **退出编辑（blur 事件）**：
   - 获取编辑后的 Markdown 源文本
   - 重新解析该块为 AST 节点
   - 渲染 AST 节点为 HTML DOM
   - 替换编辑态 DOM 为渲染态 DOM

3. **行内格式切换**：
   - 行内元素（粗体、斜体、链接等）在光标所在行**显示语法标记**
   - 光标离开该行后**隐藏语法标记**，仅显示渲染效果
   - 这通过 CSS 类名切换和 DOM 属性修改实现

### 代码块的特殊处理

代码围栏（Code Fence）是特殊的块级元素：

- **编辑态**：使用 CodeMirror 实例提供完整的代码编辑体验（语法高亮、行号、自动缩进等）
- **渲染态**：显示为带语法高亮的代码块
- **语言选择**：代码块右下角有语言选择控件

---

## 4. Markdown 解析方案

### 解析器特征

Typora 使用**自研的 Markdown 解析器**，而非直接使用开源库。依据如下：

1. **解析行为独特**：GitHub 上存在 [typora-parser](https://github.com/PegasisForever/typora-parser) 项目，专门用于复现 Typora 的 Markdown 解析行为，说明 Typora 的解析规则与标准 CommonMark 存在差异
2. **支持多种规范**：
   - CommonMark 基础规范
   - GitHub Flavored Markdown (GFM) 扩展
   - 自定义扩展（如数学公式、Mermaid 图表、YAML Front Matter）
3. **增量解析**：仅重新解析发生变更的块，而非整个文档

### 解析流程

```
Markdown 文本
    │
    ▼
┌─────────────────────┐
│  块级解析            │  识别文档结构：标题、段落、列表、
│  (Block Parsing)    │  代码块、引用、表格等
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  行内解析            │  识别行内元素：粗体、斜体、链接、
│  (Inline Parsing)   │  图片、行内代码、数学公式等
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  AST（抽象语法树）    │  树形数据结构，表示文档的
│                     │  逻辑结构和语义
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  DOM 渲染            │  将 AST 转换为 HTML DOM 节点
│  (DOM Rendering)    │  插入到 contenteditable 容器中
└─────────────────────┘
```

### Typora 的 Markdown 扩展

| 功能 | 语法 |
|------|------|
| 数学公式 | `$...$`（行内）、`$$...$$`（块级） |
| Mermaid 图表 | ` ```mermaid ` 代码块 |
| YAML Front Matter | `---` 包裹的 YAML 头部 |
| 下标/上标 | `~下标~`、`^上标^` |
| 高亮 | `==高亮==` |
| 目录 | `[toc]` |
| 脚注 | `[^1]` 和 `[^1]: 定义` |

---

## 5. 实时预览与同步编辑

### 单一数据源模型

Typora 的设计哲学是 **Markdown 源文本是唯一的 Single Source of Truth**：

```
                    Markdown 源文本
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         编辑视图     大纲视图    导出输出
         (content-    (侧边栏    (PDF/HTML/
         editable)    树形结构)    DOCX等)
```

- 渲染后的视图是**派生的**，不是独立的存储
- 任何编辑都直接作用于底层 Markdown 文本
- 这确保了 **无损往返（lossless round-trip）**——渲染和编辑之间不会丢失信息

### 性能优化策略

1. **逐块重渲染**：只在光标离开某个块时才重新解析和渲染该块，而非整个文档
2. **延迟渲染**：数学公式和图表等复杂元素采用延迟加载
3. **虚拟化/懒渲染**：对于长文档，只渲染可视区域附近的块
4. **防抖处理**：快速输入时不会每次按键都触发完整重解析

### 源码模式（Source Mode）

Typora 还提供完整的源码模式（`View → Source Code Mode`），在此模式下：

- 切换为纯文本编辑器视图
- 使用类似 CodeMirror 的编辑器组件
- 可以直接查看和编辑完整 Markdown 源码
- 切换回预览模式时会重新解析整个文档

---

## 6. 文件与存储架构

### 文件模型

| 特性 | 说明 |
|------|------|
| **文件格式** | 纯文本 `.md` 文件，标准 Markdown 格式 |
| **存储方式** | 直接读写本地文件系统 |
| **多标签页** | 每个标签页对应一个文件 |
| **自动保存** | 编辑后自动写入磁盘 |
| **文件监控** | 监控外部修改，提示冲突处理 |
| **历史记录** | 支持文件版本历史和撤销/重做 |

### 侧边栏结构

```
┌─────────────────────────────────────────┐
│  侧边栏                                   │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  文件树       │  │  大纲视图         │   │
│  │  (File Tree) │  │  (Outline)      │   │
│  │              │  │                 │   │
│  │  ├── docs/   │  │  1. 第一章       │   │
│  │  │   ├── a.md│  │    1.1 第一节    │   │
│  │  │   └── b.md│  │    1.2 第二节    │   │
│  │  └── img/    │  │  2. 第二章       │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
```

### 配置文件

- **全局配置**：`~/.config/Typora/conf/conf.user.json`（Linux/macOS）
- **主题文件夹**：`~/.config/Typora/themes/` 或对应平台路径
- **偏好设置**：通过 GUI 管理，存储在本地配置文件中

---

## 7. 主题与 CSS 样式系统

### 核心架构

> "Typora 使用 CSS 来控制一切样式。" —— [Typora 官方文档](https://support.typora.io/About-Themes/)

Typora 的整个 UI 都是使用 CSS 渲染的，这意味着：

- 每个 Markdown 元素（标题、段落、列表、代码块等）都有对应的 CSS 选择器
- 主题本质上就是一个 CSS 文件
- 用户可以通过 CSS 完全自定义编辑器外观

### 主题文件结构

```
Typora 主题文件夹/
├── github.css              ← 基础主题样式
├── github.user.css         ← 用户自定义覆盖（自动加载）
├── newsprint.css
├── night.css
├── pixyll.css
├── whitey.css
└── ...
```

### 主题加载机制

1. **基础主题加载**：加载 `[theme-name].css`
2. **用户覆盖加载**：自动加载 `[theme-name].user.css`（在基础主题之后）
3. **选择器优先级**：用户 CSS 在基础主题之后加载，因此可通过 CSS 优先级规则覆盖

### 关键 CSS 类名

| 元素 | CSS 类名/选择器 | 说明 |
|------|----------------|------|
| 代码块 | `.cm-s-inner` | CodeMirror 主题类 |
| 行内代码 | `code` | 行内代码元素 |
| 数学公式 | `.math-inline`, `.math-block` | 行内/块级数学公式 |
| 表格 | `table`, `thead`, `tbody` | 表格相关元素 |
| 引用 | `blockquote` | 引用块 |
| 任务列表 | `.task-list` | 任务列表 |
| YAML 头部 | `.front-matter` | YAML Front Matter |
| 大纲 | `.outline-content` | 大纲面板 |
| 侧边栏 | `.sidebar` | 侧边栏 |

### 打印/导出样式

```css
@media print {
    /* 自定义 PDF 导出/打印样式 */
    /* 可在用户 CSS 中覆盖 */
}
```

---

## 8. 关键 UI/UX 技术挑战

### 挑战 1：光标位置保持

**问题**：在渲染态和源码态之间切换时，光标位置必须准确保持。

**Typora 的方案**：
- 维护一个从 Markdown 源文本偏移量到 DOM 节点位置的映射
- 切换时根据映射关系精确定位光标
- 处理嵌套结构（如列表中的代码块）的复杂映射

### 挑战 2：性能与长文档

**问题**：频繁的 DOM 操作导致长文档性能下降。

**Typora 的方案**：
- 逐块渲染而非全文档渲染
- 延迟加载复杂元素（数学公式、图表）
- 使用增量解析减少不必要的重计算

### 挑战 3：无损往返转换

**问题**：渲染态 → 源码态 → 渲染态的转换不能丢失任何信息。

**Typora 的方案**：
- 始终以 Markdown 源文本为 Single Source of Truth
- 渲染态仅作为展示层，不存储额外数据
- 保持原始 Markdown 的空格、换行、空白行等格式信息

### 挑战 4：表格编辑

**问题**：Markdown 表格源码难以直接编辑。

**Typora 的方案**：
- 光标在表格内时，显示为可视化的表格编辑界面
- 可以直接添加/删除行列
- 底层仍然维护纯文本 Markdown 表格格式

### 挑战 5：数学公式编辑

**问题**：LaTeX 语法复杂，实时预览困难。

**Typora 的方案**：
- 光标在公式内时显示 LaTeX 源码
- 光标离开时渲染为数学排版
- 支持行内公式（`$...$`）和块级公式（`$$...$$`）
- 类似于块级切换的双模态渲染

---

## 9. 代码语法高亮

### CodeMirror 集成

Typora 使用 **CodeMirror** 作为代码围栏的编辑和高亮引擎。

| 方面 | 详情 |
|------|------|
| **编辑器** | CodeMirror 实例嵌入每个代码围栏块 |
| **主题类名** | `.cm-s-inner`（Typora 内部主题类） |
| **语言支持** | 依赖 CodeMirror 的语言模式（Mode）系统 |
| **功能** | 语法高亮、行号、自动缩进、括号匹配 |

### 语言支持

- 基础语言：JavaScript, Python, Java, C/C++, HTML, CSS, SQL 等
- 扩展语言：通过 CodeMirror 的语言模式扩展
- 自定义语言：用户可请求添加新语言支持（参考 [Typora 官方文档](https://support.typora.io/Code-Fences-Language-Support/)）

### 导出时的高亮

在导出 HTML 或 PDF 时，Typora 使用 **Highlight.js** 进行语法高亮渲染，这与编辑时使用的 CodeMirror 是**独立的**两套系统：

| 场景 | 高亮引擎 |
|------|---------|
| **编辑时** | CodeMirror（实时交互） |
| **导出时** | Highlight.js（静态渲染） |

---

## 10. 数学公式 (LaTeX/KaTeX) 渲染

### 渲染引擎

Typora 使用 **MathJax** 作为数学公式渲染引擎（从 0.11 版本起升级到 MathJax 3.2）。

| 特性 | 详情 |
|------|------|
| **渲染引擎** | MathJax 3.x（不是 KaTeX） |
| **输出格式** | SVG（默认） |
| **行内公式** | `$...$` 分隔符 |
| **块级公式** | `$$...$$` 分隔符 |
| **自动编号** | 支持 AMS 编号规则（Typora 1.4+） |
| **分隔符配置** | 可通过 `conf.user.json` 自定义 |

### 配置选项

```json
// ~/.config/Typora/conf/conf.user.json
{
  "mathRenderingOptions": {
    "mathJaxRenderingOptions": {
      "delimiters": [
        { "left": "$$", "right": "$$", "display": true },
        { "left": "$", "right": "$", "display": false }
      ]
    }
  }
}
```

### 编辑体验

1. **输入状态**：显示 LaTeX 源码（如 `$E = mc^2$`）
2. **预览状态**：渲染为排版的数学公式
3. **切换触发**：光标进入公式区域时切换为源码，离开时渲染

### 与 Pandoc 导出的集成

导出为 Word/LaTeX 等格式时，数学公式通过 Pandoc 原生处理，确保公式在目标格式中正确渲染。

---

## 11. 导出管线 (PDF, HTML 等)

### 导出架构总览

```
                    Markdown 源文本
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────────┐
   │ 原生导出     │ │ Pandoc   │ │ 自定义命令    │
   │ (Chromium)  │ │ 管线     │ │ (Custom Cmd) │
   └──────┬──────┘ └────┬─────┘ └──────┬───────┘
          │             │              │
          ▼             ▼              ▼
   PDF / HTML /    DOCX / EPUB /   任意格式
   Image (PNG)     LaTeX / RTF /   (用户定义)
                   ODT / RST ...
```

### 原生导出（不依赖 Pandoc）

| 格式 | 实现方式 | 说明 |
|------|---------|------|
| **PDF** | Chromium 打印 API | 基于 HTML 渲染后打印为 PDF |
| **HTML** | 直接导出渲染后的 HTML | 包含 CSS 样式 |
| **HTML（无样式）** | 纯 HTML | 不包含 CSS，供自定义使用 |
| **Image** | 屏幕截图 | 导出为 PNG 图片 |

### Pandoc 导出管线

对于 PDF 之外的其他格式，Typora 的导出流程为：

```
Markdown → Typora AST → Pandoc Native AST → 目标格式
```

关键细节：
1. Typora **不是直接**将 Markdown 传给 Pandoc
2. 而是先将文档转换为 **Pandoc 的内部 AST（native 格式）**
3. 再通过 Pandoc 转换为目标格式
4. 这确保了 Typora 的解析规则与 Pandoc 输出一致

### PDF 导出的详细流程

```
Markdown 源文本
    │
    ▼
Typora AST 解析
    │
    ▼
生成 HTML（应用主题 CSS）
    │
    ▼
追加自定义内容（Header/Footer/封面）
    │
    ▼
Chromium 打印渲染
    │
    ▼
PDF 输出
```

PDF 导出支持的特性：
- 纸张大小和边距配置
- 自定义页眉/页脚（支持 `${title}`、`${pageNo}` 等变量）
- YAML Front Matter 中的 PDF 元数据
- 自定义 CSS 打印样式
- 页面分隔符

### 导出自定义

Typora 支持三种自定义导出方式：

1. **基于 Pandoc 模板**：添加新的 Pandoc 导出项，指定格式和参数
2. **自定义命令**：执行任意 shell 命令，如 `pandoc "${currentPath}" -o "${outputPath}"`
3. **自定义内容注入**：在 HTML/PDF 导出中追加自定义 HTML/CSS/JS

---

## 12. 图片、链接与嵌入内容处理

### 图片处理架构

#### 图片插入方式

| 方式 | 行为 |
|------|------|
| **拖放** | 自动复制到指定文件夹并插入引用 |
| **粘贴** | 自动复制到指定文件夹并插入引用 |
| **Markdown 语法** | `![alt](path)` 手动输入 |
| **上传** | 通过自定义命令或 PicGo 上传到 CDN |

#### 图片存储策略

Typora 提供灵活的图片存储配置：

```
偏好设置 → 图片：
├── 插入图片时：
│   ├── 复制到当前文件夹（./）
│   ├── 复制到 ./assets 子文件夹
│   ├── 复制到 ./${filename}.assets 子文件夹
│   ├── 复制到指定文件夹
│   ├── 上传到图床（PicGo/自定义命令）
│   └── 仅插入引用路径
├── ☑ 尽可能使用相对路径
├── ☑ 对行内图片也应用上述规则
└── ☑ 自动上传（粘贴时自动上传）
```

#### 图片上传集成

Typora 支持多种图片上传方案：

| 方案 | 说明 |
|------|------|
| **PicGo** | 原生支持，配置 PicGo 路径即可 |
| **自定义命令** | 通过脚本上传到 S3、腾讯 COS、七牛等 |
| **iPic/uPic** | macOS 专用图床工具 |

上传脚本接收图片路径作为参数，输出图片 URL：

```bash
# 示例：自定义上传命令
/Users/user/.local/bin/upload-image "$IMAGE_PATH"
# 输出：https://cdn.example.com/images/abc123.png
```

### 链接处理

- **内部链接**：`[text](path/to/file.md)`，支持点击跳转到其他 Markdown 文件
- **外部链接**：标准 URL，在编辑器内打开或在浏览器中打开
- **锚点链接**：`#heading` 支持跳转到文档内标题

### 嵌入内容

| 内容类型 | 实现方式 |
|----------|---------|
| **视频/音频** | HTML `<video>`/`<audio>` 标签 |
| **iframe** | 支持 HTML iframe 嵌入 |
| **Mermaid 图表** | ` ```mermaid ` 代码块，通过 Mermaid.js 渲染 |
| **Flowchart** | 类似 Mermaid 的流程图支持 |
| **Sequence 图** | 序列图支持 |

---

## 13. 开源替代方案对比

### 主要开源替代品

#### 1. MarkText（最接近 Typora 的开源克隆）

**GitHub**: [marktext/marktext](https://github.com/marktext/marktext)

| 方面 | 详情 |
|------|------|
| **框架** | Electron |
| **UI** | Vue.js + Vuex |
| **编辑核心** | 自研 **Muya** 引擎 |
| **源码编辑** | CodeMirror |
| **许可证** | MIT |
| **状态** | 已停止维护 |

**Muya 架构**（来自 MarkText 的 ARCHITECTURE.md）：

```
MarkText
├── main/          ← Electron 主进程（IO、原生对话框）
├── renderer/      ← 渲染进程（Vue UI、编辑器宿主）
│   ├── components/  ← Vue 组件
│   └── store/       ← Vuex 状态管理
├── muya/          ← 编辑核心引擎（纯 JS，仅 BOM/DOM API）
│   ├── parser/      ← Markdown 解析
│   ├── block/       ← 块级元素管理
│   ├── inline/      ← 行内元素管理
│   ├── event/       ← 事件监听
│   └── export/      ← HTML/Markdown 导出
└── common/        ← 共享代码（仅 Node.js API）
```

Muya 的设计约束：
- **纯 JavaScript**：仅使用 BOM 和 DOM API
- **不使用** Electron 或 Node.js API
- **单线程**：使用异步函数提升性能
- **块结构**：基于块的数据结构表示文档

#### 2. Milkdown（Web 端 Typora 替代）

**GitHub**: [Milkdown/milkdown](https://github.com/Milkdown/milkdown)

| 方面 | 详情 |
|------|------|
| **编辑引擎** | ProseMirror |
| **Markdown 解析** | Remark（unified 生态） |
| **架构模式** | 插件驱动、无头 UI |
| **许可证** | MIT |
| **状态** | 活跃维护 |

架构特点：
- ProseMirror 提供 rich-text 编辑框架（Schema、State、Transaction）
- Remark 负责 Markdown 解析和序列化
- 插件系统桥接 ProseMirror ↔ Remark，实现双向转换
- 无头 UI 设计，可集成到任意前端框架

#### 3. Vditor（浏览器端 Typora 替代）

**GitHub**: [Vanessa219/vditor](https://github.com/Vanessa219/vditor)

| 方面 | 详情 |
|------|------|
| **语言** | JavaScript/TypeScript |
| **模式** | WYSIWYG / 即时渲染 / 分屏预览 |
| **架构** | 基于 contenteditable API |
| **许可证** | MIT |
| **状态** | 活跃维护 |

#### 4. Cherry Markdown（腾讯出品）

**GitHub**: [Tencent/cherry-markdown](https://github.com/Tencent/cherry-markdown)

| 方面 | 详情 |
|------|------|
| **特点** | 支持图表、数学公式等多种扩展 |
| **架构** | 浏览器端 WYSIWYG |
| **许可证** | Apache 2.0 |

### 技术方案对比

| 特性 | Typora | MarkText | Milkdown | Vditor |
|------|--------|----------|----------|--------|
| **平台** | 桌面 | 桌面 | Web | Web |
| **编辑引擎** | 自研 | Muya | ProseMirror | 自研 |
| **Markdown 解析** | 自研 | 自研 | Remark | 自研 |
| **WYSIWYG** | 逐块切换 | 逐块切换 | 插件驱动 | contenteditable |
| **插件系统** | 无 | 无 | 有 | 有限 |
| **维护状态** | 活跃 | 停止 | 活跃 | 活跃 |
| **开源** | 否 | 是 | 是 | 是 |

### 构建 Typora 风格编辑器的推荐技术栈

如果要从零开始构建类似的编辑器，推荐方案：

```
编辑引擎：ProseMirror / Lexical
Markdown 解析：unified (remark) 生态
代码高亮：CodeMirror 6 / Prism.js
数学渲染：KaTeX（速度快）/ MathJax 3（功能全）
图表渲染：Mermaid.js
桌面框架：Electron / Tauri
状态管理：编辑器自带（ProseMirror State）
```

---

## 参考资源

### 官方文档
- [Typora 官网](https://typora.io/)
- [Typora 支持文档](https://support.typora.io/)
- [关于主题](https://support.typora.io/About-Themes/)
- [编写自定义主题](https://theme.typora.io/doc/Write-Custom-Theme/)
- [代码围栏语言支持](https://support.typora.io/Code-Fences-Language-Support/)
- [代码块样式](https://support.typora.io/Code-Block-Styles/)
- [数学公式支持](https://support.typora.io/Math/)
- [导出功能](https://support.typora.io/Export/)
- [安装和使用 Pandoc](https://support.typora.io/Install-and-Use-Pandoc/)
- [上传图片](https://support.typora.io/Upload-Image/)

### 技术分析
- [Reddit: 逆向工程 Typora 激活机制](https://www.reddit.com/r/ReverseEngineering/comments/u7e6d3/reverse_engineering_typora_activation/)
- [typora-parser: 复现 Typora 的 Markdown 解析行为](https://github.com/PegasisForever/typora-parser)
- [ProseMirror 论坛: 复现 Typora 的数学公式编辑](https://discuss.prosemirror.net/t/replicating-typoras-inline-display-math-editing/2906/7)
- [Obsidian 论坛: 讨论 Typora 风格编辑模式的实现难度](https://forum.obsidian.md/t/a-typora-like-editing-mode-edit-and-preview-at-the-same-time/1953)
- [Stack Overflow: 保护 Electron app.asar](https://stackoverflow.com/questions/78158844/how-to-protect-app-asar-file-after-building-my-electron-app)

### 开源替代品
- [MarkText 架构文档](https://github.com/marktext/marktext/blob/develop/docs/dev/ARCHITECTURE.md)
- [Milkdown](https://github.com/Milkdown/milkdown)
- [Vditor](https://github.com/Vanessa219/vditor)
- [Cherry Markdown](https://github.com/Tencent/cherry-markdown)
- [Evoldown](https://discuss.prosemirror.net/t/a-typora-like-extended-markdown-editor-called-evoldown/6049)

### 其他资源
- [LogRocket: Milkdown 与其他 WYSIWYG 编辑器对比](https://blog.logrocket.com/comparing-milkdown-other-wysiwyg-editors/)
- [Liveblocks: 2025 年富文本编辑器框架选择](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
- [Typora 主题开发工具包](https://theme.typora.io/doc/Write-Custom-Theme/)
