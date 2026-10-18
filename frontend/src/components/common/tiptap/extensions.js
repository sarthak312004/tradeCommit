import StarterKit from '@tiptap/starter-kit'
import HardBreak from '@tiptap/extension-hard-break'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { DictationInterim } from '../../../utils/tiptapDictation'
import ImageView from './ImageView'

// Tiptap's stock hard break also binds Ctrl/Cmd + Enter, but in these forms that shortcut saves the form.
// Shift + Enter still inserts a line break.
const SoftBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return { 'Shift-Enter': () => this.editor.commands.setHardBreak() }
  }
})

// Screenshots: hosted URL (or a local blob: preview while uploading), optional width in px (drag a corner or pick a size)
// and optional alignment.
// The width is stored as an inline style, the same way the previous editor saved it, so older entries load unchanged.
const Screenshot = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = parseInt(element.style.width || element.getAttribute('width') || '', 10)
          return Number.isFinite(width) && width > 0 ? width : null
        },
        renderHTML: (attributes) => (attributes.width ? { style: `width: ${attributes.width}px; height: auto;` } : {})
      },
      // left (default), center or right. Saved as data-align plus the matching margins, so it also holds outside the editor.
      align: {
        default: null,
        parseHTML: (element) => {
          const align = element.getAttribute('data-align')
          return align === 'center' || align === 'right' ? align : null
        },
        renderHTML: (attributes) => {
          if (attributes.align === 'center') return { 'data-align': 'center', style: 'display: block; margin-left: auto; margin-right: auto;' }
          if (attributes.align === 'right') return { 'data-align': 'right', style: 'display: block; margin-left: auto; margin-right: 0;' }
          return {}
        }
      }
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  }
})

/** Everything the journal and planner editors can write: the formats the old editor had, plus underline, strike, code, links, checklists and dividers. */
export const buildExtensions = ({ placeholder }) => [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] }, // same three sizes as the "Text style" menu
    codeBlock: false,
    hardBreak: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
    },
    dropcursor: { color: '#71717a', width: 2 }
  }),
  SoftBreak,
  Screenshot.configure({ allowBase64: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder: placeholder ?? '' }),
  DictationInterim
]
