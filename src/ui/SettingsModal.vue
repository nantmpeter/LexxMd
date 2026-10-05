<template>
  <div class="settings-backdrop" @click="$emit('close')">
    <div class="settings-panel" role="dialog" aria-label="Preferences" @click.stop>
      <div class="settings-header">
        <span class="settings-title">Preferences</span>
        <button class="settings-close" aria-label="Close" @click="$emit('close')">&times;</button>
      </div>

      <div class="settings-body">
        <div class="settings-row">
          <span class="settings-label">Theme</span>
          <div class="settings-segmented">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="settings-option"
              :class="{ active: prefs.theme === option.value }"
              @click="change({ ...prefs, theme: option.value })"
            >{{ option.label }}</button>
          </div>
        </div>

        <div class="settings-row">
          <label class="settings-label" for="settings-autosave">Auto Save</label>
          <input
            id="settings-autosave"
            type="checkbox"
            :checked="prefs.autosaveEnabled"
            @change="change({ ...prefs, autosaveEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </div>

        <div v-if="prefs.autosaveEnabled" class="settings-row">
          <label class="settings-label" for="settings-delay">Save Delay</label>
          <div class="settings-slider">
            <input
              id="settings-delay"
              type="range"
              :min="delayRange.min"
              :max="delayRange.max"
              :step="500"
              :value="prefs.autosaveDelayMs"
              @input="change({ ...prefs, autosaveDelayMs: Number(($event.target as HTMLInputElement).value) })"
            />
            <span class="settings-value">{{ (prefs.autosaveDelayMs / 1000).toFixed(1) }}s</span>
          </div>
        </div>

        <div class="settings-row">
          <label class="settings-label" for="settings-width">Editor Width</label>
          <div class="settings-slider">
            <input
              id="settings-width"
              type="range"
              :min="widthRange.min"
              :max="widthRange.max"
              :step="50"
              :value="prefs.editorWidth"
              @input="change({ ...prefs, editorWidth: Number(($event.target as HTMLInputElement).value) })"
            />
            <span class="settings-value">{{ prefs.editorWidth }}px</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import type { Prefs, ThemePreference } from '../composables/usePrefs'
import { AUTOSAVE_DELAY_RANGE, EDITOR_WIDTH_RANGE } from '../composables/usePrefs'

defineProps<{
  prefs: Prefs
}>()

const emit = defineEmits<{
  change: [prefs: Prefs]
  close: []
}>()

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const delayRange = AUTOSAVE_DELAY_RANGE
const widthRange = EDITOR_WIDTH_RANGE

function change(next: Prefs) {
  emit('change', next)
}

// Window-level Escape handling: focus may sit on a range input inside the
// panel (or on the editor behind it), so a keydown on the panel root is not
// enough. Mirrors the QuickOpen modal's escape behavior.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: min(20vh, 160px);
  background: rgba(0, 0, 0, 0.16);
}

.settings-panel {
  width: min(420px, calc(100vw - 32px));
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  font-size: 13px;
  font-weight: 600;
}

.settings-close {
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.settings-close:hover {
  color: var(--text);
}

.settings-body {
  padding: 8px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-label {
  width: 96px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.settings-segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.settings-option {
  padding: 4px 12px;
  border: none;
  background: var(--bg);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.settings-option + .settings-option {
  border-left: 1px solid var(--border);
}

.settings-option.active {
  background: var(--accent);
  color: #fff;
}

.settings-option:hover:not(.active) {
  background: var(--bg-secondary);
  color: var(--text);
}

.settings-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.settings-slider input[type="range"] {
  flex: 1;
  accent-color: var(--accent);
}

.settings-value {
  min-width: 48px;
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* Keep chrome out of printed output if a user prints while the modal is open. */
@media print {
  .settings-backdrop {
    display: none !important;
  }
}
</style>
