<template>
  <div class="sidebar-tree">
    <tree-node-comp
      v-for="node in treeData"
      :key="node.path"
      :node="node"
      :depth="0"
      :active-path="activePath"
      @toggle="onToggle"
      @open="$emit('openFile', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { listDirectory } from '../tauri/commands'
import type { TreeNode } from '../types'
import TreeNodeComp from './SidebarTreeNode.vue'

const props = defineProps<{
  rootPath: string
  activePath: string
}>()

defineEmits<{
  openFile: [path: string]
}>()

const treeData = ref<TreeNode[]>([])

function dirEntryToNode(entry: { name: string; path: string; is_dir: boolean; is_markdown: boolean }): TreeNode {
  return {
    name: entry.name,
    path: entry.path,
    isDir: entry.is_dir,
    isMarkdown: entry.is_markdown,
    children: [],
    expanded: false,
    loaded: false,
  }
}

async function loadRoot() {
  try {
    const entries = await listDirectory(props.rootPath)
    treeData.value = entries.map(dirEntryToNode)
  } catch {
    // silent
  }
}

async function onToggle(node: TreeNode) {
  if (!node.isDir) return
  if (!node.loaded) {
    try {
      const entries = await listDirectory(node.path)
      node.children = entries.map(dirEntryToNode)
      node.loaded = true
    } catch {
      return
    }
  }
  node.expanded = !node.expanded
}

onMounted(loadRoot)

// The sidebar only v-if-remounts this component when the sidebar *mode*
// changes; opening a different folder while already in tree mode keeps the
// component alive with a stale rootPath. Reload on every rootPath change.
watch(() => props.rootPath, loadRoot)
</script>

<style scoped>
.sidebar-tree {
  user-select: none;
}
</style>
