<template>
  <div class="quick-open-backdrop" @click="$emit('close')">
    <div class="quick-open-panel" @click.stop>
      <input
        ref="inputEl"
        :value="query"
        class="quick-open-input"
        type="search"
        placeholder="Quick open"
        autocomplete="off"
        spellcheck="false"
        @input="onInput"
        @keydown.escape.prevent="$emit('close')"
        @keydown.enter.prevent="openSelected"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
      />
      <div class="quick-open-list">
        <div v-if="loading" class="quick-open-empty">Scanning...</div>
        <div v-else-if="error" class="quick-open-empty">{{ error }}</div>
        <div v-else-if="filteredFiles.length === 0" class="quick-open-empty">No files</div>
        <button
          v-for="(file, index) in filteredFiles"
          v-else
          :key="file.path"
          type="button"
          class="quick-open-item"
          :class="{ active: index === activeIndex }"
          @mouseenter="activeIndex = index"
          @click="$emit('select', file)"
        >
          <span class="quick-open-name">{{ file.name }}</span>
          <span class="quick-open-path">{{ file.relativePath }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { QuickOpenFile } from '../types'

const props = defineProps<{
  files: QuickOpenFile[]
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  select: [file: QuickOpenFile]
  close: []
}>()

const query = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const filteredFiles = computed(() => {
  const q = query.value.trim().toLocaleLowerCase()
  const files = props.files

  if (!q) return files.slice(0, 50)

  const terms = q.split(/\s+/).filter(Boolean)
  return files
    .filter(file => {
      const haystack = file.relativePath.toLocaleLowerCase()
      return terms.every(term => haystack.includes(term))
    })
    .sort((a, b) => scoreFile(b, q) - scoreFile(a, q))
    .slice(0, 50)
})

function scoreFile(file: QuickOpenFile, q: string): number {
  const name = file.name.toLocaleLowerCase()
  const relativePath = file.relativePath.toLocaleLowerCase()
  let score = 0

  if (name === q) score += 100
  if (name.startsWith(q)) score += 50
  if (relativePath.startsWith(q)) score += 25
  if (name.includes(q)) score += 10
  score -= relativePath.length / 1000

  return score
}

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
}

function moveSelection(delta: number) {
  const count = filteredFiles.value.length
  if (count === 0) return
  activeIndex.value = (activeIndex.value + delta + count) % count
}

function openSelected() {
  const file = filteredFiles.value[activeIndex.value]
  if (file) emit('select', file)
}

// Reset selection whenever the query narrows/widens the result set.
watch(query, () => {
  activeIndex.value = 0
})

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped>
.quick-open-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: min(16vh, 120px);
  background: rgba(0, 0, 0, 0.16);
}

.quick-open-panel {
  width: min(640px, calc(100vw - 32px));
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.quick-open-input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  outline: none;
}

.quick-open-list {
  max-height: min(56vh, 420px);
  overflow-y: auto;
  padding: 6px;
}

.quick-open-empty {
  padding: 16px 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.quick-open-item {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(0, 1.4fr);
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}

.quick-open-item.active,
.quick-open-item:hover {
  background: var(--bg-secondary);
}

.quick-open-name,
.quick-open-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-open-name {
  font-size: 13px;
  font-weight: 600;
}

.quick-open-path {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
