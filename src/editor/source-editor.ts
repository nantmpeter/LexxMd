import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

function createExtensions(onChange: () => void, shouldIgnoreUpdate: () => boolean) {
  return [
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
      if (!shouldIgnoreUpdate() && update.docChanged) onChange()
    }),
  ]
}

export function createSourceEditor(
  parent: HTMLElement,
  onChange: () => void,
) {
  // Guards against the updateListener firing for the state rebuilt by
  // setContent. Defensive only: setState() does not dispatch a transaction
  // in practice, so this flag normally stays unused — kept as a harmless
  // redundancy in case that behavior changes.
  let isSettingContent = false

  const view = new EditorView({
    state: EditorState.create({
      extensions: createExtensions(
        onChange,
        () => isSettingContent,
      ),
    }),
    parent,
  })

  return {
    view,
    getContent: () => view.state.doc.toString(),
    setContent: (md: string) => {
      // Rebuild the whole state instead of dispatching a transaction: a
      // normal dispatch would push the loaded file into the undo history,
      // letting Cmd+Z wipe the document right after entering source mode,
      // and even resurface a previously loaded file's content after
      // switching tabs. Rebuilding also gives each source-mode session a
      // fresh undo stack (semantics: every setContent starts a new session).
      isSettingContent = true
      try {
        view.setState(
          EditorState.create({
            doc: md,
            extensions: createExtensions(
              onChange,
              () => isSettingContent,
            ),
          }),
        )
      } finally {
        isSettingContent = false
      }
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
