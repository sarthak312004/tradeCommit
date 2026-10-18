import { editorClass } from '../formStyles'

// The writing surface of the Tiptap editor. It reuses the form editor look from formStyles.js (type size, headings,
// lists, quotes, screenshots) so the trade form, the planner and the journal context stay visually identical.
// The placeholder classes are dropped because Tiptap draws its own placeholder (see tiptap.css), and the starting
// height is dropped so TiptapEditor's `minHeightClass` prop is the only one in charge.
export const tiptapContentClass = [
  'tc-editor',
  ...editorClass.split(' ').filter((name) => name && !name.startsWith('empty:') && !name.startsWith('dark:empty:') && !name.startsWith('min-h-'))
].join(' ')
