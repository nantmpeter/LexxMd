/**
 * TaskListInputRule — converts `[ ] ` / `[x] ` into task items inside bullet lists.
 *
 * Strategy: BulletList's input rule captures `- ` immediately, creating a bullet
 * list item. We then watch for `[ ] ` or `[x] ` typed at the start of that item's
 * text content, and convert the bullet list into a task list.
 */
import { Extension, InputRule } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'

export const TaskListInputRule = Extension.create({
  name: 'taskListInputRule',

  addInputRules() {
    return [
      // Match: `[ ] ` or `[x] ` at start of a bullet list item's text
      new InputRule({
        find: /^\[(\s|x|X)\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const checked = /^(x|X)$/.test(match[1])
          const $pos = state.doc.resolve(range.from)

          // Walk up from the paragraph to find listItem → bulletList
          // Structure: doc > bulletList > listItem > paragraph
          let listItemDepth = -1
          let bulletListDepth = -1

          for (let d = $pos.depth; d > 0; d--) {
            if ($pos.node(d).type.name === 'listItem' && listItemDepth === -1) {
              listItemDepth = d
            } else if ($pos.node(d).type.name === 'bulletList' && bulletListDepth === -1) {
              bulletListDepth = d
            }
          }

          if (listItemDepth === -1 || bulletListDepth === -1) return

          const taskListType = state.schema.nodes.taskList
          const taskItemType = state.schema.nodes.taskItem
          const paragraphType = state.schema.nodes.paragraph

          if (!taskListType || !taskItemType || !paragraphType) return

          const listItemNode = $pos.node(listItemDepth)

          // Use chain to delete matched text then replace the bullet list
          chain()
            .command(({ tr: t }) => {
              // Delete the `[ ] ` / `[x] ` text
              t.delete(range.from, range.to)

              // Get remaining content of the list item (after our deletion)
              // We need to re-resolve since we deleted text
              const newPos = t.doc.resolve(range.from)
              const updatedListItem = newPos.node(listItemDepth)
              const remainingContent = updatedListItem.content

              // Build: taskList > taskItem > content
              const taskItem = taskItemType.create(
                { checked },
                remainingContent.size > 0
                  ? remainingContent
                  : paragraphType.create()
              )
              const taskList = taskListType.create(null, taskItem)

              // Replace the entire bulletList
              const from = newPos.before(bulletListDepth)
              const to = newPos.after(bulletListDepth)
              t.replaceWith(from, to, taskList)

              // Place cursor inside the task item's paragraph
              // taskList(from) > taskItem(from+1) > paragraph(from+2)
              const paraPos = from + 1 + 1 + 1
              t.setSelection(
                Selection.near(t.doc.resolve(paraPos))
              )

              return true
            })
            .run()
        },
      }),
    ]
  },
})
