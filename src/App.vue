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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createEditor } from './editor/index'
import Toolbar from './ui/Toolbar.vue'
import StatusBar from './ui/StatusBar.vue'
import { fileWrite, saveFileDialog, fileRead, openFileDialog } from './tauri/commands'

const editorEl = ref<HTMLElement | null>(null)
const editor = ref<ReturnType<typeof createEditor> | null>(null)
const filename = ref('Untitled.md')
const filePath = ref<string | null>(null)
const dirty = ref(false)

async function handleSave() {
  if (!editor.value) return

  const content = editor.value.storage.markdown?.getMarkdown?.() ?? editor.value.getText()

  if (filePath.value) {
    // Save to existing file path
    try {
      await fileWrite(filePath.value, content)
      dirty.value = false
    } catch (e) {
      console.error('Failed to save file:', e)
    }
  } else {
    // No file path yet -- open save dialog
    try {
      const chosenPath = await saveFileDialog(filename.value)
      if (chosenPath) {
        await fileWrite(chosenPath, content)
        filePath.value = chosenPath
        // Extract filename from path
        const parts = chosenPath.split('/')
        filename.value = parts[parts.length - 1] || 'Untitled.md'
        dirty.value = false
      }
    } catch (e) {
      console.error('Failed to save file:', e)
    }
  }
}

async function handleOpen() {
  if (!editor.value) return

  try {
    const result = await openFileDialog()
    if (result) {
      editor.value.commands.setContent(result.content)
      filePath.value = result.path
      const parts = result.path.split('/')
      filename.value = parts[parts.length - 1] || 'Untitled.md'
      dirty.value = false
    }
  } catch (e) {
    console.error('Failed to open file:', e)
  }
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    handleSave()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault()
    handleOpen()
  }
}

onMounted(() => {
  if (editorEl.value) {
    editor.value = createEditor(editorEl.value)

    editor.value.on('update', () => {
      dirty.value = true
    })
  }

  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (editor.value) {
    editor.value.destroy()
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
