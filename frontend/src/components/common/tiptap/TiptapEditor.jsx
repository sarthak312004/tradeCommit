import './tiptap.css'
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { parseDictation } from '../../../utils/dictation'
import { insertDictation, mapDictatedRanges, removeDictated, showInterimText, clearInterim } from '../../../utils/tiptapDictation'
import { useDictationShortcut, useVoiceDictation } from '../../../hooks/useVoiceDictation'
import VoiceLevel from '../../rightContainer/journal/VoiceLevel'
import EditorToolbar from './EditorToolbar'
import { buildExtensions } from './extensions'
import { tiptapContentClass } from './editorStyles'
import { useImageUploads } from './useImageUploads'

// '' for an empty editor (not "<p></p>"), otherwise the HTML that gets saved
const htmlOf = (editor) => (!editor || editor.isDestroyed || editor.isEmpty ? '' : editor.getHTML())

const moveSelectionOutOfImage = (editor) => {
  if (!editor.state.selection.node) return
  let textPosition = null
  editor.state.doc.descendants((node, position) => {
    if (textPosition === null && node.isTextblock) textPosition = position + 1
  })
  let transaction = editor.state.tr
  if (textPosition === null && editor.state.doc.childCount > 0) {
    transaction = transaction.insert(
      editor.state.doc.content.size,
      editor.schema.nodes.paragraph.create()
    )
    textPosition = editor.state.doc.content.size + 1
  }
  const position = textPosition ?? 0
  const selection = TextSelection.near(transaction.doc.resolve(position), 1)
  editor.view.dispatch(transaction.setSelection(selection).setMeta('addToHistory', false))
}

/**
 * Rich text editor (Tiptap) for the trade analysis and the planner: formatting toolbar, screenshots (paste, drop or
 * button; uploaded in the background, hover to resize or remove) and voice dictation (mic button or Ctrl/⌘ + Shift + Space).
 * Markdown shortcuts work as you type: "- ", "1. ", "[ ] ", "> ", "## ", "---", **bold**, `code`.
 *
 * Uncontrolled: content is seeded from `initialHtml` (and replaced when that prop changes). Read it back with the ref:
 *   await ref.current.getContent()  -> { html, images, removedImages }   waits for running uploads
 *   await ref.current.getDraft()    -> { html, images, removedImages, prepare }   returns at once; `prepare()` finishes
 *                                      the uploads later, for forms that close first and save in the background
 *   ref.current.markSubmitted()     call once a draft was handed over, so local previews are not revoked too early
 *
 * @param {string}   id
 * @param {string}   label
 * @param {string}   [initialHtml]
 * @param {string}   [placeholder]
 * @param {string}   [hint]           small tip shown next to the label
 * @param {string}   [minHeightClass] starting height of the writing area
 * @param {Function} onUploadImage    (file) => Promise<url>
 * @param {Function} [onChange]       (html) => void
 */
function TiptapEditor({
  ref,
  id,
  label,
  initialHtml = '',
  placeholder,
  hint = 'Tip: paste screenshots straight in with Ctrl/⌘ + V',
  minHeightClass = 'min-h-[420px]',
  onUploadImage,
  onChange
}) {
  const editorRef = useRef(null)
  const imageInputRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const seededRef = useRef(initialHtml)
  const dictationRef = useRef(null)
  const dictatedRef = useRef([]) // { from, to } of each dictated phrase, for "scratch that"
  const getEditor = useCallback(() => editorRef.current, [])
  const uploads = useImageUploads({ getEditor, onUploadImage })
  const { addImageFiles, syncImages, resetImages, createDraft, markSubmitted } = uploads
  const addImageFilesRef = useRef(addImageFiles)

  useEffect(() => {
    onChangeRef.current = onChange
    addImageFilesRef.current = addImageFiles
  })

  const editor = useEditor({
    extensions: buildExtensions({ placeholder }),
    content: initialHtml || '',
    editorProps: {
      attributes: {
        id,
        class: `${tiptapContentClass} ${minHeightClass}`,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': `${id}-label`
      },
      // screenshots are usually on the clipboard, so let Ctrl/Cmd+V work directly
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        addImageFilesRef.current(files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false // dragging something around inside the text
        const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        addImageFilesRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos)
        return true
      }
    },
    onUpdate: ({ editor: current }) => {
      syncImages()
      onChangeRef.current?.(htmlOf(current))
    },
    onCreate: ({ editor: current }) => {
      moveSelectionOutOfImage(current)
    }
  })

  useEffect(() => {
    editorRef.current = editor
    if (editor) resetImages()
  }, [editor, resetImages])

  // a different entry was opened in the same form: swap the text, without counting it as an edit
  useEffect(() => {
    if (!editor || seededRef.current === initialHtml) return
    seededRef.current = initialHtml
    editor.commands.setContent(initialHtml || '', { emitUpdate: false })
    moveSelectionOutOfImage(editor)
    dictatedRef.current = []
    resetImages()
  }, [editor, initialHtml, resetImages])

  // keep "scratch that" pointing at the right text while the user keeps typing
  useEffect(() => {
    if (!editor) return undefined
    const follow = ({ transaction }) => {
      if (transaction.docChanged && dictatedRef.current.length) dictatedRef.current = mapDictatedRanges(dictatedRef.current, transaction.mapping)
    }
    editor.on('transaction', follow)
    return () => editor.off('transaction', follow)
  }, [editor])

  /* ---------- voice dictation ---------- */
  const handleDictatedText = (text) => {
    const current = editorRef.current
    if (!current || current.isDestroyed) return
    clearInterim(current)
    const tokens = parseDictation(text)

    const inserted = insertDictation(current, tokens)
    if (inserted) {
      dictatedRef.current.push(inserted)
      if (dictatedRef.current.length > 30) dictatedRef.current.shift()
    }

    for (const token of tokens) {
      if (token.command === 'undo') {
        const last = dictatedRef.current.pop()
        if (last) removeDictated(current, last)
      } else if (token.command === 'stop') {
        dictationRef.current?.stop()
      }
    }
  }
  const handleInterimText = (text) => showInterimText(editorRef.current, text)

  const dictation = useVoiceDictation({ onFinalText: handleDictatedText, onInterim: handleInterimText })
  useEffect(() => {
    dictationRef.current = dictation
  })
  useDictationShortcut(dictation.toggle, { enabled: dictation.isSupported })

  const handleFileInput = (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    addImageFiles(files)
  }

  const getDraft = useCallback(async () => {
    await dictationRef.current?.stopAndFlush() // don't lose the last spoken phrase (returns at once when the mic is off)
    return createDraft(htmlOf(editorRef.current))
  }, [createDraft])

  useImperativeHandle(ref, () => ({
    getDraft,
    markSubmitted,
    // screenshots usually finish while the user is still writing; this waits for any that haven't, then returns the final content
    async getContent() {
      const draft = await getDraft()
      return draft.prepare()
    },
    focus: () => editorRef.current?.commands.focus('end')
  }), [getDraft, markSubmitted])

  return (
    <section className="group">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
        {hint && <span className="hidden text-[11px] text-zinc-600 sm:block dark:text-zinc-400">{hint}</span>}
      </div>

      <EditorToolbar editor={editor} label={label} onAddScreenshot={() => imageInputRef.current?.click()} dictation={dictation} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />

      {(dictation.isListening || dictation.error || dictation.notice) && (
        <div aria-live="polite" className="flex min-h-8 items-center gap-2 border-b border-zinc-200 px-1 py-1.5 text-xs dark:border-white/[0.08]">
          {dictation.error ? (
            <span role="alert" className="font-medium text-rose-700 dark:text-rose-300">{dictation.error}</span>
          ) : dictation.isListening ? (
            <>
              <VoiceLevel levelRef={dictation.levelRef} active />
              <span className="truncate text-zinc-600 dark:text-zinc-400">
                Listening… say &quot;full stop&quot;, &quot;new line&quot;, &quot;bullet point&quot;, &quot;scratch that&quot; or &quot;stop listening&quot;
              </span>
            </>
          ) : (
            <span className="text-zinc-600 dark:text-zinc-400">{dictation.notice}</span>
          )}
        </div>
      )}

      <EditorContent editor={editor} />
      {uploads.error && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{uploads.error}</p>}
    </section>
  )
}

export default TiptapEditor
