//! @file MarkdownProcessor trait -- defines the interface for Markdown parsing/serialization
//! @author Backend-Dev Agent (Rust)
//! @created 2026-04-14
//!
//! IMPLEMENTATION SCOPE:
//! - Implemented: MarkdownProcessor trait definition, HighlightSpan struct
//! - Not implemented: pulldown_cmark_impl (Rust native parser)
//! - Pending: Future replacement of js_fallback with pulldown-cmark backend

pub mod js_fallback;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightSpan {
    pub start: usize,
    pub end: usize,
    pub class: String,
}

/// Trait for Markdown processing backends.
/// Tiptap handles serialization in MVP; this trait is the interface
/// for future Rust-side pulldown-cmark integration.
pub trait MarkdownProcessor: Send + Sync {
    /// Parse Markdown text into an AST representation.
    fn parse(&self, markdown: &str) -> Result<String, String>;

    /// Serialize an AST back to Markdown text.
    fn serialize(&self, ast_json: &str) -> Result<String, String>;

    /// Highlight code with syntax coloring.
    fn highlight(&self, code: &str, language: &str) -> Result<Vec<HighlightSpan>, String>;
}
