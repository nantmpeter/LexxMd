import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface SearchMatch {
  from: number
  to: number
}

export interface SearchState {
  query: string
  matches: SearchMatch[]
  activeIndex: number
}

interface SearchMeta {
  query?: string
  activeIndex?: number
}

export const searchMatchPluginKey = new PluginKey<SearchState>('searchMatch')

const emptySearchState: SearchState = {
  query: '',
  matches: [],
  activeIndex: -1,
}

function clampActiveIndex(index: number, matchCount: number): number {
  if (matchCount === 0) return -1
  if (index < 0) return matchCount - 1
  if (index >= matchCount) return 0
  return index
}

function findMatches(doc: ProseMirrorNode, query: string): SearchMatch[] {
  const needle = query.toLocaleLowerCase()
  if (!needle) return []

  const matches: SearchMatch[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const haystack = node.text.toLocaleLowerCase()
    let offset = haystack.indexOf(needle)

    while (offset !== -1) {
      matches.push({
        from: pos + offset,
        to: pos + offset + query.length,
      })
      offset = haystack.indexOf(needle, offset + Math.max(query.length, 1))
    }
  })

  return matches
}

function createDecorations(doc: ProseMirrorNode, state: SearchState): DecorationSet {
  if (!state.query || state.matches.length === 0) {
    return DecorationSet.empty
  }

  const decorations = state.matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === state.activeIndex ? 'search-match search-match-active' : 'search-match',
    })
  )

  return DecorationSet.create(doc, decorations)
}

function applySearchMeta(
  doc: ProseMirrorNode,
  previous: SearchState,
  meta: SearchMeta | undefined,
  docChanged: boolean,
): SearchState {
  const query = meta?.query ?? previous.query
  const queryChanged = meta?.query !== undefined && meta.query !== previous.query

  if (!query) return emptySearchState

  const matches = queryChanged || docChanged
    ? findMatches(doc, query)
    : previous.matches

  const requestedIndex = meta?.activeIndex ?? (queryChanged ? 0 : previous.activeIndex)
  const activeIndex = clampActiveIndex(requestedIndex, matches.length)

  return { query, matches, activeIndex }
}

export function getSearchState(editor: Editor | null): SearchState {
  if (!editor) return emptySearchState
  // Use editor.view.state (not editor.state): the latter may be a stale
  // reference in Tiptap, leading to mismatched transactions when dispatched.
  return searchMatchPluginKey.getState(editor.view.state) ?? emptySearchState
}

export function updateSearch(editor: Editor | null, meta: SearchMeta): SearchState {
  if (!editor) return emptySearchState

  const { view } = editor
  view.dispatch(view.state.tr.setMeta(searchMatchPluginKey, meta))
  return getSearchState(editor)
}

export function replaceActiveSearchMatch(editor: Editor | null, replacement: string): SearchState {
  if (!editor) return emptySearchState

  const state = getSearchState(editor)
  const match = state.matches[state.activeIndex]
  if (!match) return state

  const { view } = editor
  const tr = view.state.tr.insertText(replacement, match.from, match.to)
  view.dispatch(tr)
  return getSearchState(editor)
}

export function replaceAllSearchMatches(editor: Editor | null, replacement: string): SearchState {
  if (!editor) return emptySearchState

  const state = getSearchState(editor)
  if (state.matches.length === 0) return state

  const { view } = editor
  let tr = view.state.tr
  for (const match of [...state.matches].reverse()) {
    tr = tr.insertText(replacement, match.from, match.to)
  }

  view.dispatch(tr)
  return getSearchState(editor)
}

export const SearchMatchExtension = Extension.create({
  name: 'searchMatch',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchMatchPluginKey,
        state: {
          init: () => emptySearchState,
          apply(tr, previous) {
            const meta = tr.getMeta(searchMatchPluginKey) as SearchMeta | undefined
            if (!meta && !tr.docChanged) return previous
            return applySearchMeta(tr.doc, previous, meta, tr.docChanged)
          },
        },
        props: {
          decorations(state) {
            return createDecorations(state.doc, searchMatchPluginKey.getState(state) ?? emptySearchState)
          },
        },
      }),
    ]
  },
})
