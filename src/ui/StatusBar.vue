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
      <button class="mode-toggle" :class="{ active: sourceMode }" @click="$emit('toggle-source')">
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
}>()

defineEmits<{
  'toggle-source': []
}>()

const wordCount = computed(() => {
  if (!props.editor) return 0
  const text = props.editor.getText()
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
})

const charCount = computed(() => {
  if (!props.editor) return 0
  return props.editor.getText().length
})
</script>
