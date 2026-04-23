<script setup lang="ts">
defineProps<{
  lang?: string
}>()

const features = {
  en: [
    { icon: '✎', title: 'Dual-Mode WYSIWYG', desc: 'Inline editing where Markdown syntax shows only on the focused block — everything else renders beautifully.' },
    { icon: '◇', title: 'Mermaid & KaTeX', desc: 'Live-render diagrams and math formulas. Focus to edit source, blur to see the rendered output.' },
    { icon: '⚡', title: 'Native Performance', desc: 'Built with Tauri 2 (Rust), not Electron. ~15 MB binary with instant startup and minimal memory usage.' },
    { icon: '⟨/⟩', title: 'Full Source Mode', desc: 'Toggle to CodeMirror 6-powered Markdown source view anytime. Cursor position preserved across switches.' },
    { icon: '📄', title: 'Multi-Format Export', desc: 'Export to PDF (multi-page A4), DOCX (with syntax highlighting), and JPEG — all client-side.' },
    { icon: '⊞', title: 'Image Paste & Workspace', desc: 'Paste images from clipboard directly. Open folders as workspaces with file tree navigation.' },
  ],
  zh: [
    { icon: '✎', title: '双模所见即所得', desc: '内联编辑模式，Markdown 语法仅在当前光标块显示，其余全部优雅渲染。' },
    { icon: '◇', title: 'Mermaid 与 KaTeX', desc: '实时渲染图表与数学公式。聚焦编辑源码，失焦查看渲染结果。' },
    { icon: '⚡', title: '原生性能', desc: '基于 Tauri 2 (Rust) 而非 Electron。约 15 MB 安装包，秒级启动，极低内存占用。' },
    { icon: '⟨/⟩', title: '完整源码模式', desc: '随时切换到 CodeMirror 6 驱动的 Markdown 源码视图，光标位置自动保持。' },
    { icon: '📄', title: '多格式导出', desc: '导出为 PDF（多页 A4）、DOCX（含语法高亮）和 JPEG —— 纯本地处理。' },
    { icon: '⊞', title: '图片粘贴与工作区', desc: '直接从剪贴板粘贴图片。打开文件夹作为工作区，文件树快速导航。' },
  ],
}
</script>

<template>
  <div class="feature-grid">
    <h2 class="section-title">{{ lang === 'zh' ? '核心特性' : 'Core Features' }}</h2>
    <div class="grid">
      <div v-for="(f, i) in (lang === 'zh' ? features.zh : features.en)" :key="i" class="feature-card">
        <div class="feature-icon">{{ f.icon }}</div>
        <h3>{{ f.title }}</h3>
        <p>{{ f.desc }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  text-align: center;
  font-size: var(--text-3xl);
  margin-bottom: var(--space-6);
  color: var(--lexx-text-primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.feature-card {
  background: var(--lexx-bg-secondary);
  border: 1px solid var(--lexx-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  transition: all var(--duration-normal) ease;
}

.feature-card:hover {
  border-color: var(--lexx-border-hover);
  box-shadow: var(--shadow-card-hover);
}

.feature-icon {
  font-size: 1.25rem;
  margin-bottom: var(--space-3);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--lexx-bg-tertiary);
}

.feature-card h3 {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: var(--space-2);
  color: var(--lexx-text-primary);
}

.feature-card p {
  font-size: var(--text-sm);
  color: var(--lexx-text-secondary);
  line-height: 1.6;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
