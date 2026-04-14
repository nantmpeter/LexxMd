<template>
  <div class="app">
    <main class="editor-container">
      <div ref="editorEl" />
    </main>
    <StatusBar
      :editor="editor"
      :filename="filename"
      :dirty="dirty"
    />
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createEditor } from './editor/index'
import StatusBar from './ui/StatusBar.vue'
import { fileWrite, saveFileDialog, fileRead, openFileDialog } from './tauri/commands'

const editorEl = ref<HTMLElement | null>(null)
const editor = ref<ReturnType<typeof createEditor> | null>(null)
const filename = ref('Untitled.md')
const filePath = ref<string | null>(null)
const dirty = ref(false)
const toast = ref<{ message: string; type: 'error' | 'success' } | null>(null)

let toastTimeout: ReturnType<typeof setTimeout> | null = null

function showToast(message: string, type: 'error' | 'success' = 'error') {
  if (toastTimeout) clearTimeout(toastTimeout)
  toast.value = { message, type }
  toastTimeout = setTimeout(() => { toast.value = null }, 4000)
}

function getMarkdownContent(): string | null {
  if (!editor.value) return null
  const md = editor.value.storage.markdown?.getMarkdown?.()
  if (typeof md === 'string') return md
  showToast('Failed to serialize document as Markdown')
  return null
}

async function handleSave() {
  const content = getMarkdownContent()
  if (content === null) return

  try {
    if (filePath.value) {
      await fileWrite(filePath.value, content)
      dirty.value = false
      showToast('Saved', 'success')
    } else {
      const chosenPath = await saveFileDialog(filename.value)
      if (chosenPath) {
        await fileWrite(chosenPath, content)
        filePath.value = chosenPath
        const parts = chosenPath.split('/')
        filename.value = parts[parts.length - 1] || 'Untitled.md'
        dirty.value = false
        showToast('Saved', 'success')
      }
    }
  } catch (e) {
    showToast(`Save failed: ${e instanceof Error ? e.message : String(e)}`)
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
    showToast(`Open failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function handleNew() {
  if (!editor.value) return
  editor.value.commands.setContent('')
  filePath.value = null
  filename.value = 'Untitled.md'
  dirty.value = false
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
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault()
    handleNew()
  }
}

async function confirmUnsaved(): Promise<boolean> {
  try {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return await ask('You have unsaved changes. Close anyway?', {
      title: 'Unsaved Changes',
      kind: 'warning',
      okLabel: 'Discard',
      cancelLabel: 'Cancel',
    })
  } catch {
    // Fallback for non-Tauri environment
    return window.confirm('You have unsaved changes. Close anyway?')
  }
}

onMounted(async () => {
  if (editorEl.value) {
    editor.value = createEditor(editorEl.value)

    editor.value.on('update', () => {
      dirty.value = true
    })
  }

  window.addEventListener('keydown', onKeyDown)

  // Prevent closing with unsaved changes
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const appWindow = getCurrentWindow()
    appWindow.onCloseRequested(async (event) => {
      if (dirty.value) {
        event.preventDefault()
        const confirmed = await confirmUnsaved()
        if (confirmed) {
          await appWindow.destroy()
        }
      }
    })
  } catch {
    // Not running in Tauri, ignore
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (toastTimeout) clearTimeout(toastTimeout)
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

/* ── Toast Notification ─────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 48px;
  right: 24px;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 9999;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.toast.error {
  background: #ffeef0;
  color: #86181d;
  border: 1px solid #fdaeb7;
}
.toast.success {
  background: #dcffe4;
  color: #144620;
  border: 1px solid #34d058;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
