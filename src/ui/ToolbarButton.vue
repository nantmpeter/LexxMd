<template>
  <button
    class="toolbar-btn"
    :class="{ 'is-active': active }"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{ active?: boolean }>()
</script>
