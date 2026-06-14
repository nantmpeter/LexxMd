# AI Citation Jump — Feature Deep Dive

> 扩展自 `notebooklm-feature-research.md` 中的 P0 功能

## 核心概念

AI 回答用户关于文档的问题时，每个关键陈述都附带引用标记（如 `[§2.3]`）。点击引用 → 编辑器自动滚动到对应段落，并短暂高亮目标文本。

类似 NotebookLM 的 "every claim includes a precise quote from the source"，但直接跳转到编辑器内的精确位置。

---

## 已有的技术基础

编辑器已经具备实现此功能的核心能力：

| 能力 | 代码位置 | 证明 |
|---|---|---|
| 遍历文档节点提取结构 | `OutlineView.vue:104-118` | `editor.state.doc.forEach()` 提取 heading |
| Doc offset → 屏幕坐标 | `OutlineView.vue:140-146` | `view.coordsAtPos(offset + 1)` |
| 平滑滚动到任意位置 | `OutlineView.vue:188-204` | `container.scrollTo({ top, behavior: 'smooth' })` |
| 节点偏移量计算 | ProseMirror 内置 | 每个 node 都有确定的 `offset` 位置 |

**结论：OutlineView 里的 `scrollToHeading()` 本质上就是 citation jump 的原型。** 只需扩展到更细粒度（段落/句子级别）并加上高亮效果。

---

## 技术方案

### 1. 文档分块与位置索引

AI 需要知道"文档的哪个位置说了什么"。核心是建立一个 **chunk → ProseMirror position** 的映射。

```typescript
// src/editor/chunker.ts

interface DocChunk {
  id: string            // 如 "h2-1", "p-5", "code-2"
  type: 'heading' | 'paragraph' | 'code' | 'blockquote' | 'list' | 'table'
  level?: number        // heading 级别
  text: string          // 节点文本内容
  from: number          // ProseMirror doc offset (起始)
  to: number            // ProseMirror doc offset (结束)
  heading?: string      // 所属最近的标题文字
}

function buildChunks(editor: Editor): DocChunk[] {
  const doc = editor.state.doc
  const chunks: DocChunk[] = []
  let currentHeading = ''

  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      currentHeading = node.textContent
    }

    // 跳过空节点
    if (node.textContent.trim().length === 0) return

    chunks.push({
      id: `${node.type.name}-${chunks.length}`,
      type: node.type.name as DocChunk['type'],
      level: node.attrs?.level,
      text: node.textContent.slice(0, 500),  // 截断避免 context 过长
      from: offset,
      to: offset + node.nodeSize,
      heading: currentHeading,
    })
  })

  return chunks
}
```

**为什么不用 RAG embedding？** 对于单文档场景（几百到几千字），直接把 chunks 全部发给 LLM 即可，不需要向量检索。RAG 只在跨多文档时才需要。

### 2. Prompt 设计 — 让 AI 返回结构化引用

```
You are answering questions about a document. The document has been split into chunks.

RULES:
1. Every factual claim MUST include a citation: [chunk_id]
2. Use the exact chunk IDs provided
3. If the document doesn't contain the answer, say so

DOCUMENT CHUNKS:
---
id: h2-0 | ## Introduction
text: "This paper explores the intersection of..."

id: p-1 | (under "Introduction")
text: "Previous work by Smith et al. demonstrated that..."

id: p-2 | (under "Introduction")
text: "Our approach differs in three key ways: first..."
---

USER QUESTION: How does this approach differ from previous work?
```

### 3. AI 响应格式

AI 返回的内容需要在 Vue 层解析出引用位置：

```typescript
// AI 响应示例
const aiResponse = `
This approach differs from previous work in three key ways [p-2].

Smith et al. focused on static analysis [p-1], while the current method
uses dynamic tracing [p-2].
`

// 解析引用 → 渲染为可点击组件
interface ParsedCitation {
  chunkId: string
  text: string       // 引用的原文片段
  from: number       // ProseMirror offset
  to: number
}
```

### 4. 前端渲染 — 引用标记

AI 聊天面板中的消息渲染：

```vue
<!-- AIChatMessage.vue -->
<template>
  <div class="ai-message">
    <!-- 将 [chunk_id] 替换为可点击的引用标记 -->
    <component
      v-for="(segment, i) in parsedSegments"
      :key="i"
      :is="segment.type === 'text' ? 'span' : 'button'"
      :class="{ 'citation-tag': segment.type === 'citation' }"
      @click="segment.type === 'citation' && jumpTo(segment.chunk)"
    >
      {{ segment.type === 'text' ? segment.content : segment.chunkId }}
    </component>
  </div>
</template>
```

引用标记样式（参考 VS Code 的 "Go to Definition" 概念）：

```css
.citation-tag {
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
  margin: 0 1px;
  border-radius: 3px;
  font-size: 0.85em;
  font-family: monospace;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.citation-tag:hover {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}
```

### 5. 跳转与高亮

点击引用标记时的完整流程：

```typescript
// src/editor/citation-jump.ts

export function jumpToChunk(
  editor: Editor,
  container: HTMLElement,
  chunk: DocChunk,
) {
  const view = editor.view

  // 1. 滚动到目标位置（复用 OutlineView 的逻辑）
  try {
    const coords = view.coordsAtPos(chunk.from + 1)
    const rect = container.getBoundingClientRect()
    const target = container.scrollTop + (coords.top - rect.top) - rect.height / 3
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  } catch { return }

  // 2. 设置光标到目标位置
  const tr = editor.state.tr.setSelection(
    TextSelection.create(editor.state.doc, chunk.from + 1, chunk.to - 1)
  )
  view.dispatch(tr)

  // 3. 临时高亮效果
  highlightTemporarily(editor, chunk.from, chunk.to, 2000)
}

function highlightTemporarily(
  editor: Editor,
  from: number,
  to: number,
  durationMs: number,
) {
  // 使用 ProseMirror Decoration 添加高亮
  const decoType = Decoration.inline(from, to, {
    class: 'citation-highlight',
  })

  // 创建一个临时 plugin 来持有这个 decoration
  const plugin = new Plugin({
    props: {
      decorations: () => DecorationSet.create(editor.state.doc, [decoType]),
    },
  })

  // 简化方案：直接用 CSS animation
  // 在 style.css 中定义：
  // .citation-highlight {
  //   background: color-mix(in srgb, var(--accent) 20%, transparent);
  //   border-radius: 2px;
  //   animation: citation-fade 2s ease-out forwards;
  // }
  // @keyframes citation-fade {
  //   0% { background: color-mix(in srgb, var(--accent) 35%, transparent); }
  //   100% { background: transparent; }
  // }

  // duration 后移除
  setTimeout(() => {
    // 移除 decoration
  }, durationMs)
}
```

---

## 交互流程图

```
用户在 AI 面板提问
        │
        ▼
  buildChunks(editor)        ← 遍历当前文档，构建 chunk 索引
        │
        ▼
  发送 chunks + question → LLM
        │
        ▼
  LLM 返回带 [chunk_id] 引用的回答
        │
        ▼
  前端解析，将 [chunk_id] 渲染为 <button class="citation-tag">
        │
        ▼
  用户点击引用标记
        │
        ▼
  jumpToChunk()  ──→  scrollTo + setSelection + highlightAnimation
        │
        ▼
  编辑器滚动到目标段落，文字短暂高亮
```

---

## 跨 Tab 场景

当 AI 回答涉及多个打开的文档时：

```typescript
interface CrossDocCitation {
  tabId: string      // 对应 App.vue 中的 FileSlot.id
  chunk: DocChunk
}

// 点击跨文档引用时：
// 1. 切换到目标 tab（已有的 switchTab 逻辑）
// 2. 等待 editor 实例就绪
// 3. 执行 jumpToChunk()
```

---

## 与现有代码的对接点

| 现有代码 | 对接方式 |
|---|---|
| `OutlineView.vue` 的 `scrollToHeading()` | 直接复用滚动逻辑，抽取为共享的 `scrollEditorTo()` 工具函数 |
| `OutlineView.vue` 的 `extractHeadings()` | 扩展为更通用的 `buildChunks()`，提取所有节点类型 |
| `App.vue` 的 `FileSlot[]` 多 Tab 管理 | 跨文档引用需要访问非活跃 tab 的 Editor 实例 |
| `StatusBar.vue` | 显示 AI 状态（thinking / generating / ready） |
| Tiptap Editor 实例 | 通过 `editor.state.tr` 操作选区，通过 `Decoration` API 添加高亮 |

---

## 简化版 MVP（最小可行）

如果先不做 AI 对话面板，可以做一个**手动版的引用跳转**来验证体验：

1. `Cmd+Shift+J` 打开一个 "Jump to..." 面板
2. 输入关键词 → 搜索文档中所有段落
3. 点击搜索结果 → 跳转 + 高亮
4. 这个交互验证了滚动、高亮、选区的完整链路

---

## 扩展方向

- **双向链接**：引用跳转反过来 — 选中编辑器中的文字 → "Ask AI about this"，AI 回答时自动带上该位置作为上下文
- **引用面板**：类似 IDE 的 "Find All References"，列出 AI 对某一段落的所有引用
- **内联批注**：AI 引用不只出现在聊天面板，还能以 comment 形式钉在编辑器右侧
- **版本对比**：引用指向文档的历史版本（diff 高亮）

---

## 参考实现

- **VS Code "Go to Definition"**: 点击 → 跳转 → 高亮行，体验上最接近
- **Notion AI**: 选中文字 → Ask AI，回答基于当前页面内容
- **Obsidian Copilot**: 社区插件，实现了类似的功能但体验较粗糙
- **Cursor IDE**: `Cmd+K` 内联编辑 + `Chat` 面板，引用当前代码上下文
