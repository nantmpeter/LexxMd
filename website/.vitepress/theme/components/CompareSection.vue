<script setup lang="ts">
const props = defineProps<{ lang?: string }>()

const comparisons = {
  en: [
    { feature: 'Editor Model', lexx: 'Dual-mode WYSIWYG', others: 'Split pane or raw text' },
    { feature: 'Binary Size', lexx: '~15 MB', others: '100–200 MB' },
    { feature: 'Cold Start', lexx: '< 1 second', others: '3–8 seconds' },
    { feature: 'Memory Usage', lexx: '< 80 MB', others: '200–500 MB' },
    { feature: 'Mermaid Diagrams', lexx: 'Live render in editor', others: 'Plugin or preview only' },
    { feature: 'KaTeX Math', lexx: 'Live render in editor', others: 'Plugin or not supported' },
    { feature: 'Source Mode', lexx: 'CodeMirror 6 (built-in)', others: 'External editor or none' },
    { feature: 'Export Formats', lexx: 'PDF, DOCX, JPEG', others: 'PDF only or plugin' },
    { feature: 'Framework', lexx: 'Tauri 2 (Rust)', others: 'Electron (Node.js)' },
  ],
  zh: [
    { feature: '编辑模式', lexx: '双模所见即所得', others: '分栏或纯文本' },
    { feature: '安装包大小', lexx: '~15 MB', others: '100–200 MB' },
    { feature: '冷启动', lexx: '< 1 秒', others: '3–8 秒' },
    { feature: '内存占用', lexx: '< 80 MB', others: '200–500 MB' },
    { feature: 'Mermaid 图表', lexx: '编辑器内实时渲染', others: '插件或仅预览' },
    { feature: 'KaTeX 数学', lexx: '编辑器内实时渲染', others: '插件或不支持' },
    { feature: '源码模式', lexx: 'CodeMirror 6（内置）', others: '外部编辑器或无' },
    { feature: '导出格式', lexx: 'PDF、DOCX、JPEG', others: '仅 PDF 或插件' },
    { feature: '技术框架', lexx: 'Tauri 2 (Rust)', others: 'Electron (Node.js)' },
  ],
}
</script>

<template>
  <div class="compare-section">
    <h2 class="section-title">{{ lang === 'zh' ? '为什么选择 Lexx' : 'Why Lexx' }}</h2>
    <p class="section-desc">{{ lang === 'zh' ? '与其他主流 Markdown 编辑器的对比' : 'How Lexx compares to mainstream Markdown editors' }}</p>
    <div class="compare-table-wrap">
      <table>
        <thead>
          <tr>
            <th></th>
            <th class="lexx-col">Lexx</th>
            <th>{{ lang === 'zh' ? '其他编辑器' : 'Others' }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in (lang === 'zh' ? comparisons.zh : comparisons.en)" :key="i">
            <td class="feature-name">{{ row.feature }}</td>
            <td class="lexx-val">{{ row.lexx }}</td>
            <td class="other-val">{{ row.others }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.compare-section {
  max-width: 780px;
  margin: 0 auto;
  text-align: center;
}

.section-title {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-2);
  color: var(--lexx-text-primary);
}

.section-desc {
  color: var(--lexx-text-tertiary);
  margin-bottom: var(--space-5);
}

.compare-table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: var(--text-sm);
}

thead th {
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--lexx-border);
  color: var(--lexx-text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: var(--text-xs);
}

.lexx-col {
  color: var(--lexx-accent) !important;
}

tbody td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--lexx-border);
}

.feature-name {
  color: var(--lexx-text-primary);
  font-weight: 500;
}

.lexx-val {
  color: var(--lexx-accent);
  font-weight: 600;
}

.other-val {
  color: var(--lexx-text-tertiary);
}

tr:hover {
  background: var(--lexx-bg-secondary);
}
</style>
