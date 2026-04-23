<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <img src="/lexx.png" alt="Lexx" class="footer-logo" />
      <p class="footer-copy">&copy; {{ year }} Lexx. All rights reserved.</p>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--lexx-border);
  padding: var(--space-5) var(--space-5);
}

.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.footer-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.footer-copy {
  color: var(--lexx-text-tertiary);
  font-size: var(--text-sm);
}
</style>
