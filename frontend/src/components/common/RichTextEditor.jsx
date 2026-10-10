import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BoldIcon, CloseIcon, ImageIcon, ItalicIcon, ListIcon, ListOrderedIcon, MaximizeIcon, MicIcon, QuoteIcon } from '../../utils/Icons.jsx'
import { isLocalPreview, preloadImage, prepareImage } from '../../utils/imageUpload'
import { clearInterim, getCleanHtml, insertDictatedText, parseDictation, showInterimText } from '../../utils/dictation'
import { SHORTCUT_LABEL, useDictationShortcut, useVoiceDictation } from '../../hooks/useVoiceDictation'
import VoiceLevel from '../rightContainer/journal/VoiceLevel'
import { useActiveFormats } from '../../hooks/useActiveFormats'
import TextStyleMenu from './TextStyleMenu'
import { editorClass, toolbarClass, toolbarDivider, toolbarIconButton, toolbarTextButton } from './formStyles'

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

function ToolbarButton({ title, Icon, onClick, active }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} onMouseDown={keepSelection} onClick={onClick} className={toolbarIconButton(active)}>
      <Icon className="h-4 w-4" />
    </button>
  )
}

/**
 * Rich text editor with screenshot support (toolbar, paste-to-upload, hover-to-remove) and voice dictation
 * (mic button or Ctrl/⌘ + Shift + Space; words appear grey while heard, then become real text at the caret).
 * Uncontrolled: content is seeded from `initialHtml` and read back with `ref.current.getContent()`.
 *
 * @param {string}   id
 * @param {string}   label
 * @param {string}   [initialHtml]
 * @param {string}   [placeholder]
 * @param {Function} onUploadImage  (file) => Promise<url>
 * @param {Function} [onBusyChange] (isUploading) => void, lets the parent disable "Save" during uploads
 * @param {Function} [onChange]     (html) => void
 */
function RichTextEditor({ ref, id, label, initialHtml = '', placeholder, onUploadImage, onBusyChange, onChange }) {
  const editorRef = useRef(null)
  const formats = useActiveFormats(editorRef)
  const selectionRef = useRef(null)
  const imageInputRef = useRef(null)
  const removedImagesRef = useRef(new Set())
  const currentImageUrlsRef = useRef(new Set())
  const imageResizeRef = useRef(null)
  const emitChangeRef = useRef(null)
  const pendingUploadsRef = useRef(new Set()) // promises of in-flight screenshot uploads
  const [pendingUploads, setPendingUploads] = useState(0)
  const isUploading = pendingUploads > 0
  const [uploadError, setUploadError] = useState('')
  const [hoverImage, setHoverImage] = useState(null)

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = initialHtml
    currentImageUrlsRef.current = new Set(
      [...editorRef.current.querySelectorAll('img')].map((image) => image.src)
    )
    removedImagesRef.current.clear()
  }, [initialHtml])

  useEffect(() => {
    onBusyChange?.(isUploading)
  }, [isUploading, onBusyChange])

  // hide the remove button whenever the editor content changes (typing, delete key, reset)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return undefined
    const observer = new MutationObserver(() => setHoverImage(null))
    observer.observe(editor, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const emitChange = useCallback(() => {
    const editor = editorRef.current
    const imageUrls = [...(editor?.querySelectorAll('img') ?? [])].map((image) => image.src)
    const nextImageUrls = new Set(imageUrls)
    for (const imageUrl of currentImageUrlsRef.current) {
      if (!nextImageUrls.has(imageUrl) && !isLocalPreview(imageUrl)) removedImagesRef.current.add(imageUrl)
    }
    currentImageUrlsRef.current = nextImageUrls
    onChange?.(getCleanHtml(editor))
  }, [onChange])

  useEffect(() => {
    emitChangeRef.current = emitChange
  }, [emitChange])

  useEffect(() => {
    const updateImageWidth = (event) => {
      const activeResize = imageResizeRef.current
      const editor = editorRef.current
      if (!activeResize || !editor || event.pointerId !== activeResize.pointerId) return

      const maxWidth = Math.max(120, editor.clientWidth - activeResize.image.offsetLeft)
      const width = Math.min(maxWidth, Math.max(120, activeResize.startWidth + event.clientX - activeResize.startX))
      activeResize.image.style.width = `${width}px`
      activeResize.image.style.height = 'auto'
      setHoverImage({
        index: activeResize.index,
        top: activeResize.image.offsetTop,
        left: activeResize.image.offsetLeft,
        width: activeResize.image.offsetWidth,
        height: activeResize.image.offsetHeight
      })
    }

    const finishResize = (event) => {
      const activeResize = imageResizeRef.current
      if (!activeResize || event.pointerId !== activeResize.pointerId) return
      updateImageWidth(event)
      imageResizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      emitChangeRef.current?.()
    }

    window.addEventListener('pointermove', updateImageWidth)
    window.addEventListener('pointerup', finishResize)
    window.addEventListener('pointercancel', finishResize)
    return () => {
      window.removeEventListener('pointermove', updateImageWidth)
      window.removeEventListener('pointerup', finishResize)
      window.removeEventListener('pointercancel', finishResize)
      if (imageResizeRef.current) {
        imageResizeRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [])

  const runCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    emitChange()
  }

  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  /* ---------- voice dictation ---------- */
  const dictationRef = useRef(null)
  const dictationUndoRef = useRef([]) // one undo() per inserted phrase, for "scratch that"

  const handleDictatedText = (text) => {
    const editor = editorRef.current
    clearInterim(editor)
    const tokens = parseDictation(text)

    const inserted = insertDictatedText(editor, selectionRef.current, tokens)
    if (inserted) {
      selectionRef.current = inserted.range
      dictationUndoRef.current.push(inserted.undo)
      if (dictationUndoRef.current.length > 30) dictationUndoRef.current.shift()
      emitChange()
    }

    for (const token of tokens) {
      if (token.command === 'undo') {
        const undo = dictationUndoRef.current.pop()
        if (undo) {
          selectionRef.current = undo()
          emitChange()
        }
      } else if (token.command === 'stop') {
        dictationRef.current?.stop()
      }
    }
  }
  const handleInterimText = (text) => showInterimText(editorRef.current, selectionRef.current, text)

  const dictation = useVoiceDictation({ onFinalText: handleDictatedText, onInterim: handleInterimText })
  dictationRef.current = dictation
  useDictationShortcut(dictation.toggle, { enabled: dictation.isSupported })

  // The screenshot appears in the editor immediately from a local preview; compressing and uploading
  // happen in the background and the preview is swapped for the hosted URL when that finishes.
  const replacePreview = (previewUrl, finalUrl) => {
    const previews = [...(editorRef.current?.querySelectorAll('img') ?? [])].filter((image) => image.src === previewUrl)
    if (!previews.length) {
      // removed while it uploaded: queue the hosted copy for deletion
      removedImagesRef.current.add(finalUrl)
      return
    }
    previews.forEach((image) => { image.src = finalUrl })
    emitChangeRef.current?.()
  }

  const removePreview = (previewUrl) => {
    ;[...(editorRef.current?.querySelectorAll('img') ?? [])]
      .filter((image) => image.src === previewUrl)
      .forEach((image) => image.remove())
    emitChangeRef.current?.()
  }

  const trackUpload = (file, previewUrl) => {
    setPendingUploads((count) => count + 1)
    const task = prepareImage(file)
      .then((smallFile) => onUploadImage(smallFile))
      .then(async (finalUrl) => {
        await preloadImage(finalUrl) // swap only once the browser has it, so there's no flicker
        replacePreview(previewUrl, finalUrl)
      })
      .catch((error) => {
        removePreview(previewUrl)
        setUploadError(error.message || 'Image upload failed. Please try again.')
      })
      .finally(() => {
        URL.revokeObjectURL(previewUrl)
        pendingUploadsRef.current.delete(task)
        setPendingUploads((count) => count - 1)
      })
    pendingUploadsRef.current.add(task)
  }

  const uploadFiles = (files) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    setUploadError('')
    editorRef.current?.focus()
    const selection = window.getSelection()
    const savedRange = selectionRef.current
    if (savedRange && editorRef.current?.contains(savedRange.startContainer)) {
      selection?.removeAllRanges()
      selection?.addRange(savedRange)
    }

    for (const file of imageFiles) {
      const previewUrl = URL.createObjectURL(file)
      document.execCommand('insertImage', false, previewUrl)
      document.execCommand('insertParagraph', false, null)
      trackUpload(file, previewUrl)
    }
    emitChange()
    saveSelection()
  }

  const handleFileInput = (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    uploadFiles(files)
  }

  // screenshots are usually on the clipboard, so let Ctrl/Cmd+V work directly
  const handlePaste = (event) => {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    event.preventDefault()
    saveSelection()
    uploadFiles(files)
  }

  /* ---------- hover a screenshot to reveal its remove button ---------- */
  const showRemoveFor = (image) => {
    const index = [...(editorRef.current?.querySelectorAll('img') ?? [])].indexOf(image)
    if (index === -1) return
    const next = { index, top: image.offsetTop, left: image.offsetLeft, width: image.offsetWidth, height: image.offsetHeight }
    setHoverImage((prev) => (prev && prev.index === next.index && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height ? prev : next))
  }

  const startImageResize = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const image = editorRef.current?.querySelectorAll('img')[hoverImage?.index]
    if (!image) return
    imageResizeRef.current = { image, index: hoverImage.index, pointerId: event.pointerId, startX: event.clientX, startWidth: image.offsetWidth }
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (event) => {
    const { target } = event
    if (target instanceof HTMLImageElement) showRemoveFor(target)
    else if (!(target instanceof Element && target.closest('[data-image-control]'))) setHoverImage(null)
  }

  // tapping an image reveals the button on touch screens, where there is no hover
  const handleClick = (event) => {
    if (event.target instanceof HTMLImageElement) showRemoveFor(event.target)
  }

  const removeImage = (index) => {
    const image = editorRef.current?.querySelectorAll('img')[index]
    if (!image) return
    if (!isLocalPreview(image.src)) removedImagesRef.current.add(image.src)
    image.remove()
    setHoverImage(null)
    emitChange()
  }

  useImperativeHandle(ref, () => ({
    // Uploads any screenshots still embedded as data: URLs (e.g. from drag & drop) and returns the final content.
    async getContent() {
      await dictationRef.current?.stopAndFlush() // don't lose the last spoken phrase

      // screenshots usually finish while the user is still writing; wait for any that haven't
      await Promise.all([...pendingUploadsRef.current])

      const editor = editorRef.current
      for (const image of [...(editor?.querySelectorAll('img') ?? [])]) {
        if (!image.src.startsWith('data:image/')) continue

        const blob = await fetch(image.src).then((response) => response.blob())
        const extension = blob.type.split('/')[1]?.split('+')[0] || 'png'
        const file = new File([blob], `plan-image-${Date.now()}.${extension}`, { type: blob.type })
        image.src = await onUploadImage(await prepareImage(file))
      }

      const html = getCleanHtml(editor)
      const images = [...(editor?.querySelectorAll('img') ?? [])].map((image) => image.src)
      currentImageUrlsRef.current = new Set(images)
      return {
        html,
        images,
        removedImages: [...removedImagesRef.current].filter((url) => !images.includes(url) && !isLocalPreview(url))
      }
    }
  }), [onUploadImage])

  return (
    <section className="group">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
        <span className="hidden text-[11px] text-zinc-600 sm:block dark:text-zinc-400">Tip: paste screenshots straight in with Ctrl/⌘ + V</span>
      </div>

      <div role="toolbar" aria-label="Formatting" className={toolbarClass}>
        <ToolbarButton title="Bold" Icon={BoldIcon} active={formats.bold} onClick={() => runCommand('bold')} />
        <ToolbarButton title="Italic" Icon={ItalicIcon} active={formats.italic} onClick={() => runCommand('italic')} />
        <TextStyleMenu value={formats.block} onChange={(tag) => runCommand('formatBlock', tag)} />
        <span aria-hidden="true" className={toolbarDivider} />
        <ToolbarButton title="Bulleted list" Icon={ListIcon} active={formats.insertUnorderedList} onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton title="Numbered list" Icon={ListOrderedIcon} active={formats.insertOrderedList} onClick={() => runCommand('insertOrderedList')} />
        <ToolbarButton title="Quote" Icon={QuoteIcon} active={formats.block === 'blockquote'} onClick={() => runCommand('formatBlock', 'blockquote')} />
        <span aria-hidden="true" className={toolbarDivider} />
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => imageInputRef.current?.click()}
          className={toolbarTextButton()}
        >
          <ImageIcon className="h-4 w-4" />
          {pendingUploads > 0 ? `Uploading ${pendingUploads}...` : 'Add screenshot'}
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={dictation.toggle}
          disabled={!dictation.isSupported}
          aria-pressed={dictation.isListening}
          title={dictation.isSupported ? `${dictation.isListening ? 'Stop dictation' : 'Dictate'} (${SHORTCUT_LABEL})` : "Voice input isn't supported in this browser. Try Chrome, Edge or Safari."}
          className={toolbarTextButton(dictation.isListening)}
        >
          <MicIcon className="h-4 w-4" />
          {dictation.isListening ? 'Stop' : 'Dictate'}
          <kbd className="hidden rounded border border-current/30 px-1 text-[10px] font-normal opacity-80 md:inline">{SHORTCUT_LABEL}</kbd>
        </button>
      </div>

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

      <div className="relative" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverImage(null)}>
        <div
          ref={editorRef}
          id={id}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          data-placeholder={placeholder}
          onInput={emitChange}
          onClick={handleClick}
          onPaste={handlePaste}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          className={editorClass}
        />

        {hoverImage && (
          <button
            type="button"
            data-image-remove
            data-image-control
            onMouseDown={keepSelection}
            onClick={() => removeImage(hoverImage.index)}
            title="Remove screenshot"
            aria-label="Remove screenshot"
            className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/80 text-white shadow-sm transition-colors hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ top: hoverImage.top + 8, left: hoverImage.left + hoverImage.width - 32 }}
          >
            <CloseIcon className="h-[13px] w-[13px]" />
          </button>
        )}
        {hoverImage && (
          <button
            type="button"
            data-image-control
            onPointerDown={startImageResize}
            title="Drag to resize screenshot"
            aria-label="Resize screenshot"
            className="absolute flex h-6 w-6 touch-none items-center justify-center rounded-full bg-zinc-900/80 text-white shadow-sm cursor-nwse-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            style={{ top: hoverImage.top + hoverImage.height - 12, left: hoverImage.left + hoverImage.width - 12 }}
          >
            <MaximizeIcon className="h-3 w-3" />
          </button>
        )}
      </div>
      {uploadError && <p role="alert" className="mt-2 text-xs text-rose-500">{uploadError}</p>}
    </section>
  )
}

export default RichTextEditor
