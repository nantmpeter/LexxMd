<template>
  <form class="find-bar" @submit.prevent="$emit('next')">
    <input
      ref="inputEl"
      :value="query"
      class="find-input"
      type="search"
      placeholder="Find"
      autocomplete="off"
      spellcheck="false"
      @input="$emit('update:query', ($event.target as HTMLInputElement).value)"
      @keydown.escape.prevent="$emit('close')"
      @keydown.enter.prevent="$emit('enter', $event)"
    />
    <input
      :value="replace"
      class="find-input replace-input"
      type="text"
      placeholder="Replace"
      autocomplete="off"
      spellcheck="false"
      @input="$emit('update:replace', ($event.target as HTMLInputElement).value)"
      @keydown.escape.prevent="$emit('close')"
    />
    <span class="find-count">{{ countLabel }}</span>
    <button type="button" class="find-action-btn" :disabled="disabled" @click="$emit('replace')">Replace</button>
    <button type="button" class="find-action-btn" :disabled="disabled" @click="$emit('replace-all')">All</button>
    <button type="button" class="find-btn" title="Previous match" @click="$emit('previous')">↑</button>
    <button type="button" class="find-btn" title="Next match" @click="$emit('next')">↓</button>
    <button type="button" class="find-btn" title="Close find" @click="$emit('close')">×</button>
  </form>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

defineProps<{
  query: string
  replace: string
  countLabel: string
  disabled: boolean
}>()

defineEmits<{
  'update:query': [value: string]
  'update:replace': [value: string]
  next: []
  previous: []
  replace: []
  'replace-all': []
  close: []
  enter: [event: KeyboardEvent]
}>()

const inputEl = ref<HTMLInputElement | null>(null)

function focus() {
  inputEl.value?.focus()
  inputEl.value?.select()
}

// Grab focus as soon as the bar mounts so typing goes into the search field,
// not the editor (the editor's contenteditable would otherwise keep focus).
onMounted(() => {
  // rAF defers until after the browser has laid out the new element, beating
  // any focus the editor tries to retain from the triggering keydown.
  requestAnimationFrame(focus)
})

// Parent drives focus timing (e.g. after replace) via this handle.
defineExpose({
  focus,
  get el() {
    return inputEl.value
  },
})
</script>

<style scoped>
.find-bar {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.find-input {
  width: 220px;
  height: 28px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.replace-input {
  width: 180px;
}

.find-input:focus {
  border-color: var(--accent);
}

.find-count {
  min-width: 44px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.find-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.find-btn:hover {
  background: var(--bg-secondary);
  color: var(--text);
}

.find-action-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.find-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
}

.find-action-btn:disabled {
  color: var(--text-secondary);
  cursor: default;
  opacity: 0.55;
}

@media (max-width: 760px) {
  .find-bar {
    left: 12px;
    right: 12px;
    flex-wrap: wrap;
  }

  .find-input,
  .replace-input {
    flex: 1 1 160px;
    width: auto;
  }
}
</style>
