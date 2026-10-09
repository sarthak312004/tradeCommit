import { useEffect, useState } from 'react'

const COMMANDS = ['bold', 'italic', 'insertUnorderedList', 'insertOrderedList']

/**
 * Which inline/list formats apply at the caret, so toolbar buttons can show a real pressed state.
 * Only listens while the selection is inside `editorRef`.
 * @returns {{ bold: boolean, italic: boolean, insertUnorderedList: boolean, insertOrderedList: boolean, block: string }}
 */
export function useActiveFormats(editorRef) {
  const [formats, setFormats] = useState({ bold: false, italic: false, insertUnorderedList: false, insertOrderedList: false, block: 'p' })

  useEffect(() => {
    const read = () => {
      const editor = editorRef.current
      const selection = document.getSelection()
      if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return
      const next = { block: String(document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, '') }
      for (const command of COMMANDS) next[command] = document.queryCommandState(command)
      setFormats((current) => (COMMANDS.every((c) => current[c] === next[c]) && current.block === next.block ? current : next))
    }
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [editorRef])

  return formats
}
