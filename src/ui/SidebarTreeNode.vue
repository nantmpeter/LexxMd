<template>
  <div
    class="tree-node"
    :class="{ 'is-dir': node.isDir, 'is-disabled': !node.isDir && !node.isMarkdown, 'is-active': !node.isDir && node.path === activePath }"
    :style="{ paddingLeft: depth * 16 + 'px' }"
  >
    <div class="tree-row" @click="onClick">
      <span v-if="node.isDir" class="tree-chevron" :class="{ expanded: node.expanded }">&#9654;</span>
      <span v-else class="tree-file-icon">&#8203;</span>
      <span class="tree-name" :title="node.name">{{ node.name }}</span>
    </div>
    <template v-if="node.isDir && node.expanded && node.children.length">
      <sidebar-tree-node
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :active-path="activePath"
        @toggle="$emit('toggle', $event)"
        @open="$emit('open', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '../types'

const props = defineProps<{
  node: TreeNode
  depth: number
  activePath: string
}>()

const emit = defineEmits<{
  toggle: [node: TreeNode]
  open: [path: string]
}>()

function onClick() {
  if (props.node.isDir) {
    emit('toggle', props.node)
  } else if (props.node.isMarkdown) {
    emit('open', props.node.path)
  }
}
</script>

<style scoped>
.tree-row {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  cursor: pointer;
  gap: 4px;
  border-radius: 3px;
  position: relative;
  color: var(--text-secondary);
  transition: color 0.15s;
}
/* Only files get hover effect, not folders */
.tree-node:not(.is-dir) > .tree-row:hover {
  background: var(--bg-secondary);
  color: var(--text);
}
.tree-node:not(.is-dir) > .tree-row:hover .tree-name {
  position: absolute;
  left: -4px;
  right: -4px;
  z-index: 5;
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 3px 8px;
  white-space: nowrap;
  overflow: visible;
}
.is-active > .tree-row {
  color: var(--text);
  font-weight: 500;
}
.is-active > .tree-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  bottom: 5px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent);
}
.tree-chevron {
  font-size: 8px;
  color: var(--text-secondary);
  transition: transform 0.15s;
  width: 12px;
  text-align: center;
  flex-shrink: 0;
}
.tree-chevron.expanded {
  transform: rotate(90deg);
}
.tree-file-icon {
  width: 12px;
  flex-shrink: 0;
}
.tree-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.is-disabled .tree-row {
  opacity: 0.35;
  pointer-events: none;
}
</style>
