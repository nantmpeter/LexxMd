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
  tagline="Write Markdown. See Beauty."
  subtitle="A minimal Stealth UI editor that disappears when you write. Native performance, zero distraction. Built with Rust."
  cta-text="Download for Free"
  cta-link="/en/download"
/>

<div class="lexx-section billboard-section">
  <BillboardSection lang="en" />
</div>

<div class="lexx-section features grid-bg">
  <FeatureGrid lang="en" />
</div>

<div class="lexx-section compare">
  <CompareSection lang="en" />
</div>

<div class="lexx-section cta">
  <h2>Ready to Write?</h2>
  <p style="color: var(--lexx-text-secondary); margin-bottom: var(--space-4);">Download Lexx for free. No account required. Works on macOS, Windows, and Linux.</p>
  <div class="cta-buttons">
    <a href="/en/download" class="lexx-btn lexx-btn-primary">Download Now</a>
    <a href="/en/docs/getting-started" class="lexx-btn lexx-btn-ghost">Read the Docs</a>
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
