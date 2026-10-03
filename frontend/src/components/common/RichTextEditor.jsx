import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { BoldIcon, CloseIcon, ImageIcon, ItalicIcon, ListIcon, ListOrderedIcon, MaximizeIcon, QuoteIcon } from '../../utils/Icons.jsx'

const editorClass = [
  'min-h-[420px] py-4 text-[15px] leading-7 text-zinc-800 outline-none dark:text-zinc-200',
  'empty:before:pointer-events-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-zinc-600',
  '[&_h2]:mb-1 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-9',
  '[&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-8',
  '[&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 dark:[&_blockquote]:border-zinc-600',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-zinc-200 dark:[&_img]:border-white/10'
].join(' ')

const toolbarButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

function ToolbarButton({ title, Icon, onClick }) {
  return (
    <button type="button" title={title} aria-label={title} onMouseDown={keepSelection} onClick={onClick} className={toolbarButtonClass}>
      <Icon className="h-[15px] w-[15px]" />
    </button>
  )
}

/**
 * Rich text editor with screenshot support (toolbar, paste-to-upload, hover-to-remove).
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
  const selectionRef = useRef(null)
  const imageInputRef = useRef(null)
  const removedImagesRef = useRef(new Set())
  const currentImageUrlsRef = useRef(new Set())
  const imageResizeRef = useRef(null)
  const emitChangeRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
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
      if (!nextImageUrls.has(imageUrl)) removedImagesRef.current.add(imageUrl)
    }
    currentImageUrlsRef.current = nextImageUrls
    onChange?.(editor?.innerHTML ?? '')
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

  const insertImageFile = async (file) => {
    const imageUrl = await onUploadImage(file)
    editorRef.current?.focus()
    const selection = window.getSelection()
    const savedRange = selectionRef.current
    if (savedRange && editorRef.current?.contains(savedRange.startContainer)) {
      selection?.removeAllRanges()
      selection?.addRange(savedRange)
    }
    document.execCommand('insertImage', false, imageUrl)
    document.execCommand('insertParagraph', false, null)
    emitChange()
    saveSelection()
  }

  const uploadFiles = async (files) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    setUploadError('')
    setIsUploading(true)
    try {
      for (const file of imageFiles) await insertImageFile(file)
    } catch (error) {
      setUploadError(error.message || 'Image upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInput = async (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    await uploadFiles(files)
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
    removedImagesRef.current.add(image.src)
    image.remove()
    setHoverImage(null)
    emitChange()
  }

  useImperativeHandle(ref, () => ({
    // Uploads any screenshots still embedded as data: URLs (e.g. from drag & drop) and returns the final content.
    async getContent() {
      const editor = editorRef.current
      for (const image of [...(editor?.querySelectorAll('img') ?? [])]) {
        if (!image.src.startsWith('data:image/')) continue

        const blob = await fetch(image.src).then((response) => response.blob())
        const extension = blob.type.split('/')[1]?.split('+')[0] || 'png'
        const file = new File([blob], `plan-image-${Date.now()}.${extension}`, { type: blob.type })
        image.src = await onUploadImage(file)
      }

      const html = editor?.innerHTML ?? ''
      const images = [...(editor?.querySelectorAll('img') ?? [])].map((image) => image.src)
      currentImageUrlsRef.current = new Set(images)
      return {
        html,
        images,
        removedImages: [...removedImagesRef.current].filter((url) => !images.includes(url))
      }
    }
  }), [onUploadImage])

  return (
    <section className="group">
      <div className="mb-2 flex items-baseline justify-between">
        <span id={`${id}-label`} className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="hidden text-[11px] text-zinc-400 sm:block dark:text-zinc-600">Tip: paste screenshots straight in with Ctrl/⌘ + V</span>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-zinc-200/80 bg-white py-1.5 opacity-70 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100 hover:opacity-100 dark:border-white/[0.08] dark:bg-[#202020]">
        <ToolbarButton title="Bold" Icon={BoldIcon} onClick={() => runCommand('bold')} />
        <ToolbarButton title="Italic" Icon={ItalicIcon} onClick={() => runCommand('italic')} />
        <select
          title="Text style"
          aria-label="Text style"
          defaultValue="p"
          onChange={(event) => runCommand('formatBlock', event.target.value)}
          className="mx-0.5 h-7 cursor-pointer rounded-md bg-transparent px-1.5 text-xs text-zinc-500 outline-none transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:[color-scheme:dark] dark:hover:bg-white/10"
        >
          <option value="p">Text</option>
          <option value="h2">Headline</option>
          <option value="h3">Subheadline</option>
          <option value="h4">Small heading</option>
        </select>
        <ToolbarButton title="Bulleted list" Icon={ListIcon} onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton title="Numbered list" Icon={ListOrderedIcon} onClick={() => runCommand('insertOrderedList')} />
        <ToolbarButton title="Quote" Icon={QuoteIcon} onClick={() => runCommand('formatBlock', 'blockquote')} />
        <span className="mx-1.5 h-4 w-px bg-zinc-200 dark:bg-white/10" />
        <button
          type="button"
          onMouseDown={keepSelection}
          disabled={isUploading}
          onClick={() => imageInputRef.current?.click()}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {isUploading ? 'Uploading...' : 'Add screenshot'}
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileInput} className="hidden" />
      </div>

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
            className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
            className="absolute flex h-6 w-6 touch-none items-center justify-center rounded-full bg-black/60 text-white shadow-sm cursor-nwse-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
