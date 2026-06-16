<template>
  <!-- Desktop: fixed sidebar outline -->
  <Transition name="outline">
    <div
      v-if="visible"
      ref="outlineRoot"
      class="outline-root"
    >
      <div
        v-for="(h, i) in headings"
        :key="h.id"
        class="outline-item"
        :class="[`level-${h.level}`, { active: i === activeIndex }]"
        @click="scrollToHeading(h, i)"
      >
        <span class="outline-text" :title="h.text || '(untitled)'">{{ h.text || '(untitled)' }}</span>
      </div>
    </div>
  </Transition>

  <!-- Narrow screen: edge-trigger overlay -->
  <template v-if="isNarrow && headings.length > 0">
    <div
      class="outline-edge-trigger right"
      @mouseenter="scheduleOverlayShow"
      @mouseleave="cancelOverlayShow"
    >
      <span class="outline-edge-chevron">&#8250;</span>
    </div>
    <Transition name="overlay-backdrop">
      <div
        v-if="overlayOpen"
        class="outline-overlay-backdrop"
        @click="overlayOpen = false"
      />
    </Transition>
    <Transition name="overlay-panel">
      <div
        v-if="overlayOpen"
        ref="overlayRoot"
        class="outline-overlay"
        @mouseenter="cancelOverlayHide"
        @mouseleave="scheduleOverlayHide"
      >
        <div class="outline-overlay-body">
          <div
            v-for="(h, i) in headings"
            :key="h.id"
            class="outline-item"
            :class="[`level-${h.level}`, { active: i === activeIndex }]"
            @click="scrollToHeading(h, i); overlayOpen = false"
          >
            <span class="outline-text" :title="h.text || '(untitled)'">{{ h.text || '(untitled)' }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </template>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Editor } from '@tiptap/core'

interface HeadingItem {
  level: number
  text: string
  docOffset: number
  id: number
}

const props = defineProps<{
  editor: Editor | null
  container: HTMLElement | null
}>()

const headings = ref<HeadingItem[]>([])
const activeIndex = ref(-1)
const visible = ref(false)
const outlineRoot = ref<HTMLElement | null>(null)
const overlayRoot = ref<HTMLElement | null>(null)
const overlayOpen = ref(false)

const isNarrow = ref(window.innerWidth < 1240)

let isEditorScrolling = false
let overlayShowTimer: ReturnType<typeof setTimeout> | null = null
let overlayHideTimer: ReturnType<typeof setTimeout> | null = null

function scheduleOverlayShow() {
  cancelOverlayHide()
  overlayShowTimer = setTimeout(() => { overlayOpen.value = true }, 80)
}
function cancelOverlayShow() {
  if (overlayShowTimer) { clearTimeout(overlayShowTimer); overlayShowTimer = null }
}
function scheduleOverlayHide() {
  overlayHideTimer = setTimeout(() => { overlayOpen.value = false }, 200)
}
function cancelOverlayHide() {
  cancelOverlayShow()
  if (overlayHideTimer) { clearTimeout(overlayHideTimer); overlayHideTimer = null }
}

// ── Heading extraction ──────────────────────────────────────

function extractHeadings(editor: Editor): HeadingItem[] {
  const result: HeadingItem[] = []
  let id = 0
  editor.state.doc.forEach((node: any, offset: number) => {
    if (node.type.name === 'heading') {
      result.push({
        level: node.attrs.level,
        text: node.textContent,
        docOffset: offset,
        id: id++,
      })
    }
  })
  return result
}

function refreshHeadings() {
  if (!props.editor) return
  headings.value = extractHeadings(props.editor)
  checkVisibility()
  updateActiveFromEditor()
}

// ── Editor → outline highlight + scroll ──────────────────────

function updateActiveFromEditor() {
  if (!props.editor || !props.container || headings.value.length === 0) return

  const view = props.editor.view
  const containerRect = props.container.getBoundingClientRect()
  const threshold = containerRect.top + (containerRect.height / 3)

  let best = -1
  let bestTop = -Infinity
  for (let i = 0; i < headings.value.length; i++) {
    try {
      const coords = view.coordsAtPos(headings.value[i].docOffset + 1)
      if (coords.top <= threshold && coords.top > bestTop) {
        bestTop = coords.top
        best = i
      }
    } catch {}
  }

  if (best < 0) return

  const current = activeIndex.value
  if (current < 0) {
    activeIndex.value = best
    return
  }

  // Only ±1 step per frame to prevent jumps
  if (best > current) activeIndex.value = current + 1
  else if (best < current) activeIndex.value = current - 1
}

function scrollOutlineToIndex(idx: number) {
  const root = outlineRoot.value || overlayRoot.value
  if (idx < 0 || !root) return
  const items = root.querySelectorAll('.outline-item')
  const el = items[idx] as HTMLElement | undefined
  if (!el) return

  const elTop = el.offsetTop
  const elBottom = elTop + el.clientHeight
  const viewTop = root.scrollTop
  const viewBottom = viewTop + root.clientHeight

  if (elTop >= viewTop && elBottom <= viewBottom) return

  if (elBottom > viewBottom) {
    root.scrollTo({ top: elBottom - root.clientHeight + 8, behavior: 'smooth' })
  } else if (elTop < viewTop) {
    root.scrollTo({ top: Math.max(0, elTop - 8), behavior: 'smooth' })
  }
}

watch(activeIndex, (idx) => {
  scrollOutlineToIndex(idx)
})

// ── Click → scroll editor to heading ─────────────────────────

function scrollToHeading(heading: HeadingItem, index: number) {
  if (!props.editor || !props.container) return

  activeIndex.value = index

  const pos = heading.docOffset + 1
  const { view } = props.editor

  try {
    const coords = view.coordsAtPos(pos)
    const rect = props.container.getBoundingClientRect()
    const target = props.container.scrollTop + (coords.top - rect.top) - rect.height / 3
    isEditorScrolling = true
    props.container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    setTimeout(() => { isEditorScrolling = false }, 500)
  } catch {}
}

// ── Responsive visibility ───────────────────────────────────

function checkVisibility() {
  isNarrow.value = window.innerWidth < 1200
  visible.value = !isNarrow.value && headings.value.length > 0
  if (isNarrow.value) overlayOpen.value = false
}

// ── Editor scroll listener (throttled) ──────────────────────

let scrollRaf = 0
function onEditorScroll() {
  if (isEditorScrolling) return
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    updateActiveFromEditor()
    scrollRaf = 0
  })
}

// ── Lifecycle ───────────────────────────────────────────────

watch(() => props.editor, (editor, _previous, onCleanup) => {
  if (!editor) {
    headings.value = []
    activeIndex.value = -1
    visible.value = false
    overlayOpen.value = false
    return
  }

  refreshHeadings()
  editor.on('update', refreshHeadings)
  editor.on('selectionUpdate', updateActiveFromEditor)

  onCleanup(() => {
    editor.off('update', refreshHeadings)
    editor.off('selectionUpdate', updateActiveFromEditor)
  })
}, { immediate: true })

watch(() => props.container, (container, _previous, onCleanup) => {
  if (!container) return

  container.addEventListener('scroll', onEditorScroll, { passive: true })
  onCleanup(() => {
    container.removeEventListener('scroll', onEditorScroll)
  })
}, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', checkVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkVisibility)
  cancelOverlayHide()
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})
</script>

<style scoped>
/* ── Desktop fixed outline ──────────────────────────────── */
.outline-root {
  position: fixed;
  top: 0;
  right: clamp(8px, 1.5vw, 24px);
  width: calc((100vw - 800px) / 2 - clamp(16px, 3vw, 48px));
  max-width: 260px;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  z-index: 10;
  pointer-events: auto;
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

.outline-root::-webkit-scrollbar {
  width: 3px;
}
.outline-root::-webkit-scrollbar-track {
  background: transparent;
}
.outline-root::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

/* ── Shared outline item styles ─────────────────────────── */
.outline-item {
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 6px;
  border-radius: 3px;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-secondary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
}

.outline-item:hover {
  background: var(--bg-secondary);
  color: var(--text);
  overflow: visible;
}
.outline-item:hover .outline-text {
  position: absolute;
  left: -6px;
  right: -6px;
  z-index: 5;
  background: var(--bg-secondary);
  border-radius: 3px;
  padding: 0 6px;
  white-space: nowrap;
  overflow: visible;
}

.outline-item.active {
  color: var(--accent);
  font-weight: 700;
}

.outline-item.active .outline-text {
  font-size: 13px;
}

.outline-item.level-1 .outline-text { font-size: 12px; font-weight: 600; }
.outline-item.level-2 .outline-text { font-size: 11.5px; }
.outline-item.level-3 .outline-text { font-size: 11px; padding-left: 8px; }
.outline-item.level-4 .outline-text { font-size: 11px; padding-left: 16px; }
.outline-item.level-5 .outline-text { font-size: 10.5px; padding-left: 22px; }
.outline-item.level-6 .outline-text { font-size: 10.5px; padding-left: 28px; }

/* ── Edge trigger (narrow screen) ────────────────────────── */
.outline-edge-trigger {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 15;
  display: flex;
  align-items: center;
  cursor: pointer;
}
.outline-edge-trigger.right {
  right: 0;
  width: 28px;
  height: 120px;
  padding-right: 4px;
  justify-content: flex-end;
}
.outline-edge-chevron {
  font-size: 24px;
  color: var(--text-secondary);
  opacity: 0.35;
  transition: opacity 0.2s;
  user-select: none;
}
.outline-edge-trigger:hover .outline-edge-chevron {
  opacity: 0.85;
}

/* ── Overlay backdrop ──────────────────────────────────── */
.outline-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
}

.overlay-backdrop-enter-active,
.overlay-backdrop-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-backdrop-enter-from,
.overlay-backdrop-leave-to {
  opacity: 0;
}

/* ── Overlay panel (narrow screen) ──────────────────────── */
.outline-overlay {
  position: fixed;
  top: 0;
  right: 0;
  width: 220px;
  height: 100vh;
  background: var(--bg);
  border-left: 1px solid var(--border);
  z-index: 999;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  padding: 48px 0 48px 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.outline-overlay::-webkit-scrollbar {
  width: 3px;
}
.outline-overlay::-webkit-scrollbar-track {
  background: transparent;
}
.outline-overlay::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.outline-overlay-body {
  padding: 4px 8px;
}

.overlay-panel-enter-active,
.overlay-panel-leave-active {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.overlay-panel-enter-from,
.overlay-panel-leave-to {
  transform: translateX(100%);
}

/* ── Desktop outline show/hide transition ───────────────── */
.outline-enter-active,
.outline-leave-active {
  transition: opacity 0.4s ease;
}
.outline-enter-from,
.outline-leave-to {
  opacity: 0;
}
</style>
