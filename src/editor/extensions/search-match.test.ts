import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  SearchMatchExtension,
  getSearchState,
  replaceActiveSearchMatch,
  replaceAllSearchMatches,
  updateSearch,
} from './search-match'

function createSearchEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit,
      SearchMatchExtension,
    ],
    content,
  })
}

describe('SearchMatchExtension', () => {
  let editor: Editor | null = null

  afterEach(() => {
    editor?.destroy()
    editor = null
  })

  it('finds case-insensitive matches in text nodes', () => {
    editor = createSearchEditor('<p>Hello hello HELLO</p>')

    const state = updateSearch(editor, { query: 'hello' })

    expect(state.matches).toHaveLength(3)
    expect(state.activeIndex).toBe(0)
  })

  it('wraps active index when moving past the last match', () => {
    editor = createSearchEditor('<p>one two one</p>')

    updateSearch(editor, { query: 'one' })
    const state = updateSearch(editor, { query: 'one', activeIndex: 2 })

    expect(state.matches).toHaveLength(2)
    expect(state.activeIndex).toBe(0)
  })

  it('wraps active index when moving before the first match', () => {
    editor = createSearchEditor('<p>one two one</p>')

    updateSearch(editor, { query: 'one' })
    const state = updateSearch(editor, { query: 'one', activeIndex: -1 })

    expect(state.activeIndex).toBe(1)
  })

  it('recomputes matches after document changes', () => {
    editor = createSearchEditor('<p>alpha beta</p>')

    updateSearch(editor, { query: 'alpha' })
    expect(getSearchState(editor).matches).toHaveLength(1)

    editor.commands.setContent('<p>beta gamma</p>')

    expect(getSearchState(editor).matches).toHaveLength(0)
    expect(getSearchState(editor).activeIndex).toBe(-1)
  })

  it('clears matches when query is empty', () => {
    editor = createSearchEditor('<p>alpha alpha</p>')

    updateSearch(editor, { query: 'alpha' })
    const state = updateSearch(editor, { query: '' })

    expect(state.query).toBe('')
    expect(state.matches).toHaveLength(0)
    expect(state.activeIndex).toBe(-1)
  })

  it('replaces the active match', () => {
    editor = createSearchEditor('<p>one two one</p>')

    updateSearch(editor, { query: 'one', activeIndex: 1 })
    const state = replaceActiveSearchMatch(editor, 'three')

    expect(editor.getText()).toBe('one two three')
    expect(state.query).toBe('one')
    expect(state.matches).toHaveLength(1)
    expect(state.activeIndex).toBe(0)
  })

  it('replaces all matches from the end of the document', () => {
    editor = createSearchEditor('<p>aa aaa aa</p>')

    updateSearch(editor, { query: 'aa' })
    const state = replaceAllSearchMatches(editor, 'b')

    expect(editor.getText()).toBe('b ba b')
    expect(state.matches).toHaveLength(0)
    expect(state.activeIndex).toBe(-1)
  })
})
