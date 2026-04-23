<script setup lang="ts">
defineProps<{
  tagline: string
  subtitle: string
  ctaText: string
  ctaLink: string
}>()
</script>

<template>
  <section class="lexx-section hero">
    <h1 class="hero-title">{{ tagline }}</h1>
    <p class="hero-subtitle">{{ subtitle }}</p>
    <div class="hero-actions">
      <a :href="ctaLink" class="lexx-btn lexx-btn-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {{ ctaText }}
      </a>
    </div>

    <!-- Diagonal split screenshot -->
    <div class="hero-screenshot">
      <div class="screenshot-wrapper">
        <img src="/screenshots/dark.png" alt="Lexx Dark Mode" class="screenshot-layer dark-layer" />
        <img src="/screenshots/light.png" alt="Lexx Light Mode" class="screenshot-layer light-layer" />
        <div class="diagonal-divider"></div>
        <div class="mode-label dark-label">Dark</div>
        <div class="mode-label light-label">Light</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
  flex-wrap: wrap;
  justify-content: center;
}

.hero-screenshot {
  margin-top: var(--space-7);
  width: 100%;
  max-width: 860px;
  position: relative;
}

.screenshot-wrapper {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--lexx-border);
  box-shadow: var(--shadow-elevated);
  background: #0d1117;
}

.screenshot-layer {
  width: 100%;
  display: block;
}

.dark-layer {
  position: relative;
  z-index: 1;
}

.light-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 2;
  clip-path: polygon(55% 0, 100% 0, 100% 100%, 40% 100%);
}

.diagonal-divider {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    to bottom right,
    transparent calc(46% - 0.5px),
    rgba(255, 255, 255, 0.15) 46%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0.15) 54%,
    transparent calc(54% + 0.5px)
  );
}

.mode-label {
  position: absolute;
  bottom: 12px;
  z-index: 4;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
}

.dark-label {
  left: 16px;
  background: rgba(0, 0, 0, 0.5);
  color: #8b949e;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.light-label {
  right: 16px;
  background: rgba(255, 255, 255, 0.8);
  color: #6a737d;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

@media (max-width: 768px) {
  .hero-screenshot {
    max-width: 100%;
  }
  .hero-subtitle {
    font-size: var(--text-base);
  }
  .light-layer {
    clip-path: polygon(60% 0, 100% 0, 100% 100%, 35% 100%);
  }
  .mode-label {
    font-size: 10px;
    padding: 2px 8px;
  }
}
</style>
