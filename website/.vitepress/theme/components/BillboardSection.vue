<script setup lang="ts">
const billboards = {
  en: [
    {
      title: 'Type Markdown. See the Result.',
      desc: 'Lexx uses a unique dual-mode editing approach. When your cursor is in a block, you see the raw Markdown syntax — `#` for headings, `**` for bold, `>` for quotes. Move your cursor away and the block instantly renders into beautiful formatted text. No split panes. No preview button. Just write.',
      demo: 'dual-mode',
    },
    {
      title: 'Diagrams & Math, Alive in Your Editor',
      desc: 'Write Mermaid diagrams and LaTeX math in code blocks, and watch them render live. Flowcharts, sequence diagrams, Gantt charts, pie charts — all rendered as SVG directly in the editor. Mathematical formulas typeset with KaTeX. Click to edit the source, click away to see the result.',
      demo: 'mermaid',
    },
    {
      title: 'Built with Rust. Not Electron.',
      desc: 'Lexx is powered by Tauri 2, using a Rust backend instead of Node.js. The result is a ~15 MB binary (vs 100+ MB for Electron apps), instant cold start, and a fraction of the memory usage. Native file dialogs, native menus, native performance — it feels like a real Mac, Windows, or Linux app because it is one.',
      demo: 'performance',
    },
  ],
  zh: [
    {
      title: '写 Markdown，即刻见效果',
      desc: 'Lexx 采用独特的双模编辑方式。当光标在某个块中时，你会看到原始 Markdown 语法——`#` 标记标题、`**` 标记粗体、`>` 标记引用。移开光标，该块即刻渲染为优美的排版文本。无分栏，无需预览按钮，直接写就好。',
      demo: 'dual-mode',
    },
    {
      title: '图表与公式，在编辑器中活起来',
      desc: '在代码块中编写 Mermaid 图表和 LaTeX 数学公式，实时查看渲染结果。流程图、时序图、甘特图、饼图——全部以 SVG 形式直接在编辑器中渲染。数学公式通过 KaTeX 排版。点击编辑源码，点击其他区域查看渲染结果。',
      demo: 'mermaid',
    },
    {
      title: '用 Rust 构建，而非 Electron',
      desc: 'Lexx 基于 Tauri 2，使用 Rust 后端而非 Node.js。结果是约 15 MB 的安装包（Electron 应用通常 100+ MB），冷启动即时完成，内存占用仅为前者的一小部分。原生文件对话框、原生菜单、原生性能——它就是一个真正的 Mac、Windows 或 Linux 应用。',
      demo: 'performance',
    },
  ],
}
</script>

<template>
  <div class="billboards">
    <div v-for="(b, i) in (lang === 'zh' ? billboards.zh : billboards.en)" :key="i" class="billboard" :class="{ reverse: i % 2 === 1 }">
      <div class="billboard-text">
        <h2>{{ b.title }}</h2>
        <p>{{ b.desc }}</p>
      </div>
      <div class="billboard-visual">
        <div v-if="b.demo === 'dual-mode'" class="demo-box dual-demo">
          <div class="demo-block active">
            <span class="marker"># </span><span class="content">Dual-Mode Editing</span>
          </div>
          <div class="demo-block rendered">
            <span class="rendered-text">Type <strong>Markdown</strong>, see <em>beauty</em>.</span>
          </div>
          <div class="demo-block rendered">
            <span class="rendered-text">Everything renders when you move away.</span>
          </div>
        </div>
        <div v-else-if="b.demo === 'mermaid'" class="demo-box mermaid-demo">
          <div class="mermaid-placeholder">
            <svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="10" width="70" height="30" rx="6" stroke="#0366d6" stroke-width="1.5" fill="rgba(3,102,214,0.06)"/>
              <text x="45" y="30" text-anchor="middle" fill="#0366d6" font-size="10">Start</text>
              <rect x="110" y="10" width="70" height="30" rx="6" stroke="#0366d6" stroke-width="1.5" fill="rgba(3,102,214,0.06)"/>
              <text x="145" y="30" text-anchor="middle" fill="#0366d6" font-size="10">Process</text>
              <line x1="80" y1="25" x2="110" y2="25" stroke="#6a737d" stroke-width="1" marker-end="url(#arrow)"/>
              <rect x="60" y="70" width="70" height="30" rx="6" stroke="#0366d6" stroke-width="1.5" fill="rgba(3,102,214,0.06)"/>
              <text x="95" y="90" text-anchor="middle" fill="#0366d6" font-size="10">End</text>
              <line x1="145" y1="40" x2="95" y2="70" stroke="#6a737d" stroke-width="1" marker-end="url(#arrow)"/>
              <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6a737d"/></marker></defs>
            </svg>
            <div class="math-preview">E = mc<sup>2</sup> &nbsp;|&nbsp; ∫<sub>0</sub><sup>∞</sup> e<sup>-x²</sup>dx = √π/2</div>
          </div>
        </div>
        <div v-else-if="b.demo === 'performance'" class="demo-box perf-demo">
          <div class="perf-bar-group">
            <div class="perf-label">Lexx (Tauri)</div>
            <div class="perf-bar active" style="width: 15%"><span>~15 MB</span></div>
          </div>
          <div class="perf-bar-group">
            <div class="perf-label">Other editors (Electron)</div>
            <div class="perf-bar" style="width: 80%"><span>~100 MB</span></div>
          </div>
          <div class="perf-bar-group">
            <div class="perf-label">Obsidian (Electron)</div>
            <div class="perf-bar" style="width: 95%"><span>~150 MB</span></div>
          </div>
          <div class="perf-note">{{ lang === 'zh' ? '冷启动 < 1秒，内存占用 < 80MB' : 'Cold start < 1s, memory usage < 80MB' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { props: { lang: { type: String, default: 'en' } } }
</script>

<style scoped>
.billboards {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.billboard {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.billboard.reverse {
  flex-direction: row-reverse;
}

.billboard-text {
  flex: 1;
  min-width: 0;
}

.billboard-text h2 {
  font-size: var(--text-3xl);
  line-height: 1.2;
  margin-bottom: var(--space-3);
}

.billboard-text p {
  font-size: var(--text-base);
  color: var(--lexx-text-secondary);
  line-height: 1.7;
}

.billboard-visual {
  flex: 1;
  min-width: 0;
}

.demo-box {
  background: var(--lexx-bg-secondary);
  border: 1px solid var(--lexx-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  min-height: 200px;
}

/* Dual-mode demo */
.dual-demo {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.demo-block {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}

.demo-block.active {
  background: var(--lexx-bg-tertiary);
  border: 1px solid var(--lexx-accent);
}

.demo-block.active .marker {
  color: var(--lexx-accent);
  font-weight: 600;
  margin-right: 4px;
}

.demo-block.active .content {
  color: var(--lexx-text-primary);
  font-weight: 700;
  font-size: var(--text-xl);
}

.demo-block.rendered {
  background: var(--lexx-bg-primary);
  border: 1px solid var(--lexx-border);
}

.rendered-text {
  color: var(--lexx-text-secondary);
  font-size: var(--text-base);
}

.rendered-text strong {
  color: var(--lexx-text-primary);
  font-weight: 600;
}

.rendered-text em {
  color: var(--lexx-text-secondary);
}

/* Mermaid demo */
.mermaid-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--space-4);
}

.mermaid-placeholder svg {
  width: 100%;
  max-width: 280px;
}

.math-preview {
  font-family: var(--font-sans);
  color: var(--lexx-text-secondary);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  background: var(--lexx-bg-tertiary);
  border-radius: var(--radius-sm);
  letter-spacing: 0.5px;
}

.math-preview sup {
  font-size: 0.7em;
}

.math-preview sub {
  font-size: 0.7em;
}

/* Performance demo */
.perf-demo {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-6);
  padding-bottom: var(--space-6);
}

.perf-bar-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.perf-label {
  font-size: var(--text-sm);
  color: var(--lexx-text-tertiary);
}

.perf-bar {
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--lexx-bg-tertiary);
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  min-width: 80px;
}

.perf-bar span {
  font-size: var(--text-xs);
  color: var(--lexx-text-tertiary);
  font-weight: 500;
  white-space: nowrap;
}

.perf-bar.active {
  background: var(--lexx-accent);
}

.perf-bar.active span {
  color: #fff;
}

.perf-note {
  font-size: var(--text-sm);
  color: var(--lexx-text-tertiary);
  text-align: center;
  margin-top: var(--space-2);
}

@media (max-width: 768px) {
  .billboard,
  .billboard.reverse {
    flex-direction: column;
  }

  .billboard-text h2 {
    font-size: var(--text-2xl);
  }
}
</style>
