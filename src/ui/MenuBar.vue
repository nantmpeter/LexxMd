<template>
  <div class="menu-bar" @keydown.escape="closeAll">
    <div
      v-for="menu in menus"
      :key="menu.label"
      class="menu-trigger"
      :class="{ open: openMenu === menu.label }"
      @click.stop="toggleMenu(menu.label)"
      @mouseenter="openMenu && switchMenu(menu.label)"
    >
      <span class="menu-label">{{ menu.label }}</span>
      <Transition name="menu-dropdown">
        <div v-if="openMenu === menu.label" class="menu-dropdown">
          <template v-for="(item, i) in menu.items" :key="i">
            <div v-if="item === '---'" class="menu-separator" />
            <button
              v-else
              class="menu-item"
              @click.stop="onItemClick(item.action)"
            >
              <span class="menu-item-label">{{ item.label }}</span>
              <span v-if="item.accel" class="menu-item-accel">{{ item.accel }}</span>
            </button>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface MenuItem {
  label: string
  action: string
  accel?: string
}

interface MenuDef {
  label: string
  items: (MenuItem | '---')[]
}

const emit = defineEmits<{
  'menu-event': [id: string]
}>()

const menus: MenuDef[] = [
  {
    label: 'File',
    items: [
      { label: 'New', action: 'fn', accel: 'Ctrl+N' },
      { label: 'Open...', action: 'fo', accel: 'Ctrl+O' },
      { label: 'Quick Open...', action: 'fq', accel: 'Ctrl+P' },
      { label: 'Open Folder...', action: 'ff', accel: 'Ctrl+Shift+O' },
      '---',
      { label: 'Save', action: 'fs', accel: 'Ctrl+S' },
      { label: 'Print...', action: 'pr', accel: 'Ctrl+Alt+P' },
      '---',
      { label: 'Preferences...', action: 'prefs', accel: 'Ctrl+,' },
      '---',
      { label: 'Export as PDF...', action: 'ep' },
      { label: 'Export as DOCX...', action: 'ed' },
      { label: 'Export as JPEG...', action: 'ej' },
      '---',
      { label: 'Close', action: 'fc', accel: 'Ctrl+W' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Find...', action: 'ef', accel: 'Ctrl+F' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Source Mode', action: 'vs' },
      { label: 'Toggle Full Screen', action: 'vf', accel: 'F11' },
    ],
  },
]

const openMenu = ref<string | null>(null)

function toggleMenu(label: string) {
  openMenu.value = openMenu.value === label ? null : label
}

function switchMenu(label: string) {
  openMenu.value = label
}

function closeAll() {
  openMenu.value = null
}

function onItemClick(action: string) {
  openMenu.value = null
  emit('menu-event', action)
}

function onClickOutside() {
  openMenu.value = null
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  user-select: none;
  flex-shrink: 0;
  z-index: 20;
  gap: 1px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.menu-trigger {
  position: relative;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.menu-trigger:hover,
.menu-trigger.open {
  background: var(--bg-secondary);
}

.menu-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.menu-trigger.open .menu-label {
  color: var(--text);
}

.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  text-align: left;
  transition: background 0.1s;
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.menu-item-label {
  flex: 1;
}

.menu-item-accel {
  margin-left: 24px;
  font-size: 12px;
  color: var(--text-secondary);
}

.menu-separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--border);
}

.menu-dropdown-enter-active,
.menu-dropdown-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.menu-dropdown-enter-from,
.menu-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
