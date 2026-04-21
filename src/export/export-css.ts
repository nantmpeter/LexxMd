/**
 * CSS used for export (PDF iframe, DOCX, JPEG).
 * Forces light theme, render mode, hides markdown markers.
 */

export const EXPORT_CSS = `
body {
  margin: 0;
  padding: 40px 60px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: #24292e;
  background: #ffffff;
  -webkit-font-smoothing: antialiased;
}

/* Force all blocks to render mode */
.block-edit-mode,
.block-render-mode {
  /* strip mode classes — content renders the same */
}

/* Hide all markdown markers */
.md-prefix { display: none; }
.block-edit-mode strong::before,
.block-edit-mode strong::after,
.block-edit-mode em::before,
.block-edit-mode em::after,
.block-edit-mode s::before,
.block-edit-mode s::after,
.block-edit-mode code::before,
.block-edit-mode code::after,
.block-edit-mode h1::before,
.block-edit-mode h2::before,
.block-edit-mode h3::before,
.block-edit-mode h4::before,
.block-edit-mode h5::before,
.block-edit-mode h6::before,
.block-edit-mode blockquote::before,
.block-edit-mode ul > li::before,
.block-edit-mode a::after {
  content: '' !important;
}

.ProseMirror {
  outline: none;
  min-height: 100%;
  max-width: 800px;
  margin: 0 auto;
}
.ProseMirror > * + * { margin-top: 0.75em; }

/* Headings */
h1 { font-size: 2em; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.25; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; font-weight: 700; margin-top: 1.25em; margin-bottom: 0.5em; line-height: 1.3; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
h3 { font-size: 1.25em; font-weight: 600; margin-top: 1em; margin-bottom: 0.4em; }
h4 { font-size: 1em; font-weight: 600; margin-top: 1em; }

/* Inline marks */
strong { font-weight: 700; }
em { font-style: italic; }
s { text-decoration: line-through; color: #6a737d; }
code {
  background: #f6f8fa;
  border-radius: 3px;
  padding: 0.15em 0.4em;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 0.875em;
  color: #032f62;
}
a { color: #0366d6; text-decoration: none; }

/* Blockquote */
blockquote {
  border-left: 4px solid #e1e4e8;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #6a737d;
  background: #f6f8fa;
  border-radius: 0 6px 6px 0;
}
blockquote::before { content: '' !important; }

hr { border: none; border-top: 2px solid #e1e4e8; margin: 2em 0; }

/* Lists */
ul, ol { padding-left: 1.75em; margin: 0.75em 0; }
li { margin: 0.3em 0; }
li p { margin: 0; }

/* Task lists */
ul[data-type="taskList"] { list-style: none; padding-left: 0; }
ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.25em; }
ul[data-type="taskList"] li > div { flex: 1; }

/* Code blocks */
pre {
  background: #1e1e1e;
  border-radius: 6px;
  padding: 1em 1.25em;
  margin: 1em 0;
  overflow-x: auto;
  position: relative;
}
pre code {
  background: none;
  padding: 0;
  font-size: 0.875em;
  color: #d4d4d4;
  font-family: 'Fira Code', Consolas, 'Courier New', monospace;
  border-radius: 0;
}

/* Tables */
table { border-collapse: collapse; width: 100%; margin: 1em 0; border: 1px solid #e1e4e8; }
td, th { border: 1px solid #e1e4e8; padding: 0.5em 0.75em; vertical-align: top; min-width: 100px; }
th { background: #f6f8fa; font-weight: 600; text-align: left; }

/* Syntax highlighting (light theme only) */
.hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #d73a49; }
.hljs-string, .hljs-attr { color: #032f62; }
.hljs-number, .hljs-literal { color: #005cc5; }
.hljs-title, .hljs-section { color: #6f42c1; font-weight: bold; }
.hljs-type { color: #e36209; }
.hljs-built_in { color: #005cc5; }

/* Rich code blocks (mermaid/math) */
.rich-block-wrapper { position: relative; margin: 1em 0; }
.rich-block-wrapper::before { display: none; }
.rich-render-container {
  padding: 1.25em;
  background: #ffffff;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  text-align: center;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rich-render-container svg { max-width: 100%; max-height: 60vh; }
.rich-render-container .katex-display { margin: 0; }
.rich-render-container .katex { font-size: 1.3em; }
.rich-error { color: #86181d; background: #ffeef0; border: 1px solid #fdaeb7; border-radius: 4px; padding: 0.75em 1em; text-align: left; font-size: 0.875em; }

/* Print rules */
@media print {
  body { padding: 0; }
  pre, blockquote, .rich-render-container { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
}
`
