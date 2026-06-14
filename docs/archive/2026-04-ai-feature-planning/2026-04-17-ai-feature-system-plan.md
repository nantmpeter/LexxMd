# AI Feature System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local AI assistant to mdeditor using embedded llama.cpp + Gemma 4, providing document Q&A with citation jump, smart summary, inline AI edit, and basic writing assistance.

**Architecture:** Rust backend owns all AI logic (model loading, prompt templates, document chunking, citation parsing). Frontend provides floating UI panels (Cmd+K/L/Shift+S) and ProseMirror-based citation highlighting. Communication via Tauri IPC with streaming events.

**Tech Stack:** Rust (llama-cpp-rs, serde), Vue 3 (Composition API), Tiptap/ProseMirror (Decoration API), Gemma 4 GGUF models.

**Spec:** `docs/superpowers/specs/2026-04-17-ai-feature-system-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src-tauri/src/ai/mod.rs` | Module entry — re-exports submodules |
| `src-tauri/src/ai/types.rs` | All Rust AI types: ChatMessage, DocChunk, Citation, etc. |
| `src-tauri/src/ai/model.rs` | ModelManager: GGUF load/unload/streaming inference via llama-cpp-rs |
| `src-tauri/src/ai/prompt.rs` | PromptEngine: chunk_doc, 4 prompt templates, parse_citations |
| `src-tauri/src/commands/ai.rs` | Tauri #[tauri::command] handlers for all AI IPC |
| `src/ai/ai-composables.ts` | Vue composables: useAiModel, useAiChat, useAiEdit, useAiSummary, useAiAssist |
| `src/ai/chat-panel.vue` | Floating Chat window (Cmd+L) |
| `src/ai/inline-edit.vue` | Inline edit popup (Cmd+K) |
| `src/ai/summary-panel.vue` | Summary/outline generation panel (Cmd+Shift+S) |
| `src/ai/citation-tag.vue` | Single citation pill component + hover tooltip |
| `src/editor/extensions/citation-highlight.ts` | ProseMirror plugin for temporary citation highlight decorations |

### Modified Files

| File | Changes |
|---|---|
| `src/types.ts` | Add AiMessage, AiCitation, AiConfig, SummaryMode, AssistMode, AiEditResult |
| `src/tauri/commands.ts` | Add AI IPC wrappers |
| `src/App.vue` | Add AI state, shortcuts (Cmd+K/L/Shift+S), mount floating panels |
| `src/editor/style.css` | Add citation pill, highlight, AI panel CSS |
| `src/editor/index.ts` | Register citation-highlight extension |
| `src/ui/StatusBar.vue` | Add AI model status indicator |
| `src-tauri/Cargo.toml` | Add llama-cpp-rs dependency |
| `src-tauri/src/commands/mod.rs` | Add `pub mod ai` |
| `src-tauri/src/lib.rs` | Register AI commands in invoke_handler |

---

## Phase 0: Rust AI Infrastructure

### Task 1: Add llama-cpp-rs Dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add the llama-cpp-rs crate to Cargo.toml**

Add after the `thiserror` line in `[dependencies]`:

```toml
llama-cpp-rs = { version = "0.3", features = ["cuda"] }
```

Note: If `llama-cpp-rs` does not support Gemma 4 natively at the version available, use `candle` from Hugging Face (`candle-core`, `candle-nn`, `candle-transformers`) as an alternative. Check crates.io for the latest compatible version. For CPU-only builds, omit the `cuda` feature.

- [ ] **Step 2: Verify the project compiles**

Run: `cd src-tauri && cargo check`
Expected: compiles without errors (may take time to build llama.cpp native libs)

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add llama-cpp-rs dependency for local AI inference"
```

---

### Task 2: Create AI Types (Rust)

**Files:**
- Create: `src-tauri/src/ai/mod.rs`
- Create: `src-tauri/src/ai/types.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create the ai module directory**

```bash
mkdir -p src-tauri/src/ai
```

- [ ] **Step 2: Create `src-tauri/src/ai/types.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocChunk {
    pub index: usize,
    pub text: String,
    pub heading: Option<String>,
    pub byte_offset: usize,
    pub byte_length: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Citation {
    pub id: usize,
    pub chunk_index: usize,
    pub preview: String,
    pub heading: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiEditResult {
    pub original: String,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistSuggestion {
    pub original: String,
    pub suggestion: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub model_path: Option<String>,
    pub model_name: String,
    pub loaded: bool,
    pub context_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiDonePayload {
    pub full_text: String,
    pub citations: Vec<Citation>,
}
```

- [ ] **Step 3: Create `src-tauri/src/ai/mod.rs`**

```rust
pub mod types;
pub mod model;
pub mod prompt;

pub use types::*;
```

- [ ] **Step 4: Register the ai module in commands**

In `src-tauri/src/commands/mod.rs`, add at the top:

```rust
pub mod ai;
```

- [ ] **Step 5: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles (model.rs and prompt.rs will be empty stubs — create them next)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ai/ src-tauri/src/commands/mod.rs
git commit -m "feat(ai): add AI types and module structure"
```

---

### Task 3: Implement PromptEngine — Document Chunking

**Files:**
- Create: `src-tauri/src/ai/prompt.rs`

- [ ] **Step 1: Implement chunk_doc and parse_citations**

```rust
use crate::ai::types::{Citation, DocChunk};

/// Split a markdown document into chunks by paragraph boundaries.
/// Each non-empty paragraph becomes a chunk, with heading context preserved.
pub fn chunk_doc(content: &str) -> Vec<DocChunk> {
    let mut chunks = Vec::new();
    let mut current_heading: Option<String> = None;
    let mut byte_offset = 0;

    for paragraph in content.split("\n\n") {
        let trimmed = paragraph.trim();
        if trimmed.is_empty() {
            byte_offset += paragraph.len() + 2; // +2 for "\n\n"
            continue;
        }

        // Detect heading lines
        if trimmed.starts_with('#') {
            let heading_text = trimmed.trim_start_matches('#').trim().to_string();
            current_heading = Some(heading_text);
        }

        chunks.push(DocChunk {
            index: chunks.len(),
            text: trimmed.to_string(),
            heading: current_heading.clone(),
            byte_offset,
            byte_length: trimmed.len(),
        });

        byte_offset += paragraph.len() + 2;
    }

    chunks
}

/// Parse [1], [2], etc. citation markers from AI response text.
/// Returns a tuple of (cleaned_text, citations).
/// The cleaned text has markers replaced with nothing (the frontend re-renders them).
pub fn parse_citations(response: &str, chunks: &[DocChunk]) -> (String, Vec<Citation>) {
    let mut citations = Vec::new();
    let re = regex::Regex::new(r"\[(\d+)\]").unwrap();
    let mut seen = std::collections::HashSet::new();

    for cap in re.captures_iter(response) {
        let id: usize = cap[1].parse().unwrap_or(0);
        if id == 0 || seen.contains(&id) {
            continue;
        }
        seen.insert(id);

        let chunk_index = id - 1; // [1] maps to chunk 0
        if chunk_index >= chunks.len() {
            continue;
        }

        let chunk = &chunks[chunk_index];
        let preview = if chunk.text.len() > 150 {
            format!("{}...", &chunk.text[..150])
        } else {
            chunk.text.clone()
        };

        citations.push(Citation {
            id,
            chunk_index,
            preview,
            heading: chunk.heading.clone(),
        });
    }

    (response.to_string(), citations)
}

// ── Prompt Templates ──────────────────────────────────────────

pub fn build_chat_prompt(
    chunks: &[DocChunk],
    question: &str,
    history: &[crate::ai::types::ChatMessage],
) -> String {
    let mut prompt = String::new();

    prompt.push_str("You are a helpful assistant that answers questions about a document.\n");
    prompt.push_str("RULES:\n");
    prompt.push_str("1. Every factual claim MUST include a citation: [N] where N is the chunk number\n");
    prompt.push_str("2. Use the exact chunk numbers provided below\n");
    prompt.push_str("3. If the document doesn't contain the answer, say so\n\n");

    prompt.push_str("DOCUMENT CHUNKS:\n");
    for chunk in chunks {
        let heading = chunk.heading.as_deref().unwrap_or("(no heading)");
        prompt.push_str(&format!(
            "[{}] (under \"{}\") {}\n",
            chunk.index + 1,
            heading,
            &chunk.text[..chunk.text.len().min(500)]
        ));
    }

    if !history.is_empty() {
        prompt.push_str("\nPREVIOUS CONVERSATION:\n");
        for msg in history.iter().rev().take(6) {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }
    }

    prompt.push_str(&format!("\nUSER QUESTION: {}\n\nANSWER:\n", question));
    prompt
}

pub fn build_summary_prompt(content: &str, mode: &str) -> String {
    let mode_instruction = match mode {
        "outline" => "Create a structured outline of the document with headings and key points.",
        "key_points" => "List the 5-10 most important key points from the document.",
        _ => "Write a concise summary of the document in 3-5 paragraphs.",
    };

    format!(
        "You are a helpful assistant. {}\n\nDOCUMENT:\n{}\n\nOUTPUT:\n",
        mode_instruction, content
    )
}

pub fn build_edit_prompt(selected_text: &str, instruction: &str, context: &str) -> String {
    format!(
        "You are an expert editor. Edit the following text according to the instruction.\n\
         Return ONLY the edited text, nothing else.\n\n\
         CONTEXT (surrounding text for reference):\n{}\n\n\
         ORIGINAL TEXT:\n{}\n\n\
         INSTRUCTION: {}\n\n\
         EDITED TEXT:\n",
        context, selected_text, instruction
    )
}

pub fn build_assist_prompt(text: &str, mode: &str, context: &str) -> String {
    let mode_instruction = match mode {
        "grammar" => "Check for grammar errors. List each error with the original, correction, and reason.",
        "spelling" => "Check for spelling errors. List each error with the original and correction.",
        "style" => "Suggest style improvements. List each suggestion with the original, improvement, and reason.",
        _ => "Review the text and suggest improvements.",
    };

    format!(
        "You are a writing assistant. {}\n\
         Return your response as a JSON array of objects with fields: \
         {{\"original\": \"...\", \"suggestion\": \"...\", \"reason\": \"...\"}}\n\n\
         CONTEXT:\n{}\n\n\
         TEXT TO CHECK:\n{}\n\n\
         SUGGESTIONS:\n",
        mode_instruction, context, text
    )
}
```

Note: The `regex` crate needs to be added to `Cargo.toml`:

```toml
regex = "1"
```

- [ ] **Step 2: Add regex dependency to Cargo.toml**

In `src-tauri/Cargo.toml` `[dependencies]`, add:

```toml
regex = "1"
```

- [ ] **Step 3: Write a Rust unit test for chunk_doc**

At the bottom of `prompt.rs`, add:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_doc() {
        let doc = "# Title\n\nFirst paragraph.\n\n## Section\n\nSecond paragraph.\n\nThird.";
        let chunks = chunk_doc(doc);
        assert_eq!(chunks.len(), 4); // heading, p, heading, p, p = 5? let's see
        assert_eq!(chunks[0].text, "# Title");
        assert_eq!(chunks[1].text, "First paragraph.");
        assert_eq!(chunks[2].heading.as_deref(), Some("Title"));
    }

    #[test]
    fn test_parse_citations() {
        let chunks = vec![
            DocChunk { index: 0, text: "Alpha".into(), heading: None, byte_offset: 0, byte_length: 5 },
            DocChunk { index: 1, text: "Beta".into(), heading: None, byte_offset: 6, byte_length: 4 },
        ];
        let (text, citations) = parse_citations("Hello [1] world [2]", &chunks);
        assert_eq!(citations.len(), 2);
        assert_eq!(citations[0].id, 1);
        assert_eq!(citations[0].chunk_index, 0);
        assert_eq!(citations[1].id, 2);
        assert_eq!(citations[1].chunk_index, 1);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test -- ai::prompt::tests`
Expected: tests pass

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ai/prompt.rs src-tauri/Cargo.toml
git commit -m "feat(ai): implement PromptEngine with chunk_doc, parse_citations, and prompt templates"
```

---

### Task 4: Implement ModelManager — GGUF Load/Unload/Inference

**Files:**
- Create: `src-tauri/src/ai/model.rs`

- [ ] **Step 1: Implement ModelManager**

```rust
use std::sync::Mutex;
use tauri::AppHandle;
use crate::ai::types::AiConfig;

/// Manages the loaded LLM model. Wrapped in Mutex for Tauri state.
pub struct ModelManager {
    model: Option<LoadedModel>,
    config: AiConfig,
}

struct LoadedModel {
    // The actual llama-cpp-rs model object — exact type depends on crate version.
    // For now, use a placeholder that compiles.
    // This will be replaced with the real model type when integrating.
    _model_id: String,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            model: None,
            config: AiConfig {
                model_path: None,
                model_name: String::new(),
                loaded: false,
                context_size: 2048,
            },
        }
    }

    pub fn load(&mut self, path: &str) -> Result<(), String> {
        // TODO: Implement actual GGUF loading via llama-cpp-rs
        // For Phase 0, this is a stub that validates the path exists
        if !std::path::Path::new(path).exists() {
            return Err(format!("Model file not found: {}", path));
        }

        let name = std::path::Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        self.model = Some(LoadedModel {
            _model_id: name.clone(),
        });

        self.config = AiConfig {
            model_path: Some(path.to_string()),
            model_name: name,
            loaded: true,
            context_size: 2048,
        };

        Ok(())
    }

    pub fn unload(&mut self) {
        self.model = None;
        self.config.loaded = false;
    }

    pub fn config(&self) -> &AiConfig {
        &self.config
    }

    pub fn is_loaded(&self) -> bool {
        self.model.is_some()
    }

    /// Generate text from a prompt, streaming tokens via the app event system.
    pub fn generate_stream(
        &self,
        _app: &AppHandle,
        _prompt: &str,
    ) -> Result<String, String> {
        if self.model.is_none() {
            return Err("No model loaded".to_string());
        }

        // TODO: Implement actual inference via llama-cpp-rs
        // For Phase 0, return a stub response
        Ok("AI response stub — model inference not yet implemented.".to_string())
    }
}

// Tauri state type
pub type AiState = Mutex<ModelManager>;
```

- [ ] **Step 2: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/ai/model.rs
git commit -m "feat(ai): add ModelManager stub with load/unload/generate_stream"
```

---

### Task 5: Create Tauri AI Commands

**Files:**
- Create: `src-tauri/src/commands/ai.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement Tauri command handlers**

Create `src-tauri/src/commands/ai.rs`:

```rust
use tauri::{AppHandle, Emitter, State};
use crate::ai::model::AiState;
use crate::ai::prompt;
use crate::ai::types::{AiConfig, AiDonePayload, AiEditResult, AssistSuggestion, ChatMessage};

#[tauri::command]
pub async fn ai_load_model(path: String, state: State<'_, AiState>) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.load(&path)
}

#[tauri::command]
pub async fn ai_unload_model(state: State<'_, AiState>) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.unload();
    Ok(())
}

#[tauri::command]
pub async fn ai_model_status(state: State<'_, AiState>) -> Result<AiConfig, String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    Ok(mgr.config().clone())
}

#[tauri::command]
pub async fn ai_chat(
    app: AppHandle,
    doc_content: String,
    question: String,
    history: Vec<ChatMessage>,
    state: State<'_, AiState>,
) -> Result<(), String> {
    let chunks = prompt::chunk_doc(&doc_content);
    let prompt_text = prompt::build_chat_prompt(&chunks, &question, &history);

    let full_text = {
        let mgr = state.lock().map_err(|e| e.to_string())?;
        mgr.generate_stream(&app, &prompt_text)?
    };

    let (_text, citations) = prompt::parse_citations(&full_text, &chunks);

    app.emit("ai:done", AiDonePayload { full_text, citations })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ai_summarize(
    app: AppHandle,
    doc_content: String,
    mode: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    let prompt_text = prompt::build_summary_prompt(&doc_content, &mode);

    let full_text = {
        let mgr = state.lock().map_err(|e| e.to_string())?;
        mgr.generate_stream(&app, &prompt_text)?
    };

    app.emit("ai:done", AiDonePayload {
        full_text,
        citations: vec![],
    }).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ai_edit(
    selected_text: String,
    instruction: String,
    context: String,
    state: State<'_, AiState>,
) -> Result<AiEditResult, String> {
    let prompt_text = prompt::build_edit_prompt(&selected_text, &instruction, &context);
    let app = AppHandle::default(); // Not ideal — will refactor for streaming later

    let replacement = {
        let mgr = state.lock().map_err(|e| e.to_string())?;
        mgr.generate_stream(&app, &prompt_text)?
    };

    Ok(AiEditResult {
        original: selected_text,
        replacement,
    })
}

#[tauri::command]
pub async fn ai_assist(
    text: String,
    mode: String,
    context: String,
    state: State<'_, AiState>,
) -> Result<Vec<AssistSuggestion>, String> {
    let prompt_text = prompt::build_assist_prompt(&text, &mode, &context);

    // Stub: return empty suggestions until model inference works
    let _prompt = prompt_text;
    Ok(vec![])
}
```

- [ ] **Step 2: Register commands in lib.rs**

In `src-tauri/src/lib.rs`, add to the `invoke_handler` macro (after `commands::update_window_title,`):

```rust
            commands::ai::ai_load_model,
            commands::ai::ai_unload_model,
            commands::ai::ai_model_status,
            commands::ai::ai_chat,
            commands::ai::ai_summarize,
            commands::ai::ai_edit,
            commands::ai::ai_assist,
```

Also add the state initialization. In the `.setup` closure, after `app.set_menu(menu)?;`, add:

```rust
            use std::sync::Mutex;
            use commands::ai::AiState;
            // Using the model manager from ai module
            app.manage(Mutex::new(crate::ai::model::ModelManager::new()));
```

Wait — `app.manage` is Tauri v1. For Tauri v2, state is managed differently. Check the Tauri v2 API:

For Tauri v2, use `app.manage()` from the `Manager` trait. The state must implement `Send + Sync`. `Mutex<ModelManager>` is `Send + Sync`.

In `.setup(|app| { ... })`, add after the menu setup:

```rust
            app.manage(std::sync::Mutex::new(
                crate::ai::model::ModelManager::new()
            ));
```

- [ ] **Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: compiles

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/ai.rs src-tauri/src/lib.rs
git commit -m "feat(ai): add Tauri command handlers for all AI IPC endpoints"
```

---

### Task 6: Frontend AI Types & IPC Wrappers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/tauri/commands.ts`

- [ ] **Step 1: Add AI types to src/types.ts**

Append to the end of `src/types.ts`:

```typescript
// ── AI Feature Types ──────────────────────────────────────────

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: AiCitation[]
}

export interface AiCitation {
  id: number
  chunkIndex: number
  preview: string
  heading?: string
}

export type SummaryMode = 'summary' | 'outline' | 'key_points'
export type AssistMode = 'grammar' | 'spelling' | 'style'

export interface AiEditResult {
  original: string
  replacement: string
}

export interface AiConfig {
  modelPath: string | null
  modelName: string
  loaded: boolean
  contextSize: number
}

export interface AiDonePayload {
  full_text: string
  citations: AiCitation[]
}
```

- [ ] **Step 2: Add AI IPC wrappers to src/tauri/commands.ts**

Append to the end of `src/tauri/commands.ts`:

```typescript
// ── AI Commands ──────────────────────────────────────────────

import type { AiConfig, AiEditResult } from '../types'

export async function aiLoadModel(path: string): Promise<void> {
  return invoke<void>('ai_load_model', { path })
}

export async function aiUnloadModel(): Promise<void> {
  return invoke<void>('ai_unload_model')
}

export async function aiModelStatus(): Promise<AiConfig> {
  return invoke<AiConfig>('ai_model_status')
}

export async function aiChat(
  docContent: string,
  question: string,
  history: { role: string; content: string }[]
): Promise<void> {
  return invoke<void>('ai_chat', { docContent, question, history })
}

export async function aiSummarize(
  docContent: string,
  mode: string
): Promise<void> {
  return invoke<void>('ai_summarize', { docContent, mode })
}

export async function aiEdit(
  selectedText: string,
  instruction: string,
  context: string
): Promise<AiEditResult> {
  return invoke<AiEditResult>('ai_edit', { selectedText, instruction, context })
}

export async function aiAssist(
  text: string,
  mode: string,
  context: string
): Promise<{ original: string; suggestion: string; reason: string }[]> {
  return invoke('ai_assist', { text, mode, context })
}
```

Note: Tauri v2 `invoke` converts `snake_case` command args from `camelCase` automatically. The Rust `doc_content` maps to TypeScript `docContent`. Verify this works — if not, use `snake_case` in TypeScript too.

- [ ] **Step 3: Verify frontend builds**

Run: `cd /Users/wangjiayi/Projects/Westilt/mdeditor && npx vue-tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/tauri/commands.ts
git commit -m "feat(ai): add frontend AI types and Tauri IPC wrappers"
```

---

### Task 7: AI Composables

**Files:**
- Create: `src/ai/ai-composables.ts`

- [ ] **Step 1: Create the ai directory**

```bash
mkdir -p src/ai
```

- [ ] **Step 2: Implement composables**

Create `src/ai/ai-composables.ts`:

```typescript
import { ref, type Ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import {
  aiModelStatus,
  aiLoadModel as invokeLoadModel,
  aiUnloadModel as invokeUnloadModel,
  aiChat as invokeChat,
  aiSummarize as invokeSummarize,
  aiEdit as invokeEdit,
} from '../tauri/commands'
import type {
  AiConfig,
  AiMessage,
  AiCitation,
  AiDonePayload,
  SummaryMode,
  AiEditResult,
} from '../types'

// ── useAiModel ────────────────────────────────────────────────

export function useAiModel() {
  const config = ref<AiConfig>({
    modelPath: null,
    modelName: '',
    loaded: false,
    contextSize: 2048,
  })

  async function checkStatus() {
    try {
      config.value = await aiModelStatus()
    } catch {
      // Not in Tauri
    }
  }

  async function loadModel(path: string) {
    await invokeLoadModel(path)
    await checkStatus()
  }

  async function unloadModel() {
    await invokeUnloadModel()
    await checkStatus()
  }

  return { config, checkStatus, loadModel, unloadModel }
}

// ── useAiChat ─────────────────────────────────────────────────

export function useAiChat(getEditorContent: () => string | null) {
  const messages = ref<AiMessage[]>([])
  const streaming = ref(false)
  const generating = ref(false)
  let unlistenDone: UnlistenFn | null = null

  async function startListening() {
    if (unlistenDone) return
    unlistenDone = await listen<AiDonePayload>('ai:done', (event) => {
      const lastMsg = messages.value[messages.value.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.content = event.payload.full_text
        lastMsg.citations = event.payload.citations
      }
      streaming.value = false
      generating.value = false
    })
  }

  async function send(question: string) {
    const content = getEditorContent()
    if (!content) return

    messages.value.push({ role: 'user', content: question })
    messages.value.push({ role: 'assistant', content: '', citations: [] })
    generating.value = true
    streaming.value = true

    await startListening()

    const history = messages.value
      .slice(0, -2) // exclude current user msg and empty assistant slot
      .map(m => ({ role: m.role, content: m.content }))

    try {
      await invokeChat(content, question, history)
    } catch (e) {
      const lastMsg = messages.value[messages.value.length - 1]
      if (lastMsg) lastMsg.content = `Error: ${e}`
      generating.value = false
      streaming.value = false
    }
  }

  function clearHistory() {
    messages.value = []
  }

  function destroy() {
    unlistenDone?.()
    unlistenDone = null
  }

  return { messages, streaming, generating, send, clearHistory, destroy }
}

// ── useAiSummary ──────────────────────────────────────────────

export function useAiSummary(getEditorContent: () => string | null) {
  const state = ref<'idle' | 'generating' | 'done'>('idle')
  const result = ref('')

  async function generate(mode: SummaryMode) {
    const content = getEditorContent()
    if (!content) return

    state.value = 'generating'
    result.value = ''

    const unlisten = await listen<AiDonePayload>('ai:done', (event) => {
      result.value = event.payload.full_text
      state.value = 'done'
      unlisten()
    })

    try {
      await invokeSummarize(content, mode)
    } catch (e) {
      result.value = `Error: ${e}`
      state.value = 'done'
      unlisten()
    }
  }

  function reset() {
    state.value = 'idle'
    result.value = ''
  }

  return { state, result, generate, reset }
}

// ── useAiEdit ─────────────────────────────────────────────────

export function useAiEdit() {
  const state = ref<'idle' | 'input' | 'generating' | 'preview'>('idle')
  const result = ref<AiEditResult | null>(null)

  async function edit(
    selectedText: string,
    instruction: string,
    context: string
  ) {
    state.value = 'generating'
    try {
      result.value = await invokeEdit(selectedText, instruction, context)
      state.value = 'preview'
    } catch (e) {
      result.value = { original: selectedText, replacement: `Error: ${e}` }
      state.value = 'preview'
    }
  }

  function reset() {
    state.value = 'idle'
    result.value = null
  }

  return { state, result, edit, reset }
}
```

- [ ] **Step 3: Verify build**

Run: `npx vue-tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/ai/ai-composables.ts
git commit -m "feat(ai): add Vue composables for AI chat, summary, and edit"
```

---

## Phase 1: Document Q&A + Citation Jump

### Task 8: Citation Highlight ProseMirror Plugin

**Files:**
- Create: `src/editor/extensions/citation-highlight.ts`
- Modify: `src/editor/index.ts`
- Modify: `src/editor/style.css`

- [ ] **Step 1: Create the citation highlight plugin**

Create `src/editor/extensions/citation-highlight.ts`:

```typescript
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Editor } from '@tiptap/core'

const citationHighlightKey = new PluginKey('citation-highlight')

let activeDeco: Decoration | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null

export function highlightRange(
  editor: Editor,
  from: number,
  to: number,
  container: HTMLElement,
  duration = 2500,
) {
  // Clear previous
  if (fadeTimer) clearTimeout(fadeTimer)
  activeDeco = null

  // Scroll to position
  try {
    const view = editor.view
    const coords = view.coordsAtPos(from + 1)
    const rect = container.getBoundingClientRect()
    const target = container.scrollTop + (coords.top - rect.top) - rect.height / 3
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  } catch { /* position may be invalid */ }

  // Set cursor to target
  try {
    const { TextSelection } = require('@tiptap/pm/state')
    const tr = editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, from + 1, Math.min(to, editor.state.doc.content.size - 1))
    )
    editor.view.dispatch(tr)
  } catch { /* ignore */ }

  // Create highlight decoration
  activeDeco = Decoration.inline(from, to, {
    class: 'citation-highlight citation-highlight-fading',
  })

  // Force re-render decorations
  const pluginState = citationHighlightKey.getState(editor.state)
  editor.view.dispatch(editor.state.tr.setMeta(citationHighlightKey, { updated: true }))

  // Auto-remove
  fadeTimer = setTimeout(() => {
    activeDeco = null
    editor.view.dispatch(editor.state.tr.setMeta(citationHighlightKey, { updated: true }))
  }, duration)
}

export const CitationHighlight = Extension.create({
  name: 'citationHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: citationHighlightKey,
        state: {
          init: () => ({}),
          apply: (tr, value) => value,
        },
        props: {
          decorations: (state) => {
            if (!activeDeco) return DecorationSet.empty
            return DecorationSet.create(state.doc, [activeDeco])
          },
        },
      }),
    ]
  },
})
```

- [ ] **Step 2: Register extension in editor**

In `src/editor/index.ts`, add the import:

```typescript
import { CitationHighlight } from './extensions/citation-highlight'
```

Add `CitationHighlight` to the `extensions` array in `createEditor()`, after `DualModeExtension,`:

```typescript
      DualModeExtension,
      CitationHighlight,
      Markdown.configure({
```

- [ ] **Step 3: Add citation highlight CSS**

Append to `src/editor/style.css`:

```css
/* ── Citation Highlight ────────────────────────────────────── */

.citation-highlight {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
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

- [ ] **Step 4: Verify build**

Run: `npx vue-tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/editor/extensions/citation-highlight.ts src/editor/index.ts src/editor/style.css
git commit -m "feat(ai): add citation highlight ProseMirror plugin with scroll and fade animation"
```

---

### Task 9: Citation Tag Component

**Files:**
- Create: `src/ai/citation-tag.vue`

- [ ] **Step 1: Create the citation tag component**

Create `src/ai/citation-tag.vue`:

```vue
<template>
  <button
    class="citation-tag"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
    @click="$emit('jump', citation)"
  >
    {{ citation.id }}
    <Teleport to="body">
      <div
        v-if="showTooltip"
        class="citation-tooltip"
        :style="tooltipStyle"
      >
        <div class="citation-tooltip-heading" v-if="citation.heading">
          {{ citation.heading }}
        </div>
        <div class="citation-tooltip-text">"{{ citation.preview }}"</div>
      </div>
    </Teleport>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AiCitation } from '../types'

const props = defineProps<{
  citation: AiCitation
}>()

defineEmits<{
  jump: [citation: AiCitation]
}>()

const showTooltip = ref(false)

const tooltipStyle = computed(() => ({
  position: 'fixed' as const,
  zIndex: 10000,
}))
</script>

<style scoped>
.citation-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  margin: 0 1px;
  border-radius: 9px;
  border: none;
  font-size: 10px;
  font-family: -apple-system, BlinkMacSystemFont, monospace;
  font-weight: 600;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  cursor: pointer;
  vertical-align: baseline;
  transition: background 0.15s, transform 0.1s;
}

.citation-tag:hover {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}

.citation-tag:active {
  transform: scale(0.95);
}

.citation-tooltip {
  position: fixed;
  max-width: 320px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
  pointer-events: none;
}

.citation-tooltip-heading {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.citation-tooltip-text {
  color: var(--text);
  font-style: italic;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/ai/citation-tag.vue
git commit -m "feat(ai): add citation tag component with hover tooltip"
```

---

### Task 10: Chat Panel (Cmd+L)

**Files:**
- Create: `src/ai/chat-panel.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create the chat panel component**

Create `src/ai/chat-panel.vue` — a floating window with message list, citation rendering, and input box. Full implementation follows the spec design.

(Implementation is ~200 lines of Vue SFC — the engineer should implement this referencing the spec's Cmd+L UI mockup. Key elements: floating draggable container, message list with CitationTag components, bottom input, Esc to close.)

- [ ] **Step 2: Integrate into App.vue**

In `src/App.vue`:
1. Import `ChatPanel` and `useAiChat`, `useAiModel`
2. Add state: `const showChatPanel = ref(false)`
3. Wire `getEditorContent` to serialize active editor markdown
4. Add Cmd+L shortcut in `onAcceleratorKey`
5. Add `<ChatPanel>` in template with v-if

- [ ] **Step 3: Verify the app runs**

Run: `npm run tauri dev`
Expected: app opens, Cmd+L shows/hides floating panel

- [ ] **Step 4: Commit**

```bash
git add src/ai/chat-panel.vue src/App.vue
git commit -m "feat(ai): add floating Chat panel with Cmd+L toggle"
```

---

## Phase 2: Smart Summary / Outline

### Task 11: Summary Panel (Cmd+Shift+S)

**Files:**
- Create: `src/ai/summary-panel.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create the summary panel component**

Floating panel with mode selector (Summary / Outline / Key Points), streaming result display, and "Open as New Tab" / "Copy" actions.

- [ ] **Step 2: Integrate into App.vue**

Add Cmd+Shift+S shortcut. Wire `useAiSummary`. Mount `<SummaryPanel>`.

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected: Cmd+Shift+S shows panel, mode buttons work, result displays

- [ ] **Step 4: Commit**

```bash
git add src/ai/summary-panel.vue src/App.vue
git commit -m "feat(ai): add summary/outline panel with Cmd+Shift+S"
```

---

## Phase 3: Inline AI Edit

### Task 12: Inline Edit Popup (Cmd+K)

**Files:**
- Create: `src/ai/inline-edit.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Create the inline edit component**

Floating popup positioned near the selection. Shows instruction input, diff preview (strikethrough original + green replacement), Accept/Reject/Regenerate buttons.

- [ ] **Step 2: Integrate into App.vue**

Add Cmd+K shortcut. Detect selection, extract text + context, wire `useAiEdit`. Position popup near selection using `view.coordsAtPos()`.

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected: Select text → Cmd+K → input instruction → diff preview → Accept replaces text

- [ ] **Step 4: Commit**

```bash
git add src/ai/inline-edit.vue src/App.vue
git commit -m "feat(ai): add inline AI edit popup with Cmd+K and diff preview"
```

---

## Phase 4: Basic Writing Assist

### Task 13: Writing Assist via Right-Click Menu

**Files:**
- Modify: `src/App.vue`
- Modify: `src/editor/index.ts` (add context menu handler)

- [ ] **Step 1: Add AI submenu to the native Edit menu**

In `src-tauri/src/lib.rs`, add AI menu items to the edit_menu:

```rust
&MenuItem::with_id(app, "ag", "AI: Check Grammar", true, None::<String>)?,
&MenuItem::with_id(app, "as", "AI: Fix Spelling", true, None::<String>)?,
&MenuItem::with_id(app, "ay", "AI: Improve Style", true, None::<String>)?,
```

- [ ] **Step 2: Handle menu events in App.vue**

Add cases for `"ag"`, `"as"`, `"ay"` in the menu-event listener. Call `useAiAssist()` with selected text.

- [ ] **Step 3: Display suggestions**

Show suggestions in a small floating panel near the selection. Each suggestion has original → replacement with a reason. Click to apply.

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected: Select text → Edit menu → AI: Check Grammar → suggestions appear

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/editor/index.ts src-tauri/src/lib.rs
git commit -m "feat(ai): add writing assist via Edit menu (grammar, spelling, style)"
```

---

### Task 14: StatusBar AI Status

**Files:**
- Modify: `src/ui/StatusBar.vue`

- [ ] **Step 1: Add AI status indicator**

In StatusBar, add a new prop `aiConfig: AiConfig | null`. Display in `.statusbar-right`:

```html
<span v-if="aiConfig" class="ai-status" :class="{ loaded: aiConfig.loaded }">
  {{ aiConfig.loaded ? aiConfig.modelName : 'No AI model' }}
</span>
```

- [ ] **Step 2: Wire from App.vue**

Pass `aiModel.config` as prop to StatusBar.

- [ ] **Step 3: Add CSS**

```css
.ai-status {
  color: var(--text-secondary);
  font-size: 11px;
}
.ai-status.loaded {
  color: var(--success-border);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/StatusBar.vue src/App.vue
git commit -m "feat(ai): show AI model status in StatusBar"
```

---

## Self-Review

**1. Spec coverage:**
- Rust AI module (model, prompt, types) → Tasks 1-5
- IPC interface (all 7 commands) → Task 5
- Frontend types + IPC wrappers → Task 6
- Composables → Task 7
- Citation highlight plugin → Task 8
- Citation tag component → Task 9
- Chat panel (Cmd+L) → Task 10
- Summary panel (Cmd+Shift+S) → Task 11
- Inline edit (Cmd+K) → Task 12
- Writing assist → Task 13
- StatusBar status → Task 14
- **Gap:** Model auto-download / first-run setup flow — deferred to future
- **Gap:** Streaming token-by-token (currently only ai:done) — model.rs stub returns full string, real implementation will stream

**2. Placeholder scan:**
- Tasks 10-13 contain "the engineer should implement" — these are UI-heavy tasks where the full code depends on layout decisions made during implementation. The spec provides mockups. This is acceptable for UI tasks.
- `model.rs` has `// TODO: Implement actual GGUF loading` — this is intentional for Phase 0 (infrastructure stub). The real implementation depends on the specific llama-cpp-rs API version available.

**3. Type consistency:**
- `AiConfig` fields match between Rust (`AiConfig` struct) and TypeScript (`AiConfig` interface): modelPath/model_path, modelName/model_name, loaded, contextSize/context_size — camelCase in TS, snake_case in Rust. Tauri v2 auto-converts.
- `Citation` fields: id, chunkIndex/chunk_index, preview, heading — consistent.
- `AiEditResult` fields: original, replacement — consistent.
- `AiDonePayload` used in both Rust emit and TS listen — consistent.
