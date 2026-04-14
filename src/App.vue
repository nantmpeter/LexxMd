<template>
  <div class="app">
    <main class="editor-container">
      <div ref="editorEl" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createEditor } from './editor/index'

const editorEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (editorEl.value) {
    createEditor(editorEl.value)
  }
})
</script>

<style>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.editor-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px max(40px, calc((100% - 800px) / 2));
}
</style>
