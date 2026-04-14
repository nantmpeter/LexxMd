<template>
  <div class="app">
    <Toolbar :editor="editor" />
    <main class="editor-container">
      <div ref="editorEl" />
    </main>
    <StatusBar
      :editor="editor"
      :filename="filename"
      :dirty="dirty"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createEditor } from './editor/index'
import Toolbar from './ui/Toolbar.vue'
import StatusBar from './ui/StatusBar.vue'

const editorEl = ref<HTMLElement | null>(null)
const editor = ref<ReturnType<typeof createEditor> | null>(null)
const filename = ref('Untitled.md')
const dirty = ref(false)

onMounted(() => {
  if (editorEl.value) {
    editor.value = createEditor(editorEl.value)

    editor.value.on('update', () => {
      dirty.value = true
    })
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
