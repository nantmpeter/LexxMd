<template>
  <div class="statusbar">
    <div class="statusbar-left">
      <span :class="dirty ? 'dirty' : 'clean'">
        {{ dirty ? 'Unsaved' : 'Saved' }}
      </span>
      <span v-if="wordCount > 0">{{ wordCount }} words</span>
      <span v-if="charCount > 0">{{ charCount }} chars</span>
    </div>
    <div class="statusbar-right">
      <button class="mode-toggle" :class="{ active: sourceMode }" @click="onToggleSource">
        {{ sourceMode ? 'Markdown' : 'Source' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  dirty: boolean
  sourceMode?: boolean
  /**
   * Bumped by the parent on every editor document change. The editor instance
   * is markRaw'd (non-reactive) and its reference never changes, so computeds
   * must consume this counter to recompute while the user types.
   */
  editorVersion?: number
}>()

const emit = defineEmits<{
  'toggle-source': []
}>()

function onToggleSource() {
  emit('toggle-source')
}

const wordCount = computed(() => {
  // Re-run whenever the parent bumps editorVersion (see props doc).
  void props.editorVersion
  if (!props.editor) return 0
  const text = props.editor.getText()
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
})

const charCount = computed(() => {
  void props.editorVersion
  if (!props.editor) return 0
  return props.editor.getText().length
})
</script>
