<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <ToolbarButton @click="setHeading(1)" :active="isActive('heading', { level: 1 })" title="Heading 1">
        H1
      </ToolbarButton>
      <ToolbarButton @click="setHeading(2)" :active="isActive('heading', { level: 2 })" title="Heading 2">
        H2
      </ToolbarButton>
      <ToolbarButton @click="setHeading(3)" :active="isActive('heading', { level: 3 })" title="Heading 3">
        H3
      </ToolbarButton>
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolbarButton @click="editor?.chain().focus().toggleBold().run()" :active="editor?.isActive('bold')" title="Bold">
        B
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleItalic().run()" :active="editor?.isActive('italic')" title="Italic">
        I
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleStrike().run()" :active="editor?.isActive('strike')" title="Strikethrough">
        S
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleCode().run()" :active="editor?.isActive('code')" title="Inline code">
        &lt;&gt;
      </ToolbarButton>
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolbarButton @click="editor?.chain().focus().toggleBulletList().run()" :active="editor?.isActive('bulletList')" title="Bullet list">
        UL
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleOrderedList().run()" :active="editor?.isActive('orderedList')" title="Ordered list">
        OL
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleTaskList().run()" :active="editor?.isActive('taskList')" title="Task list">
        &#x2610;
      </ToolbarButton>
      <ToolbarButton @click="editor?.chain().focus().toggleBlockquote().run()" :active="editor?.isActive('blockquote')" title="Blockquote">
        "
      </ToolbarButton>
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolbarButton @click="editor?.chain().focus().toggleCodeBlock().run()" :active="editor?.isActive('codeBlock')" title="Code block">
        ` ` `
      </ToolbarButton>
      <ToolbarButton @click="insertTable" title="Insert table">
        Table
      </ToolbarButton>
    </div>

    <div class="toolbar-separator" />

    <div class="toolbar-group">
      <ToolbarButton @click="setLink" :active="editor?.isActive('link')" title="Link">
        Link
      </ToolbarButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import ToolbarButton from './ToolbarButton.vue'

const props = defineProps<{ editor: Editor | null }>()

function isActive(type: string, attrs?: Record<string, unknown>) {
  return props.editor?.isActive(type, attrs) ?? false
}

function setHeading(level: number) {
  props.editor?.chain().focus().toggleHeading({ level }).run()
}

function insertTable() {
  props.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function setLink() {
  const url = window.prompt('URL')
  if (!url) return
  if (props.editor?.isActive('link')) {
    props.editor.chain().focus().unsetLink().run()
  } else {
    props.editor.chain().focus().setLink({ href: url }).run()
  }
}
</script>
