/**
 * TaskListInputRule — converts `[ ] ` / `[x] ` into task items inside bullet lists.
 *
 * Strategy: BulletList's input rule captures `- ` immediately, creating a bullet
 * list item. We then watch for `[ ] ` or `[x] ` typed at the start of that item's
 * text content, and convert the bullet list into a task list.
 */
import { Extension, InputRule } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
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

          // Use chain to delete matched text then replace the bullet list
          chain()
            .command(({ tr: t }) => {
              // Delete the `[ ] ` / `[x] ` text
              t.delete(range.from, range.to)

              // Get remaining content of the list item (after our deletion)
              // We need to re-resolve since we deleted text. The deletion
              // happens inside the item's paragraph, so ancestor depths stay
              // valid.
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

              // Convert every sibling list item into an unchecked task item,
              // preserving order and each sibling's own content (including
              // nested lists). Replacing the whole list with a taskList
              // holding only the current item would destroy the siblings.
              const bulletList = newPos.node(bulletListDepth)
              const taskItems: PMNode[] = []
              let currentOffset = -1
              let offsetAcc = 0
              bulletList.forEach(child => {
                if (child === updatedListItem && currentOffset === -1) {
                  currentOffset = offsetAcc
                  taskItems.push(taskItem)
                } else {
                  taskItems.push(
                    taskItemType.create({ checked: false }, child.content)
                  )
                }
                offsetAcc += child.nodeSize
              })

              const taskList = taskListType.create(null, taskItems)

              // Replace the entire bulletList with the complete taskList
              const from = newPos.before(bulletListDepth)
              const to = newPos.after(bulletListDepth)
              t.replaceWith(from, to, taskList)

              // Place cursor inside the current task item's paragraph:
              // taskList(from) > taskItem(from + 1 + currentOffset) > paragraph(+1)
              const paraPos = from + 1 + currentOffset + 1
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
