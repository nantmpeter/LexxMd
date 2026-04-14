//! @file MVP implementation: delegates to JS (Tiptap's built-in serializer)
//! @author Backend-Dev Agent (Rust)
//! @created 2026-04-14
//!
//! IMPLEMENTATION SCOPE:
//! - Implemented: JsFallback struct with no-op MarkdownProcessor methods
//! - Not implemented: actual parsing/serialization (handled by Tiptap in JS)
//! - Pending: Replace with pulldown_cmark_impl once Rust-side parsing is needed

use super::{HighlightSpan, MarkdownProcessor};

/// MVP fallback that passes through Markdown as-is.
/// Actual serialization is handled by Tiptap's Markdown extension on the JS side.
pub struct JsFallback;

impl MarkdownProcessor for JsFallback {
    fn parse(&self, markdown: &str) -> Result<String, String> {
        // In MVP, Tiptap handles parsing via its Markdown extension.
        // This passes through the raw Markdown string unchanged.
        Ok(markdown.to_string())
    }

    fn serialize(&self, _ast_json: &str) -> Result<String, String> {
        // In MVP, Tiptap handles serialization via its Markdown extension.
        // This returns empty since it is never called.
        Ok(String::new())
    }

    fn highlight(&self, code: &str, language: &str) -> Result<Vec<HighlightSpan>, String> {
        // In MVP, syntax highlighting is done by lowlight on the JS side.
        let _ = (code, language);
        Ok(vec![])
    }
}
