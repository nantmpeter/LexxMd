<template>
  <div class="statusbar">
    <div class="statusbar-left">
      <span>{{ filename }}</span>
      <span :class="dirty ? 'dirty' : 'clean'">
        {{ dirty ? 'Unsaved' : 'Saved' }}
      </span>
      <span>{{ wordCount }} words</span>
    </div>
    <div class="statusbar-right">
      <span>{{ charCount }} chars</span>
      <span>Markdown</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Editor } from '@tiptap/core'

const props = defineProps<{
  editor: Editor | null
  filename: string
  dirty: boolean
}>()

const wordCount = computed(() => {
  if (!props.editor) return 0
  const text = props.editor.getText()
  return text.trim() ? text.trim().split(/\s+/).length : 0
})

const charCount = computed(() => {
  if (!props.editor) return 0
  return props.editor.getText().length
})
</script>
