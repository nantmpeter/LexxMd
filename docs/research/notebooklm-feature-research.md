# NotebookLM Feature Research — Future Direction Reference for mdeditor

> Research date: 2026-04-17

## Overview

NotebookLM is Google's source-grounded AI research assistant. Its core philosophy: **upload your sources, get AI responses grounded strictly in that data** (closed RAG), minimizing hallucination.

While NotebookLM is a cloud SaaS product and mdeditor is a local desktop markdown editor, several feature concepts translate well as future directions.

---

## NotebookLM Feature Inventory

| Feature | Description | Category |
|---|---|---|
| Source-Grounded Chat | RAG-based Q&A over uploaded documents, with inline citations | AI Assistant |
| Custom Instructions | 10,000-char persona prompts shaping AI behavior per notebook | AI Config |
| Deep Research | Automated multi-site web scanning → structured report | Research |
| Fast Research | Quick web lookup for fact-checking | Research |
| Audio Overview | AI-generated podcast (deep dive / brief / lecture / debate / quiz) | Content Transform |
| Video Overview | Cinematic animated explainer videos from sources | Content Transform |
| Mind Map | Visual diagram organizing high-level concepts from sources | Content Transform |
| Reports | Briefing doc, study guide, blog post generation | Content Transform |
| Flashcards | Auto-generated with "Got it" / "Missed it" tracking | Study Tool |
| Quiz | Customizable question generation with difficulty control | Study Tool |
| Infographic | 10 visual styles (Sketch Note, Kawaii, Professional, etc.) | Content Transform |
| Slide Deck | AI-generated presentations, exportable as PPTX | Content Transform |
| Data Table | Synthesize info into structured tables | Content Transform |
| Interactive Mode | Pause audio overview, ask questions, resume playback | Interaction |
| Cross-Notebook Query | Mount multiple notebooks in Gemini, query across them | Knowledge Graph |
| Source Management | Multi-modal sources: PDF, DOCX, CSV, images (OCR), audio, video | Document Mgmt |

---

## Applicability Analysis for mdeditor

### Tier 1 — High Fit, Natural Extension

These features align with the "document-centric local editor" identity and are technically feasible with a local/embedded LLM or API integration.

#### 1. Document-Grounded AI Chat

**What it is:** Ask questions about the current document (or open tabs), get answers with citation to specific paragraphs/headings.

**Why it fits mdeditor:**
- The editor already manages multiple documents via tabs — context is built-in
- Outline view (`OutlineView.vue`) proves the editor already understands document structure
- Typora-style editing means users are writing long-form content — they naturally want to query it
- Local-first: could use embedded LLM (e.g., llama.cpp via Tauri's Rust layer) or user's own API key

**Implementation sketch:**
- Sidebar panel: chat interface
- On each query, serialize current document (or selected tabs) as context
- RAG via chunking + embedding, or simply full-doc context if within token limit
- Responses include click-to-jump citations (link to specific heading/paragraph in editor)
- Per-document chat history stored alongside the file (e.g., `.mdeditor-meta/`)

**Risk:** Local LLM quality may not match cloud. Mitigation: support both local and API (OpenAI/Claude/Gemini) backends.

---

#### 2. Smart Outline / Mind Map Generation

**What it is:** AI analyzes document structure and generates a visual mind map or enhanced outline.

**Why it fits mdeditor:**
- `OutlineView.vue` already extracts headings → this is a visual upgrade
- Markdown documents are inherently structured (headings, lists, code blocks)
- Could leverage existing Mermaid support — render mind map as a Mermaid diagram

**Implementation sketch:**
- "Generate Mind Map" command → send doc structure to AI → output Mermaid mindmap syntax → render in editor
- Or: enhance OutlineView with collapsible tree + relationship edges
- Non-AI version: purely structural extraction (headings → tree), no LLM needed

---

#### 3. Content Transformation Suite (Reports / Summary / Study Guide)

**What it is:** One-click generation of summaries, study guides, briefing docs from current document.

**Why it fits mdeditor:**
- Writers constantly need to repurpose content
- Could generate output as new markdown documents (open in new tab)
- Aligns with the "write once, output many" philosophy

**Implementation sketch:**
- Command palette or toolbar: "Summarize" / "Study Guide" / "Briefing Doc"
- AI processes current document, generates new markdown
- Opens result in a new tab — user can edit and save

---

#### 4. Flashcard & Quiz Generation

**What it is:** Extract key concepts from document → generate flashcards or quiz questions.

**Why it fits mdeditor:**
- If users take study notes in the editor, this is a killer feature
- Output could be markdown-based (compatible with Anki, etc.)
- Uses existing heading/list structure as natural chunk boundaries

---

### Tier 2 — Medium Fit, Requires Architectural Investment

#### 5. Custom AI Instructions (Per-Document Persona)

**What it is:** Each document has configurable AI behavior — tone, expertise level, output format.

**Why it fits:** Different documents serve different purposes (research notes vs. blog posts vs. technical docs). Per-document AI config keeps the assistant relevant.

**Implementation:** Store persona config in YAML frontmatter or sidecar file. Apply to all AI features (chat, summary, transform).

---

#### 6. Source Management & Cross-Document Query

**What it is:** Treat open tabs (or a workspace/folder) as a corpus. Query across all of them.

**Why it fits:** Multi-tab is already implemented. Extending AI to reason across tabs is natural.

**Implementation:** Index open documents into a local vector store (e.g., SQLite + embedding). Chat can reference multiple documents.

---

#### 7. Text-to-Speech / Audio Overview

**What it is:** Listen to your document as audio — either TTS narration or AI-generated discussion.

**Why it fits:**
- Local TTS (system APIs, or Whisper-style models) is feasible
- Could generate audio files via Tauri's Rust backend
- Podcast-style discussion would require cloud API

**Implementation:** Rust layer calls system TTS or API. Audio player in sidebar. Export audio as file alongside document.

---

### Tier 3 — Lower Fit, But Inspirational

#### 8. Deep Research (Web Search Integration)

**What it is:** AI scans the web on a topic and generates a sourced report.

**Why it's lower fit:** mdeditor is a local-first editor. Adding web research changes its identity toward a research tool. But a lightweight version (search → insert citations as markdown) could work.

**Implementation:** If user provides API key for search (e.g., Tavily, Brave), editor can fetch results and insert as markdown references.

---

#### 9. Slide Deck / Infographic Generation

**What it is:** Convert document into presentation slides or infographics.

**Why it's lower fit:** Requires rendering engine beyond markdown. But generating markdown-based slide syntax (Marp, reveal.js) is feasible.

---

#### 10. Interactive Mode

**What it is:** Pause audio, ask a question, resume.

**Why it's lower fit:** Depends on audio feature first. But the concept of "interactive document exploration" could apply to the chat panel — highlight text → ask about it inline.

---

## Priority Recommendation

| Priority | Feature | Complexity | User Value |
|---|---|---|---|
| **P0** | Document-Grounded AI Chat | Medium | Very High |
| **P0** | Smart Summary / Transform | Medium | High |
| **P1** | Enhanced Outline / Mind Map | Low-Medium | High |
| **P1** | Custom AI Instructions | Low | Medium-High |
| **P1** | Flashcard Generation | Medium | Medium-High |
| **P2** | Cross-Document Query | High | High |
| **P2** | Text-to-Speech | Medium | Medium |
| **P2** | Quiz Generation | Medium | Medium |
| **P3** | Web Research Integration | High | Medium |
| **P3** | Slide Deck Export | Medium | Medium |

---

## Technical Considerations

### LLM Backend Options

| Approach | Pros | Cons |
|---|---|---|
| **User's own API key** (Claude/GPT/Gemini) | Best quality, minimal local resources | Requires internet, costs money |
| **Embedded local LLM** (llama.cpp via Rust) | Fully offline, no API cost | Limited quality, large binary size |
| **Hybrid** (local for simple tasks, API for complex) | Best of both worlds | More complex architecture |
| **System AI** (macOS Apple Intelligence, Windows Copilot) | Zero config, native feel | Platform-dependent, limited control |

### Recommended Architecture

```
┌─────────────────────────────────────┐
│           Tauri (Rust)              │
│  ┌───────────┐  ┌────────────────┐  │
│  │ LLM Host  │  │ Vector Store   │  │
│  │ (llama.cpp│  │ (SQLite +      │  │
│  │  / API)   │  │  embeddings)   │  │
│  └─────┬─────┘  └───────┬────────┘  │
│        │                │           │
│  ┌─────▼────────────────▼────────┐  │
│  │      AI Service Layer         │  │
│  │  (RAG, chunking, routing)     │  │
│  └─────────────┬─────────────────┘  │
└────────────────┼────────────────────┘
                 │ IPC
┌────────────────▼────────────────────┐
│         Vue 3 Frontend              │
│  ┌─────────┐  ┌──────┐  ┌───────┐  │
│  │ AI Chat │  │ Mind │  │Audio  │  │
│  │ Panel   │  │ Map  │  │Player │  │
│  └─────────┘  └──────┘  └───────┘  │
│  ┌──────────────────────────────┐   │
│  │    Tiptap Editor Core        │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Key Takeaways

1. **NotebookLM's killer insight is "source-grounded AI"** — the editor already has the documents, so grounding AI in them is natural
2. **Content transformation** (summary → study guide → flashcard) is the most immediately valuable direction
3. **AI Chat with citation** is the single highest-impact feature to pursue first
4. **Local-first approach** differentiates mdeditor from NotebookLM — privacy and offline capability
5. **Mermaid integration already in the editor** makes mind map generation almost free (AI → Mermaid syntax → render)

---

## Sources

- [Google NotebookLM Official](https://notebooklm.google/)
- [NotebookLM 2026: What Changed and What Matters — Jeff Su](https://www.jeffsu.org/notebooklm-changed-completely-heres-what-matters-in-2026/)
- [What Is NotebookLM? Features and How to Use It in 2026 — DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-notebooklm)
- [NotebookLM Advanced Guide 2026 — ShareUHack](https://www.shareuhack.com/en/posts/notebooklm-advanced-guide-2026)
- [NotebookLM Evolution 2023-2026 — Medium](https://medium.com/@jimmisound/the-cognitive-engine-a-comprehensive-analysis-of-notebooklms-evolution-2023-2026-90b7a7c2df36)
- [Google Workspace Updates — New Ways to Customize NotebookLM](https://workspaceupdates.googleblog.com/2026/03/new-ways-to-customize-and-interact-with-your-content-in-NotebookLM.html)
- [Cinematic Video Overviews in NotebookLM — Google Blog](https://blog.google/innovation-ai/products/notebooklm/generate-your-own-cinematic-video-overviews-in-notebooklm/)
