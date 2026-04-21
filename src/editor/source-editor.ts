import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

export function createSourceEditor(
  parent: HTMLElement,
  onChange: () => void,
) {
  const view = new EditorView({
    state: EditorState.create({
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange()
        }),
      ],
    }),
    parent,
  })

  return {
    view,
    getContent: () => view.state.doc.toString(),
    setContent: (md: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: md },
      })
    },
    getCursorLine: () => {
      const pos = view.state.selection.main.head
      return view.state.doc.lineAt(pos).number
    },
    setCursorLine: (line: number) => {
      const clamped = Math.max(1, Math.min(line, view.state.doc.lines))
      const pos = view.state.doc.line(clamped).from
      view.dispatch({ selection: { anchor: pos } })
      view.focus()
    },
    destroy: () => view.destroy(),
  }
}
