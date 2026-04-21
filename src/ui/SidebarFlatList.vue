<template>
  <div class="sidebar-flat">
    <div
      v-for="slot in openFiles"
      :key="slot.id"
      class="flat-item"
      :class="{ active: slot.id === activeFileId }"
      @click="$emit('select', slot.id)"
    >
      <span class="flat-name" :title="slot.filename">{{ slot.filename }}</span>
      <span v-if="slot.dirty" class="flat-dot" />
      <button
        class="flat-close"
        @click.stop="$emit('close', slot)"
        title="Close"
      >&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileSlot } from '../types'

defineProps<{
  openFiles: FileSlot[]
  activeFileId: string
}>()

defineEmits<{
  select: [id: string]
  close: [slot: FileSlot]
}>()
</script>

<style scoped>
.sidebar-flat {
  padding: 4px 0;
  user-select: none;
}
.flat-item {
  display: flex;
  align-items: center;
  padding: 4px 8px 4px 10px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  gap: 6px;
  position: relative;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}
.flat-item:hover {
  background: var(--bg-secondary);
  color: var(--text);
}
.flat-item.active {
  color: var(--text);
  font-weight: 500;
}
.flat-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  bottom: 5px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent);
}
.flat-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flat-item:hover .flat-name {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 5;
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 4px 8px 4px 10px;
  white-space: nowrap;
  overflow: visible;
}
.flat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
.flat-close {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
}
.flat-item:hover .flat-close {
  opacity: 1;
}
.flat-close:hover {
  color: var(--text);
}
</style>
