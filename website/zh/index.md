---
layout: home
---

<script setup>
import LandingHero from '../.vitepress/theme/components/LandingHero.vue'
import BillboardSection from '../.vitepress/theme/components/BillboardSection.vue'
import FeatureGrid from '../.vitepress/theme/components/FeatureGrid.vue'
import CompareSection from '../.vitepress/theme/components/CompareSection.vue'
import SiteFooter from '../.vitepress/theme/components/SiteFooter.vue'
</script>

<LandingHero
  tagline="写 Markdown，见美感。"
  subtitle="极简隐身界面编辑器，让界面在你写作时消失。原生性能，零干扰。用 Rust 构建。"
  cta-text="免费下载"
  cta-link="/zh/download"
/>

<div class="lexx-section billboard-section">
  <BillboardSection lang="zh" />
</div>

<div class="lexx-section features grid-bg">
  <FeatureGrid lang="zh" />
</div>

<div class="lexx-section compare">
  <CompareSection lang="zh" />
</div>

<div class="lexx-section cta">
  <h2>准备开始？</h2>
  <p style="color: var(--lexx-text-secondary); margin-bottom: var(--space-4);">免费下载 Lexx，无需注册。支持 macOS、Windows 和 Linux。</p>
  <div class="cta-buttons">
    <a href="/zh/download" class="lexx-btn lexx-btn-primary">立即下载</a>
    <a href="/zh/docs/getting-started" class="lexx-btn lexx-btn-ghost">阅读文档</a>
  </div>
</div>

<SiteFooter />

<style scoped>
.billboard-section {
  padding-top: var(--space-7);
  padding-bottom: var(--space-7);
  border-top: 1px solid var(--lexx-border);
}

.compare {
  border-top: 1px solid var(--lexx-border);
  border-bottom: 1px solid var(--lexx-border);
}

.cta-buttons {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  flex-wrap: wrap;
}
</style>
