# AI Feature System Design — mdeditor

> Date: 2026-04-17
> Status: Draft

## Overview

为 mdeditor 添加本地 AI 辅助功能体系，基于内嵌 llama.cpp + Gemma 4 开源模型，提供文档问答（带引用跳转）、智能摘要、行内 AI 编辑、基础写作辅助四大功能。UI 采用浮动面板模式（Cmd+K / Cmd+L）。

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| AI 后端 | 内嵌 llama.cpp (Rust) | 离线可用，隐私优先 |
| 模型 | Gemma 4 E4B Q4（默认）/ E2B Q4（轻量） | 128K 上下文，原生 system prompt 支持 |
| 架构 | Rust 全管（推理 + prompt + 分块 + 引用解析） | 前端极简，IPC 接口干净 |
| UI 形态 | 浮动面板 | 不占固定空间，Cmd+K 行内编辑 / Cmd+L Chat |
| 后期扩展 | 架构预留 trait 抽象，可替换为云端 API | 不堵死后续升级 |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Tauri App                            │
│                                                             │
│  ┌─ Frontend (Vue 3) ─────────────────────────────────┐    │
│  │                                                     │    │
│  │  ┌─────────────────────────┐  ┌──────────────────┐ │    │
│  │  │                         │  │                  │ │    │
│  │  │    Editor (Tiptap)      │  │  Floating AI    │ │    │
│  │  │                         │  │  Panel (Cmd+L)  │ │    │
│  │  │  ┌─ Citation ────────┐  │  │                  │ │    │
│  │  │  │  Highlight Deco   │  │  │  Chat messages  │ │    │
│  │  │  │  (ProseMirror)    │  │  │  Citation pills │ │    │
│  │  │  └──────────────────┘  │  │  Hover previews │ │    │
│  │  │                        │  │                  │ │    │
│  │  │  ┌─ Inline AI ──────┐  │  └──────────────────┘ │    │
│  │  │  │  Cmd+K popup     │  │                       │    │
│  │  │  │  (floating)      │  │  ┌──────────────────┐ │    │
│  │  │  └──────────────────┘  │  │  StatusBar       │ │    │
│  │  │                        │  │  (AI status)     │ │    │
│  │  └─────────────────────────┘  └──────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │ IPC                               │
│  ┌─ Rust Backend ──────────────────────────────────────┐    │
│  │                                                      │    │
│  │  ┌─ AI Module ────────────────────────────────────┐ │    │
│  │  │                                                 │ │    │
│  │  │  ┌──────────────┐  ┌────────────────────────┐  │ │    │
│  │  │  │ Model Manager│  │ Prompt Engine           │  │ │    │
│  │  │  │ - load GGUF  │  │ - chunk_doc()           │  │ │    │
│  │  │  │ - unload     │  │ - build_chat_prompt()   │  │ │    │
│  │  │  │ - stream gen │  │ - build_summary_prompt()│  │ │    │
│  │  │  │              │  │ - build_edit_prompt()   │  │ │    │
│  │  │  │              │  │ - build_assist_prompt() │  │ │    │
│  │  │  │              │  │ - parse_citations()     │  │ │    │
│  │  │  └──────┬───────┘  └───────────┬────────────┘  │ │    │
│  │  │         │                       ↓               │ │    │
│  │  │  ┌──────────────────────────────────────────┐   │ │    │
│  │  │  │       llama.cpp (GGUF inference)          │   │ │    │
│  │  │  │  - Gemma 4 E4B Q4 (default)              │   │ │    │
│  │  │  │  - stream tokens via channel              │   │ │    │
│  │  │  └──────────────────────────────────────────┘   │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Frontend 职责

- 浮动 Chat 面板（Cmd+L）、行内 AI 编辑浮框（Cmd+K）、摘要面板（Cmd+Shift+S）
- 引用标记渲染（pill）+ hover tooltip + click 跳转
- ProseMirror Decoration 临时高亮（citation-highlight plugin）
- StatusBar AI 模型状态指示

### Rust Backend 职责

- ModelManager：GGUF 模型加载/释放/推理/流式输出
- PromptEngine：文档分块（chunk_doc）、4 种 prompt 模板、引用标记解析（parse_citations）
- llama.cpp 推理：stream token 回前端

### Streaming Protocol

```
Rust 推理线程              IPC Events              Frontend
─────────────              ──────────              ─────────
token 生成 ──────→ emit("ai:token", "Hello") ───→ 拼接到当前消息
token 生成 ──────→ emit("ai:token", " world") ──→ 拼接
...
生成完毕 ────────→ emit("ai:done", {           → 最终化消息，渲染
                      citations: [...],           citation pills
                      full_text: "..."
                    })
```

## IPC Interface

```rust
// src-tauri/src/commands/ai.rs

#[tauri::command]
async fn ai_load_model(path: String) -> Result<(), String>

#[tauri::command]
async fn ai_unload_model() -> Result<(), String>

#[tauri::command]
async fn ai_model_status() -> Result<AiConfig, String>

#[tauri::command]
async fn ai_chat(
    app: AppHandle,
    doc_content: String,
    question: String,
    history: Vec<ChatMessage>,
) -> Result<(), String>
// Stream via app.emit("ai:token", ...) + app.emit("ai:done", ...)

#[tauri::command]
async fn ai_summarize(
    app: AppHandle,
    doc_content: String,
    mode: String, // "summary" | "outline" | "key_points"
) -> Result<(), String>
// Stream via events

#[tauri::command]
async fn ai_edit(
    selected_text: String,
    instruction: String,
    context: String,
) -> Result<AiEditResult, String>

#[tauri::command]
async fn ai_assist(
    text: String,
    mode: String, // "grammar" | "spelling" | "style"
    context: String,
) -> Result<Vec<AssistSuggestion>, String>
```

## Data Types

### TypeScript

```typescript
// src/types.ts additions

interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: AiCitation[]
}

interface AiCitation {
  id: number
  chunkIndex: number
  from: number    // ProseMirror doc offset
  to: number
  preview: string  // hover preview text, first 150 chars
  heading?: string
}

type SummaryMode = 'summary' | 'outline' | 'key_points'
type AssistMode = 'grammar' | 'spelling' | 'style'

interface AiEditResult {
  original: string
  replacement: string
}

interface AiConfig {
  modelPath: string | null
  modelName: string
  loaded: boolean
  contextSize: number
}
```

### Rust

```rust
// src-tauri/src/ai/types.rs

struct ChatMessage {
    role: String,
    content: String,
}

struct DocChunk {
    index: usize,
    text: String,
    heading: Option<String>,
    byte_offset: usize,
    byte_length: usize,
}

struct Citation {
    id: usize,
    chunk_index: usize,
    preview: String,
    heading: Option<String>,
}

struct AiEditResult {
    original: String,
    replacement: String,
}

struct AssistSuggestion {
    original: String,
    suggestion: String,
    reason: String,
    offset: usize,
    length: usize,
}

struct AiConfig {
    model_path: Option<String>,
    model_name: String,
    loaded: bool,
    context_size: usize,
}
```

## UI Design

### Cmd+L — Floating Chat

- 居中偏右浮动窗口，可拖拽，Esc 关闭
- 消息列表 + 底部输入框
- AI 回复中的引用标记渲染为可交互 pill
- 当前文档的对话历史保存在内存，关闭文档时清空

### Cmd+K — Inline AI Edit

- 选中文本后按 Cmd+K：弹出浮动输入框（位于选区上方）
- AI 生成后显示 diff 预览（删除线 + 绿色新增）
- Accept (Enter) / Reject (Esc) / Regenerate
- 无选中文本时：在光标位置弹出，AI 可续写/插入

### Citation Interaction

Two-layer interaction (inspired by NotebookLM):

1. **Hover** → tooltip 显示被引用的原文片段（direct quote）+ 所属标题
2. **Click** → 编辑器滚动到目标段落 + accent color 高亮（2.5s 渐隐动画）

Citation pill visual spec:
- 圆角药丸形，accent 色 12% 透明度背景
- 10px monospace 数字
- 最小 18x18px
- hover 加深到 25%，active 有 scale(0.95) 按压感

### Cmd+Shift+S — Summary Panel

- 弹出模式选择：Summary / Outline / Key Points
- AI 流式生成结果
- "Open as New Tab" 在编辑器中打开结果为新 md 文件
- "Copy" 复制到剪贴板

### Writing Assist

- 右键菜单 AI 子菜单：Check Grammar / Improve Style / Fix Spelling
- 或选中文字后浮动 AI 小按钮
- 结果以 inline diff 或 suggestion list 呈现

## File Structure

### New Files

```
src/
  ai/
    chat-panel.vue            # Floating Chat window (Cmd+L)
    inline-edit.vue           # Inline edit popup (Cmd+K)
    summary-panel.vue         # Summary/outline generation
    citation-tag.vue          # Citation pill + hover tooltip
    ai-composables.ts         # useAiChat, useAiEdit, useAiSummary, useAiAssist, useAiModel
  editor/
    extensions/
      citation-highlight.ts   # ProseMirror plugin: temporary highlight decorations

src-tauri/
  src/
    ai/
      mod.rs                  # Module entry
      model.rs                # ModelManager: GGUF load/unload/inference
      prompt.rs               # PromptEngine: chunk_doc, templates, parse_citations
      types.rs                # Rust data structures
    commands/
      ai.rs                   # Tauri command handlers
```

### Modified Files

```
src/types.ts                  # +AiMessage, AiCitation, AiConfig, etc.
src/App.vue                   # +快捷键, AI state, 挂载浮窗
src/editor/style.css          # +citation pill/highlight CSS
src/tauri/commands.ts         # +AI IPC wrappers
src/ui/StatusBar.vue          # +AI model status
src-tauri/src/commands/mod.rs # +pub mod ai
src-tauri/src/lib.rs          # +register AI commands
src-tauri/Cargo.toml          # +llama-cpp-rs dependency
```

## Composables API

```typescript
// src/ai/ai-composables.ts

function useAiModel() {
  // reactive: config { modelPath, modelName, loaded, contextSize }
  // loadModel(path: string)
  // unloadModel()
  // checkStatus()
}

function useAiChat(editor: Ref<Editor | null>) {
  // reactive: messages: AiMessage[]
  // reactive: streaming: boolean
  // reactive: generating: boolean
  // send(question: string)   — serializes doc, calls ai_chat, listens for stream events
  // clearHistory()
}

function useAiEdit() {
  // reactive: state: 'idle' | 'input' | 'generating' | 'preview'
  // reactive: result: AiEditResult | null
  // edit(selectedText, instruction, context)
  // accept()  — replace editor selection with result.replacement
  // reject()  — restore original
}

function useAiSummary() {
  // reactive: state: 'idle' | 'generating' | 'done'
  // reactive: result: string
  // generate(docContent, mode)
  // openAsNewTab()
}

function useAiAssist() {
  // check(text, mode, context) → AssistSuggestion[]
  // applySuggestion(suggestion) — replace text in editor
}
```

## Citation Jump — Core Mechanism

The editor already has the building blocks from OutlineView.vue:

- `editor.state.doc.forEach()` — traverse document nodes
- `view.coordsAtPos(offset)` — map doc offset to screen coordinates
- `container.scrollTo()` — smooth scroll to position
- ProseMirror `Decoration` API — used by dual-mode.ts, reusable for highlights

### New: citation-highlight.ts

```typescript
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey('citation-highlight')

export function createCitationHighlightPlugin() {
  return new Plugin({
    key,
    state: {
      init: () => ({ deco: null as Decoration | null }),
      apply: (tr, v) => v,
    },
    props: {
      decorations: (state) => {
        const { deco } = key.getState(state)
        return deco
          ? DecorationSet.create(state.doc, [deco])
          : DecorationSet.empty
      },
    },
  })
}

export function highlightRange(editor: Editor, from: number, to: number) {
  // 1. Create inline Decoration with class 'citation-highlight citation-highlight-fading'
  // 2. Update plugin state
  // 3. Scroll editor to position (reuse OutlineView's scroll logic)
  // 4. Remove decoration after 2.5s
}
```

### CSS

```css
.citation-highlight {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 2px;
  box-decoration-break: clone;
}

.citation-highlight-fading {
  animation: citation-fade 2.5s ease-out forwards;
}

@keyframes citation-fade {
  0%   { background: color-mix(in srgb, var(--accent) 30%, transparent); }
  70%  { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  100% { background: transparent; }
}
```

## Model Selection

| Model | Effective Params | Q4 Memory | Context | Use Case |
|---|---|---|---|---|
| **Gemma 4 E2B** | 2B | ~3.2 GB | 128K | Spelling, basic grammar (8GB RAM machines) |
| **Gemma 4 E4B** | 4B | ~5 GB | 128K | Q&A, citations, summary, inline edit (default) |
| Gemma 4 26B A4B | 26B (4B active) | ~15.6 GB | 256K | High-quality suggestions (enthusiast machines) |

Default: **Gemma 4 E4B Q4**. User can configure model path in settings. First-time use guides download.

## Phased Implementation

### Phase 0: Rust AI Infrastructure

- Add llama-cpp-rs to Cargo.toml
- Implement ai/model.rs: GGUF load/unload/stream inference
- Implement ai/prompt.rs: chunk_doc() + parse_citations()
- Implement ai/types.rs: Rust data structures
- Implement commands/ai.rs: ai_load_model, ai_unload_model, ai_model_status
- Register commands in lib.rs
- Frontend: useAiModel() composable + StatusBar AI status
- **Validation**: load a GGUF model, stream "Hello world" to frontend

### Phase 1: Document Q&A + Citation Jump

- Implement prompt.rs: chat prompt template
- Implement commands/ai.rs: ai_chat (streaming)
- Frontend: chat-panel.vue + citation-tag.vue
- Frontend: citation-highlight.ts ProseMirror plugin
- Frontend: useAiChat() composable
- App.vue: Cmd+L shortcut registration
- **Validation**: ask question about current doc, citation pills hoverable + clickable with scroll + highlight

### Phase 2: Smart Summary / Outline

- Implement prompt.rs: summary prompt template
- Implement commands/ai.rs: ai_summarize
- Frontend: summary-panel.vue
- Frontend: useAiSummary() composable
- App.vue: Cmd+Shift+S shortcut
- **Validation**: all three modes generate, result openable as new tab

### Phase 3: Inline AI Edit

- Implement prompt.rs: edit prompt template
- Implement commands/ai.rs: ai_edit
- Frontend: inline-edit.vue (diff preview + Accept/Reject)
- Frontend: useAiEdit() composable
- App.vue: Cmd+K shortcut
- **Validation**: select text → input instruction → diff preview → Accept/Reject

### Phase 4: Basic Writing Assist

- Implement prompt.rs: assist prompt templates (grammar/spelling/style)
- Implement commands/ai.rs: ai_assist
- Frontend: right-click AI submenu
- Frontend: useAiAssist() composable
- **Validation**: grammar check, spelling fix, style suggestions all functional

## Future Extensions (architecture preserves)

| Extension | How it's preserved |
|---|---|
| Cloud API (Claude/GPT/Gemini) | Rust AI module abstracted behind trait, swap local vs API implementation |
| Cross-tab Q&A | ai_chat doc_content parameter accepts Vec<String> |
| Bidirectional citation panel | citation-highlight plugin key is externally queryable |
| Custom AI instructions | Prompt templates loadable from config file |
| Model auto-download | ModelManager reserves download(path) interface |
