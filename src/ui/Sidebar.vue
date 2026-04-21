<template>
  <!-- Desktop: floating sidebar -->
  <Transition name="sidebar">
    <div
      v-if="mode !== 'hidden' && wideEnough"
      ref="sidebarRoot"
      class="sidebar-root"
    >
      <div v-if="mode === 'flat'" class="sidebar-header">
        <span class="sidebar-title">Files</span>
        <button class="sidebar-btn" @click="$emit('openFolder')" title="Open Folder">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1.5 1.5 0 011.06.44l.828.828a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 11.5v-8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="sidebar-scroll">
        <SidebarFlatList
          v-if="mode === 'flat'"
          :open-files="openFiles"
          :active-file-id="activeFileId"
          @select="$emit('selectFile', $event)"
          @close="$emit('closeFile', $event)"
        />
        <SidebarTree
          v-if="mode === 'tree'"
          :root-path="rootPath"
          :active-path="activeFilePath"
          @open-file="$emit('openFile', $event)"
        />
      </div>
    </div>
  </Transition>

  <!-- Narrow screen: edge-trigger overlay -->
  <template v-if="mode !== 'hidden' && !wideEnough">
    <div
      class="edge-trigger left"
      @mouseenter="scheduleShow"
      @mouseleave="cancelShow"
    >
      <span class="edge-chevron">&#8249;</span>
    </div>
    <Transition name="overlay-backdrop">
      <div
        v-if="overlayOpen"
        class="sidebar-overlay-backdrop"
        @click="hideOverlay"
      />
    </Transition>
    <Transition name="overlay-panel">
      <div
        v-if="overlayOpen"
        class="sidebar-overlay"
        @mouseenter="cancelHide"
        @mouseleave="scheduleHide"
      >
        <div class="sidebar-overlay-body">
          <SidebarFlatList
            v-if="mode === 'flat'"
            :open-files="openFiles"
            :active-file-id="activeFileId"
            @select="$emit('selectFile', $event)"
            @close="$emit('closeFile', $event)"
          />
          <SidebarTree
            v-if="mode === 'tree'"
            :root-path="rootPath"
            :active-path="activeFilePath"
            @open-file="$emit('openFile', $event)"
          />
        </div>
      </div>
    </Transition>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SidebarFlatList from './SidebarFlatList.vue'
import SidebarTree from './SidebarTree.vue'
import type { FileSlot, SidebarMode } from '../types'

const props = defineProps<{
  mode: SidebarMode
  openFiles: FileSlot[]
  activeFileId: string
  activeFilePath: string
  rootPath: string
}>()

defineEmits<{
  selectFile: [id: string]
  closeFile: [slot: FileSlot]
  openFile: [path: string]
  openFolder: []
}>()

const width = ref(200)
const wideEnough = ref(false)
const overlayOpen = ref(false)
const sidebarRoot = ref<HTMLElement | null>(null)

const rootName = computed(() => {
  if (!props.rootPath) return 'Explorer'
  const parts = props.rootPath.split(/[/\\]/)
  return parts[parts.length - 1] || 'Explorer'
})

function checkVisibility() {
  wideEnough.value = window.innerWidth >= 1100
  if (wideEnough.value) overlayOpen.value = false
}

let hideTimer: ReturnType<typeof setTimeout> | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null

function scheduleShow() {
  cancelHide()
  showTimer = setTimeout(() => { overlayOpen.value = true }, 80)
}
function cancelShow() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
}
function scheduleHide() {
  hideTimer = setTimeout(() => { overlayOpen.value = false }, 200)
}
function cancelHide() {
  cancelShow()
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}

onMounted(() => {
  checkVisibility()
  window.addEventListener('resize', checkVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkVisibility)
})
</script>

<style scoped>
.sidebar-root {
  position: fixed;
  top: 0;
  left: clamp(8px, 1.5vw, 24px);
  width: calc((100vw - 800px) / 2 - clamp(16px, 3vw, 48px));
  max-width: 300px;
  max-height: calc(100vh - 48px);
  z-index: 10;
  pointer-events: auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;

  -webkit-mask-image: linear-gradient(
    to bottom,
    black 0%,
    black 96%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    black 0%,
    black 96%,
    transparent 100%
  );
}

.sidebar-root::-webkit-scrollbar {
  width: 3px;
}
.sidebar-root::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-root::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 4px;
  user-select: none;
}

.sidebar-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.sidebar-root:hover .sidebar-btn {
  opacity: 1;
}
.sidebar-btn:hover {
  color: var(--text);
}

.sidebar-scroll {
  overflow: visible;
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.3s ease;
}
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}

/* ── Edge trigger (narrow screen) ────────────────────────── */
.edge-trigger {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 15;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.edge-trigger.left {
  left: 0;
  width: 28px;
  height: 120px;
  padding-left: 4px;
  justify-content: flex-start;
}
.edge-chevron {
  font-size: 24px;
  color: var(--text-secondary);
  opacity: 0.35;
  transition: opacity 0.2s;
  user-select: none;
}
.edge-trigger:hover .edge-chevron {
  opacity: 0.85;
}

/* ── Overlay (narrow screen) ──────────────────────────────── */
.sidebar-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 998;
}
.overlay-backdrop-enter-active,
.overlay-backdrop-leave-active {
  transition: opacity 0.15s ease;
}
.overlay-backdrop-enter-from,
.overlay-backdrop-leave-to {
  opacity: 0;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 220px;
  height: 100vh;
  background: var(--bg);
  border-right: 1px solid var(--border);
  z-index: 999;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.1);
  padding: 48px 0 48px 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.sidebar-overlay::-webkit-scrollbar {
  width: 3px;
}
.sidebar-overlay::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-overlay::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.sidebar-overlay-body {
  padding: 4px 0;
}

.overlay-panel-enter-active,
.overlay-panel-leave-active {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.overlay-panel-enter-from,
.overlay-panel-leave-to {
  transform: translateX(-100%);
}
</style>
