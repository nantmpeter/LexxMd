import { ref, computed, watch, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { getSearchState, replaceActiveSearchMatch, replaceAllSearchMatches, updateSearch } from '../editor/extensions/search-match'
import type { FileSlot } from '../types'
import type FindBar from '../ui/FindBar.vue'

interface UseFindReplaceOptions {
  activeEditor: ComputedRef<FileSlot['editor']>
  activeFileId: Ref<string>
  openFiles: Ref<FileSlot[]>
  editorContainerEl: Ref<HTMLElement | null>
  /** Whether source (CodeMirror) mode is active; find is PM-only. */
  sourceMode: Ref<boolean>
  scheduleAutoSaveForActiveFile: () => void
}

export function useFindReplace(options: UseFindReplaceOptions) {
  const {
    activeEditor,
    activeFileId,
    openFiles,
    editorContainerEl,
    sourceMode,
    scheduleAutoSaveForActiveFile,
  } = options

  const searchOpen = ref(false)
  const searchQuery = ref('')
  const replaceQuery = ref('')
  const searchActiveIndex = ref(-1)
  const searchTotal = ref(0)
  const searchInputEl = ref<InstanceType<typeof FindBar> | null>(null)

  const searchCountLabel = computed(() => {
    if (!searchQuery.value) return ''
    if (searchTotal.value === 0) return 'No results'
    return `${searchActiveIndex.value + 1} of ${searchTotal.value}`
  })

  function syncSearchState() {
    const state = getSearchState(activeEditor.value)
    searchActiveIndex.value = state.activeIndex
    searchTotal.value = state.matches.length
  }

  function clearSearchForAllEditors() {
    for (const slot of openFiles.value) {
      updateSearch(slot.editor, { query: '' })
    }
  }

  function getSelectedSearchText() {
    const editor = activeEditor.value
    if (!editor) return ''

    const { from, to, empty } = editor.view.state.selection
    if (empty) return ''

    return editor.view.state.doc.textBetween(from, to, ' ')
  }

  function scrollToActiveSearchMatch() {
    const editor = activeEditor.value
    const container = editorContainerEl.value
    const state = getSearchState(editor)
    const match = state.matches[state.activeIndex]
    if (!editor || !container || !match) return

    requestAnimationFrame(() => {
      try {
        const coords = editor.view.coordsAtPos(match.from)
        const rect = container.getBoundingClientRect()
        const top = container.scrollTop + (coords.top - rect.top) - rect.height / 3
        container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      } catch {
        // The document may have changed before the browser paints.
      }
    })
  }

  function applySearchQuery() {
    updateSearch(activeEditor.value, { query: searchQuery.value })
    syncSearchState()
    scrollToActiveSearchMatch()
  }

  function focusSearchInput() {
    // The find bar is v-if'd, so wait one tick for it to mount before focusing.
    nextTick(() => searchInputEl.value?.focus())
  }

  function openSearch(initialQuery = '') {
    if (sourceMode.value) return

    const selectedText = initialQuery || getSelectedSearchText()
    if (selectedText || !searchOpen.value) {
      searchQuery.value = selectedText
    }
    if (!searchOpen.value) replaceQuery.value = ''

    searchOpen.value = true
    updateSearch(activeEditor.value, { query: searchQuery.value })
    syncSearchState()
    focusSearchInput()
  }

  function closeSearch() {
    clearSearchForAllEditors()
    searchOpen.value = false
    searchQuery.value = ''
    syncSearchState()
    nextTick(() => activeEditor.value?.commands.focus())
  }

  function goToSearchMatch(delta: number) {
    const state = getSearchState(activeEditor.value)
    if (state.matches.length === 0) return

    const nextIndex = state.activeIndex + delta
    updateSearch(activeEditor.value, {
      query: searchQuery.value,
      activeIndex: nextIndex,
    })
    syncSearchState()
    scrollToActiveSearchMatch()
  }

  function goToNextSearchMatch() {
    goToSearchMatch(1)
  }

  function goToPreviousSearchMatch() {
    goToSearchMatch(-1)
  }

  function replaceCurrentMatch() {
    if (searchTotal.value === 0) {
      focusSearchInput()
      return
    }

    replaceActiveSearchMatch(activeEditor.value, replaceQuery.value)
    updateSearch(activeEditor.value, { query: searchQuery.value })
    syncSearchState()
    scrollToActiveSearchMatch()
    scheduleAutoSaveForActiveFile()
    focusSearchInput()
  }

  function replaceAllMatches() {
    if (searchTotal.value === 0) {
      focusSearchInput()
      return
    }

    replaceAllSearchMatches(activeEditor.value, replaceQuery.value)
    updateSearch(activeEditor.value, { query: searchQuery.value })
    syncSearchState()
    scheduleAutoSaveForActiveFile()
    focusSearchInput()
  }

  function onSearchEnter(event: KeyboardEvent) {
    if (event.shiftKey) goToPreviousSearchMatch()
    else goToNextSearchMatch()
  }

  // Re-run the query when the visible editor changes (tab switch).
  watch(activeEditor, () => {
    if (!searchOpen.value) return
    updateSearch(activeEditor.value, { query: searchQuery.value })
    syncSearchState()
    scrollToActiveSearchMatch()
  })

  watch(searchQuery, () => {
    if (!searchOpen.value) return
    applySearchQuery()
  })

  return {
    searchOpen,
    searchQuery,
    replaceQuery,
    searchActiveIndex,
    searchTotal,
    searchInputEl,
    searchCountLabel,
    syncSearchState,
    openSearch,
    closeSearch,
    goToNextSearchMatch,
    goToPreviousSearchMatch,
    replaceCurrentMatch,
    replaceAllMatches,
    onSearchEnter,
  }
}
