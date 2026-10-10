import { badgeBase, badgeTone, dotTone } from '../../common/controlStyles'
import { dateInputClass, editorClass, footerClass, ghostFooterButton, iconButtonClass, inputClass, numberInputClass, primaryFooterButton, toolbarClass, toolbarDivider, toolbarIconButton, toolbarTextButton } from '../../common/formStyles'
import { useActiveFormats } from '../../../hooks/useActiveFormats'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { formatMoney, formatR, getTradePnl, getTradeR, toneOf } from '../../../utils/tradeAnalytics'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { isLocalPreview, preloadImage, prepareImage } from '../../../utils/imageUpload'
import { FIELD_TYPES, MAX_CUSTOM_FIELDS, makeFieldKey, toFormField } from '../../../utils/customFields'
import { clearInterim, getCleanHtml, insertDictatedText, parseDictation, showInterimText } from '../../../utils/dictation'
import { SHORTCUT_LABEL, useDictationShortcut, useVoiceDictation } from '../../../hooks/useVoiceDictation'
import { MOD_LABEL, useFormShortcuts } from '../../../hooks/useFormShortcuts'
import ShortcutHint from '../../common/ShortcutHint'
import TextStyleMenu from '../../common/TextStyleMenu'
import VoiceLevel from './VoiceLevel'

const defaultValues = {
  date: new Date().toISOString().slice(0, 10),
  symbol: '',
  quantity: '',
  entry: '',
  stopLoss: '',
  exit: '',
  direction: 'Long',
  analysis: '',
  images: [],
  customFields: []
}

/* ---------- motion + layout constants ---------- */
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION = 320
const EDGE_GAP = 12 // gap between the floating panel and the viewport edge (md:p-3)
const DEFAULT_WIDTH = 860
const MAX_WIDTH = 1400
const EXPANDED_WIDTH = 1400 // clamped by max-w-full on small screens

/* ---------- tiny stroke icon set (inherits currentColor) ---------- */
const iconPaths = {
  calendar: (<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>),
  hash: (<><path d="M4 9h16" /><path d="M4 15h16" /><path d="M10 3 8 21" /><path d="m16 3-2 18" /></>),
  direction: (<><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></>),
  entry: (<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>),
  shield: <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />,
  exit: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>),
  bold: <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />,
  italic: (<><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4 9 20" /></>),
  list: (<><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /></>),
  listOrdered: (<><path d="M11 5h10" /><path d="M11 12h10" /><path d="M11 19h10" /><path d="M4 4h1v5" /><path d="M4 9h2" /><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" /></>),
  quote: (<><path d="M4 5v14" /><path d="M9 8h11" /><path d="M9 12h11" /><path d="M9 16h7" /></>),
  pointer: <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />,
  image: (<><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></>),
  maximize: (<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" /></>),
  minimize: (<><path d="M4 14h6v6" /><path d="M20 10h-6V4" /><path d="m14 10 7-7" /><path d="m3 21 7-7" /></>),
  x: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>),
  trendUp: (<><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></>),
  trendDown: (<><path d="M22 17 13.5 8.5l-5 5L2 7" /><path d="M16 17h6v-6" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  text: (<><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></>),
  checkSquare: (<><path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  mic: (<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>)
}

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}

/* ---------- shared styles: see common/formStyles.js and common/controlStyles.js ---------- */

const directionOptions = [
  { value: 'Long', icon: 'trendUp', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300' },
  { value: 'Short', icon: 'trendDown', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300' }
]

// P&L badge colours come from badgeTone, so every status chip in the app uses the same AA-checked pairs

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

/* ---------- small building blocks ---------- */
function PropertyRow({ icon, label, hint, htmlFor, error, children }) {
  const Label = htmlFor ? 'label' : 'div'
  const labelProps = htmlFor ? { htmlFor } : {}

  return (
    <div className="flex items-start gap-3 py-0.5">
      <Label {...labelProps} className="flex h-8 w-36 shrink-0 items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
        <span className="shrink-0 text-zinc-600 dark:text-zinc-400"><Icon name={icon} size={15} /></span>
        <span className="truncate">{label}</span>
        {hint && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">({hint})</span>}
      </Label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <p role="alert" className="mt-0.5 px-2 text-[11px] font-medium text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
    </div>
  )
}

function ToolbarButton({ title, icon, onClick, active }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} onMouseDown={keepSelection} onClick={onClick} className={toolbarIconButton(active)}>
      <Icon name={icon} size={16} />
    </button>
  )
}

//---------------------Main Form-------------
function TradeForm({ journalName, currency = DEFAULT_CURRENCY, templateFields = [], initialTrade = null, onSubmit, onClose, onUploadImage, respectReducedMotion = false }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH)
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(0) // screenshots still uploading in the background
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [imageUploadError, setImageUploadError] = useState('')
  const [hoverImage, setHoverImage] = useState(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [reduceMotion] = useState(() => respectReducedMotion && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const editorRef = useRef(null)
  const formats = useActiveFormats(editorRef)
  const removedImagesRef = useRef(new Set())
  const pendingUploadsRef = useRef(new Set()) // promises of in-flight screenshot uploads
  const isSavingRef = useRef(false) // blocks a second submit (e.g. Enter key) while saving
  const currentImageUrlsRef = useRef(new Set())
  const imageResizeRef = useRef(null)
  const syncFormFromEditorRef = useRef(null)
  const editorSelectionRef = useRef(null)
  const imageInputRef = useRef(null)
  const isResizingRef = useRef(false)
  const closeTimerRef = useRef(null)
  const formRef = useRef(null)
  const submittedRef = useRef(false) // true once the form has handed its trade over and is closing
  const uploadedRef = useRef(new Map()) // local preview URL (or data: URL) -> hosted URL
  const sourceFilesRef = useRef(new Map()) // local preview URL -> original file, so a failed upload can be retried after the form closed
  const addMenuRef = useRef(null)
  const pendingFocusKeyRef = useRef(null)
  const templateRef = useRef(templateFields) // fields of the latest trade, read once when the form opens
  const { register, handleSubmit, setValue, reset, watch, control, formState: { errors } } = useForm({ defaultValues })
  const { fields: customFields, append: appendCustomField, remove: removeCustomField } = useFieldArray({ control, name: 'customFields' })

  const duration = reduceMotion ? 0 : DURATION
  const live = watch()
  const direction = live.direction
  const draftPnl = getTradePnl(live)
  const draftR = getTradeR(live)
  const isDraftClosed = String(live.exit ?? '').trim() !== ''

  // hide the remove button whenever the editor content changes (typing, delete key, reset)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return undefined
    const observer = new MutationObserver(() => setHoverImage(null))
    observer.observe(editor, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const formValues = initialTrade
      ? {
          ...defaultValues,
          ...initialTrade,
          quantity: initialTrade.quantity ?? initialTrade.qty ?? '',
          direction: initialTrade.direction ?? initialTrade.side ?? 'Long',
          customFields: (initialTrade.customFields ?? []).map(toFormField)
        }
      : { ...defaultValues, customFields: templateRef.current.map(toFormField) }

    removedImagesRef.current.clear()
    reset(formValues)
    if (editorRef.current) {
      editorRef.current.innerHTML = formValues.analysis ?? ''
      currentImageUrlsRef.current = new Set(
        [...editorRef.current.querySelectorAll('img')].map((image) => image.src)
      )
    }
  }, [initialTrade, reset])

  // close the "Add property" menu on outside click / Esc
  useEffect(() => {
    if (!addMenuOpen) return undefined
    const onPointerDown = (event) => {
      if (!addMenuRef.current?.contains(event.target)) setAddMenuOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault() // tells the form's own Esc shortcut that this one is already used
      setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [addMenuOpen])

  // a freshly added field jumps straight into renaming
  useEffect(() => {
    const key = pendingFocusKeyRef.current
    if (!key) return
    pendingFocusKeyRef.current = null
    const input = document.getElementById(`cf-label-${key}`)
    input?.focus()
    input?.select()
  }, [customFields.length])

  const addCustomField = (type) => {
    if (customFields.length >= MAX_CUSTOM_FIELDS) return
    const key = makeFieldKey()
    pendingFocusKeyRef.current = key
    appendCustomField({ key, label: FIELD_TYPES[type].label, type, value: FIELD_TYPES[type].empty })
    setAddMenuOpen(false)
  }

  // slide-in on mount (two frames so the browser paints the starting position first)
  useEffect(() => {
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!isResizingRef.current) return
      setDrawerWidth(Math.min(MAX_WIDTH, window.innerWidth - EDGE_GAP * 2, Math.max(420, window.innerWidth - EDGE_GAP - event.clientX)))
    }

    const stopResizing = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [])

  const startResizing = () => {
    isResizingRef.current = true
    setIsDragging(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  // slide-out, then let the parent unmount the form
  const requestClose = () => {
    if (closeTimerRef.current) return
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onClose?.()
    }, duration)
  }

  // Take focus off whatever opened this form (the trade card you clicked). If it stays focused underneath, pressing
  // Esc to close turns the browser's keyboard-focus ring on for it, and the card keeps its highlighted border.
  useEffect(() => {
    const form = formRef.current
    if (form && !form.contains(document.activeElement)) form.focus({ preventScroll: true })
  }, [])

  // Esc closes the form, Ctrl/Cmd + Enter saves it (both are off while it is already saving)
  useFormShortcuts({ formRef, onEscape: requestClose, canClose: !isSaving, canSubmit: !isSaving })

  const runEditorCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setValue('analysis', getCleanHtml(editorRef.current), { shouldDirty: true })
  }

  const handleEditorInput = () => syncFormFromEditor()

  const saveEditorSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      editorSelectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const syncFormFromEditor = () => {
    const editor = editorRef.current
    const imageUrls = [...(editor?.querySelectorAll('img') ?? [])].map((image) => image.src)
    const nextImageUrls = new Set(imageUrls)
    for (const imageUrl of currentImageUrlsRef.current) {
      if (!nextImageUrls.has(imageUrl) && !isLocalPreview(imageUrl)) removedImagesRef.current.add(imageUrl)
    }
    currentImageUrlsRef.current = nextImageUrls
    setValue('images', imageUrls, { shouldDirty: true })
    setValue('analysis', getCleanHtml(editor), { shouldDirty: true })
  }

  syncFormFromEditorRef.current = syncFormFromEditor

  // voice dictation: words show up grey as they are heard, then become real text at the caret of the analysis editor
  const dictationRef = useRef(null)
  const dictationUndoRef = useRef([]) // one undo() per inserted phrase, for "scratch that"

  const handleDictatedText = (text) => {
    const editor = editorRef.current
    clearInterim(editor)
    const tokens = parseDictation(text)

    const inserted = insertDictatedText(editor, editorSelectionRef.current, tokens)
    if (inserted) {
      editorSelectionRef.current = inserted.range
      dictationUndoRef.current.push(inserted.undo)
      if (dictationUndoRef.current.length > 30) dictationUndoRef.current.shift()
      syncFormFromEditor()
    }

    for (const token of tokens) {
      if (token.command === 'undo') {
        const undo = dictationUndoRef.current.pop()
        if (undo) {
          editorSelectionRef.current = undo()
          syncFormFromEditor()
        }
      } else if (token.command === 'stop') {
        dictationRef.current?.stop()
      }
    }
  }
  const handleInterimText = (text) => showInterimText(editorRef.current, editorSelectionRef.current, text)

  const dictation = useVoiceDictation({ onFinalText: handleDictatedText, onInterim: handleInterimText })
  dictationRef.current = dictation
  useDictationShortcut(dictation.toggle, { enabled: dictation.isSupported })

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
      syncFormFromEditorRef.current?.()
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

  // The screenshot shows up in the editor immediately from a local preview; compressing and uploading
  // it happens in the background and the preview is swapped for the hosted URL when that finishes.
  const insertImagePreview = (previewUrl) => {
    document.execCommand('insertImage', false, previewUrl)
    document.execCommand('insertParagraph', false, null)
  }

  const replacePreview = (previewUrl, finalUrl) => {
    if (!editorRef.current) return // the form already closed; the saved trade picks the hosted URL up from uploadedRef
    const previews = [...(editorRef.current?.querySelectorAll('img') ?? [])].filter((image) => image.src === previewUrl)
    if (!previews.length) {
      // the screenshot was removed while it uploaded: queue the hosted copy for deletion
      removedImagesRef.current.add(finalUrl)
      return
    }
    previews.forEach((image) => { image.src = finalUrl })
    syncFormFromEditorRef.current?.()
  }

  const removePreview = (previewUrl) => {
    if (!editorRef.current) return
    ;[...(editorRef.current?.querySelectorAll('img') ?? [])]
      .filter((image) => image.src === previewUrl)
      .forEach((image) => image.remove())
    syncFormFromEditorRef.current?.()
  }

  const trackUpload = (file, previewUrl) => {
    setPendingUploads((count) => count + 1)
    sourceFilesRef.current.set(previewUrl, file)
    const task = prepareImage(file)
      .then((smallFile) => onUploadImage(smallFile))
      .then(async (finalUrl) => {
        uploadedRef.current.set(previewUrl, finalUrl)
        await preloadImage(finalUrl) // swap only once the browser has it, so there's no flicker
        replacePreview(previewUrl, finalUrl)
      })
      .catch((error) => {
        removePreview(previewUrl)
        setImageUploadError(error.message || 'Image upload failed. Please try again.')
      })
      .finally(() => {
        // after saving, the trade card may still show this local preview until the hosted copy replaces it
        if (!submittedRef.current) URL.revokeObjectURL(previewUrl)
        pendingUploadsRef.current.delete(task)
        setPendingUploads((count) => count - 1)
      })
    pendingUploadsRef.current.add(task)
  }

  const addImageFiles = (files) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    setImageUploadError('')
    editorRef.current?.focus()
    const selection = window.getSelection()
    const savedRange = editorSelectionRef.current
    if (savedRange && editorRef.current?.contains(savedRange.startContainer)) {
      selection?.removeAllRanges()
      selection?.addRange(savedRange)
    }

    for (const file of imageFiles) {
      const previewUrl = URL.createObjectURL(file)
      insertImagePreview(previewUrl)
      trackUpload(file, previewUrl)
    }
    syncFormFromEditor()
    saveEditorSelection()
  }

  const handleImageUpload = (event) => {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    addImageFiles(files)
  }

  // screenshots are usually on the clipboard, so let Ctrl/Cmd+V work directly
  const handleEditorPaste = (event) => {
    const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    event.preventDefault()
    saveEditorSelection()
    addImageFiles(files)
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

  const handleEditorMouseMove = (event) => {
    const { target } = event
    if (target instanceof HTMLImageElement) showRemoveFor(target)
    else if (!(target instanceof Element && target.closest('[data-image-control]'))) setHoverImage(null)
  }

  // tapping an image reveals the button on touch screens, where there is no hover
  const handleEditorClick = (event) => {
    if (event.target instanceof HTMLImageElement) showRemoveFor(event.target)
  }

  const removeImage = (index) => {
    const image = editorRef.current?.querySelectorAll('img')[index]
    if (!image) return
    if (!isLocalPreview(image.src)) removedImagesRef.current.add(image.src)
    image.remove()
    setHoverImage(null)
    syncFormFromEditor()
  }

  // The form closes the moment you save. The card appears in the journal right away and the rest (finishing
  // screenshot uploads, then sending the trade) continues in the background; see addTrade / updateTrade in
  // journalContextProvider. Everything is read from the editor here, because the editor goes away with the form.
  const handleFormSubmit = async (values) => {
    if (isSavingRef.current) return
    isSavingRef.current = true

    const normalizedQuantity = String(values.quantity ?? '').trim()
    const normalizedEntry = String(values.entry ?? '').trim()
    const normalizedExit = String(values.exit ?? '').trim()
    const normalizedStopLoss = String(values.stopLoss ?? '').trim()
    const normalizedSymbol = String(values.symbol ?? '').trim().toUpperCase()

    setImageUploadError('')
    setSubmitError('')
    setIsSaving(true)
    try {
      await dictation.stopAndFlush() // don't lose the last spoken phrase (returns at once when the mic is off)

      const editor = editorRef.current
      const analysis = editor ? getCleanHtml(editor) : values.analysis ?? ''
      const images = [...(editor?.querySelectorAll('img') ?? [])].map((image) => image.src)
      const inFlightUploads = [...pendingUploadsRef.current]
      const removedImages = [...removedImagesRef.current].filter((url) => !images.includes(url) && !isLocalPreview(url))

      const cleanCustomFields = (values.customFields ?? []).map((field) => ({
        key: field.key,
        type: field.type,
        label: String(field.label ?? '').trim() || (FIELD_TYPES[field.type] ?? FIELD_TYPES.text).label,
        value: field.type === 'checkbox' ? Boolean(field.value) : field.value ?? ''
      }))

      const payload = {
        ...values,
        analysis,
        images,
        removedImages,
        customFields: cleanCustomFields,
        symbol: normalizedSymbol,
        assetName: normalizedSymbol,
        quantity: normalizedQuantity,
        qty: normalizedQuantity,
        entry: normalizedEntry,
        entryPrice: normalizedEntry,
        exit: normalizedExit,
        exitPrice: normalizedExit,
        stopLoss: normalizedStopLoss,
        side: values.direction,
        direction: values.direction,
        pnl: '$0',
        status: normalizedExit ? 'Closed' : 'Open',
        date: values.date || new Date().toISOString().slice(0, 10)
      }

      // Runs in the background before the trade is sent: waits for screenshots that were still uploading and
      // swaps their local previews for hosted URLs. Safe to run again on "Retry" (finished uploads are reused,
      // failed ones are uploaded again from the original file).
      const prepare = async () => {
        await Promise.all(inFlightUploads)

        const holder = document.createElement('div')
        holder.innerHTML = analysis
        for (const image of holder.querySelectorAll('img')) {
          const source = image.getAttribute('src') ?? ''
          const isPreview = isLocalPreview(source)
          if (!isPreview && !source.startsWith('data:image/')) continue

          let hostedUrl = uploadedRef.current.get(source)
          if (!hostedUrl) {
            // data: images were dropped in without going through the button / paste path
            const file = isPreview
              ? sourceFilesRef.current.get(source)
              : await fetch(source)
                  .then((response) => response.blob())
                  .then((blob) => new File([blob], `trade-image-${Date.now()}.${blob.type.split('/')[1]?.split('+')[0] || 'png'}`, { type: blob.type }))
            if (!file) {
              image.remove()
              continue
            }
            hostedUrl = await onUploadImage(await prepareImage(file))
            uploadedRef.current.set(source, hostedUrl)
          }
          image.setAttribute('src', hostedUrl)
        }

        const finalImages = [...holder.querySelectorAll('img')].map((image) => image.getAttribute('src'))
        return {
          ...payload,
          analysis: holder.innerHTML,
          images: finalImages,
          removedImages: removedImages.filter((url) => !finalImages.includes(url))
        }
      }

      submittedRef.current = true
      Promise.resolve(onSubmit(payload, { prepare })).catch(() => {}) // failures are shown on the trade card
      requestClose()
    } catch (error) {
      setSubmitError(error.message || 'Could not save this trade. Please try again.')
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  const slide = `transform ${duration}ms ${EASE}`
  const grow = `width ${duration}ms ${EASE}`

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/30 p-2 backdrop-blur-[2px] md:p-3"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${duration}ms ${EASE}` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-form-title"
    >
      <form
        ref={formRef}
        tabIndex={-1}
        onSubmit={handleSubmit(handleFormSubmit)}
        style={{
          width: `${expanded ? EXPANDED_WIDTH : drawerWidth}px`,
          transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 2rem))',
          // no width easing while the user drags the edge, otherwise it feels laggy
          transition: isDragging ? slide : `${grow}, ${slide}`
        }}
        className="relative flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <h2 id="trade-form-title" className="sr-only">{initialTrade ? 'Review trade in' : 'Add to'} {journalName}</h2>

        <div
          role="separator"
          aria-label="Resize trade form"
          aria-orientation="vertical"
          onPointerDown={startResizing}
          className={`group absolute bottom-0 left-0 top-0 z-20 w-2.5 cursor-ew-resize ${expanded ? 'hidden' : 'hidden md:block'}`}
        >
          <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-300 opacity-0 transition group-hover:opacity-100 dark:bg-zinc-600" />
        </div>

        {/* top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? 'Collapse trade form' : 'Expand trade form'}
              aria-pressed={expanded}
              title={expanded ? 'Collapse' : 'Expand'}
              className={`${iconButtonClass} hidden md:flex`}
            >
              <Icon name={expanded ? 'minimize' : 'maximize'} size={15} />
            </button>
            <p className="truncate pl-1 text-xs text-zinc-600 dark:text-zinc-400">
              {journalName}
              <span className="mx-1.5 opacity-60">/</span>
              {initialTrade ? 'Trade review' : 'New trade'}
            </p>
          </div>
          <button type="button" onClick={requestClose} disabled={isSaving} aria-label="Close trade form" title="Close" className={iconButtonClass}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* page body */}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#d4d4d8_transparent] [scrollbar-width:thin] dark:[scrollbar-color:#3f3f46_transparent]">
          <div className={`mx-auto w-full px-6 pb-16 pt-4 sm:px-10 ${expanded ? 'max-w-[1080px]' : 'max-w-[920px]'}`}>
            {/* title = asset name */}
            <input
              {...register('symbol', { required: 'Asset name is required' })}
              aria-label="Asset name"
              autoComplete="off"
              placeholder="e.g. BTCUSD"
              className="w-full rounded-md bg-transparent text-3xl font-bold uppercase leading-tight tracking-tight text-zinc-900 outline-none placeholder:font-bold placeholder:normal-case placeholder:text-zinc-500 sm:text-4xl sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-400"
            />
            {errors.symbol && <p className="mt-1 text-xs text-rose-500">{errors.symbol.message}</p>}

            {/* live status: Closed / P&L / R share one badge shape, h-6 with gap-2, and wrap as whole chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
              <span className={`${badgeBase} ${isDraftClosed ? badgeTone.neutral : badgeTone.open}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDraftClosed ? dotTone.neutral : dotTone.open}`} />
                {isDraftClosed ? 'Closed' : 'Open'}
              </span>
              {draftPnl !== null && (
                <span className={`${badgeBase} font-semibold ${badgeTone[toneOf(draftPnl)] ?? badgeTone.neutral}`}>
                  {formatMoney(draftPnl, { signed: true, currency })}
                </span>
              )}
              {draftR !== null && (
                <span className={`${badgeBase} font-semibold ${badgeTone.neutral}`}>
                  {formatR(draftR)}
                </span>
              )}
            </div>

            {/* properties: two columns when the drawer is wide enough */}
            <div className="@container mt-6">
              <div className="grid gap-x-12 gap-y-1 @2xl:grid-cols-2">
                <PropertyRow icon="calendar" label="Date" htmlFor="trade-date">
                  <input id="trade-date" type="date" {...register('date')} className={dateInputClass} />
                </PropertyRow>

                <PropertyRow icon="hash" label="Quantity" htmlFor="trade-quantity" error={errors.quantity?.message}>
                  <input id="trade-quantity" type="number" min="0" step="any" {...register('quantity', { required: 'Quantity is required' })} placeholder="0.00" className={numberInputClass} />
                </PropertyRow>

                <PropertyRow icon="direction" label="Direction">
                  <div role="radiogroup" aria-label="Direction" className="flex h-8 items-center gap-1">
                    {directionOptions.map(({ value, icon, tone }) => (
                      <label key={value} className="cursor-pointer">
                        <input type="radio" value={value} {...register('direction')} className="peer sr-only" />
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[13px] font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400/50 ${
                            direction === value
                              ? tone
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100'
                          }`}
                        >
                          <Icon name={icon} size={14} />
                          {value}
                        </span>
                      </label>
                    ))}
                  </div>
                </PropertyRow>

                <PropertyRow icon="entry" label="Entry price" htmlFor="trade-entry" error={errors.entry?.message}>
                  <input id="trade-entry" type="number" min="0" step="any" {...register('entry', { required: 'Entry price is required' })} placeholder="0.00" className={numberInputClass} />
                </PropertyRow>

                <PropertyRow icon="shield" label="Stop loss" hint="optional" htmlFor="trade-stop-loss" error={errors.stopLoss?.message}>
                  <input
                    id="trade-stop-loss"
                    type="number"
                    min="0"
                    step="any"
                    {...register('stopLoss', {
                      validate: (value, formValues) => {
                        const stop = Number(value)
                        const entry = Number(formValues.entry)
                        if (value === '' || value === null || value === undefined || !entry || !Number.isFinite(stop)) return true
                        if (stop === entry) return 'Stop loss can\'t equal the entry price'
                        if (formValues.direction === 'Short') return stop > entry || 'For a short, the stop sits above entry'
                        return stop < entry || 'For a long, the stop sits below entry'
                      }
                    })}
                    placeholder="Used for RRR"
                    className={numberInputClass}
                  />
                </PropertyRow>

                <PropertyRow icon="exit" label="Exit price" hint="optional" htmlFor="trade-exit">
                  <input id="trade-exit" type="number" min="0" step="any" {...register('exit')} placeholder="Leave open" className={numberInputClass} />
                </PropertyRow>

                {customFields.map((field, index) => {
                  const typeConfig = FIELD_TYPES[field.type] ?? FIELD_TYPES.text
                  const name = `customFields.${index}.value`
                  return (
                    <div key={field.id} className="group/row flex items-start gap-2 py-0.5">
                      <div className="flex h-8 w-32 shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
                        <Icon name={typeConfig.icon} size={15} />
                        <input
                          id={`cf-label-${field.key}`}
                          {...register(`customFields.${index}.label`)}
                          aria-label="Field name"
                          placeholder="Name"
                          maxLength={40}
                          autoComplete="off"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              event.currentTarget.blur()
                            }
                          }}
                          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] text-zinc-600 outline-none transition-colors placeholder:text-zinc-500 hover:bg-zinc-100/80 focus:bg-zinc-100 focus:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.06] dark:focus:text-zinc-100"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        {field.type === 'checkbox' ? (
                          <div className="flex h-8 items-center px-2">
                            <input type="checkbox" {...register(name)} aria-label={`${field.label || typeConfig.label} value`} className="h-4 w-4 cursor-pointer rounded accent-zinc-700 dark:accent-zinc-300" />
                          </div>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            {...register(name)}
                            aria-label={`${field.label || typeConfig.label} value`}
                            autoComplete="off"
                            placeholder="Empty"
                            className={field.type === 'number' ? numberInputClass : field.type === 'date' ? dateInputClass : inputClass}
                          />
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCustomField(index)}
                        title="Remove field"
                        aria-label={`Remove ${field.label || typeConfig.label} field`}
                        className="flex h-8 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 md:opacity-0 md:group-hover/row:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>

              <div ref={addMenuRef} className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen((open) => !open)}
                  disabled={customFields.length >= MAX_CUSTOM_FIELDS}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200"
                >
                  <Icon name="plus" size={14} />
                  Add property
                </button>

                {addMenuOpen && (
                  <div role="menu" className="absolute left-0 top-9 z-30 w-52 rounded-lg border border-zinc-300 bg-white p-1 shadow-lg dark:border-white/[0.14] dark:bg-panel-hi">
                    <p className="px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-400">Property type</p>
                    {Object.entries(FIELD_TYPES).map(([type, config]) => (
                      <button
                        key={type}
                        type="button"
                        role="menuitem"
                        onClick={() => addCustomField(type)}
                        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                      >
                        <span className="text-zinc-500 dark:text-zinc-400"><Icon name={config.icon} size={15} /></span>
                        {config.label}
                      </button>
                    ))}
                    <p className="mt-1 border-t border-zinc-200 px-2 pb-1 pt-2 text-[11px] leading-snug text-zinc-500 dark:border-white/[0.09] dark:text-zinc-400">
                      Saved with this trade and added to your next one.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <hr className="my-6 border-zinc-300 dark:border-white/[0.12]" />

            {/* analysis */}
            <section className="group">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span id="trade-analysis-label" className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">Trade analysis</span>
                <span className="hidden text-[11px] text-zinc-600 sm:block dark:text-zinc-400">Tip: paste screenshots straight in with Ctrl/⌘ + V</span>
              </div>

              {/* toolbar: every control is h-8, 16px icons, 4px gap; Bold/Italic/lists show a real pressed state */}
              <div role="toolbar" aria-label="Formatting" className={toolbarClass}>
                <ToolbarButton title="Bold" icon="bold" active={formats.bold} onClick={() => runEditorCommand('bold')} />
                <ToolbarButton title="Italic" icon="italic" active={formats.italic} onClick={() => runEditorCommand('italic')} />
                <TextStyleMenu value={formats.block} onChange={(tag) => runEditorCommand('formatBlock', tag)} />
                <span aria-hidden="true" className={toolbarDivider} />
                <ToolbarButton title="Bulleted list" icon="list" active={formats.insertUnorderedList} onClick={() => runEditorCommand('insertUnorderedList')} />
                <ToolbarButton title="Numbered list" icon="listOrdered" active={formats.insertOrderedList} onClick={() => runEditorCommand('insertOrderedList')} />
                <ToolbarButton title="Pointer" icon="pointer" onClick={() => runEditorCommand('formatBlock', 'p')} />
                <ToolbarButton title="Quote" icon="quote" active={formats.block === 'blockquote'} onClick={() => runEditorCommand('formatBlock', 'blockquote')} />
                <span aria-hidden="true" className={toolbarDivider} />
                <button
                  type="button"
                  onMouseDown={keepSelection}
                  onClick={() => imageInputRef.current?.click()}
                  className={toolbarTextButton()}
                >
                  <Icon name="image" size={16} />
                  {pendingUploads > 0 ? `Uploading ${pendingUploads}...` : 'Add screenshot'}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                <button
                  type="button"
                  onMouseDown={keepSelection}
                  onClick={dictation.toggle}
                  disabled={!dictation.isSupported}
                  aria-pressed={dictation.isListening}
                  title={dictation.isSupported ? `${dictation.isListening ? 'Stop dictation' : 'Dictate your analysis'} (${SHORTCUT_LABEL})` : "Voice input isn't supported in this browser. Try Chrome, Edge or Safari."}
                  className={toolbarTextButton(dictation.isListening)}
                >
                  <Icon name="mic" size={16} />
                  {dictation.isListening ? 'Stop' : 'Dictate'}
                  <kbd className="hidden rounded border border-current/30 px-1 text-[10px] font-normal opacity-80 md:inline">{SHORTCUT_LABEL}</kbd>
                </button>
              </div>

              {(dictation.isListening || dictation.error || dictation.notice) && (
                <div aria-live="polite" className="flex min-h-8 items-center gap-2 border-b border-zinc-200 px-1 py-1.5 text-xs dark:border-white/[0.08]">
                  {dictation.error ? (
                    <span role="alert" className="text-rose-500">{dictation.error}</span>
                  ) : dictation.isListening ? (
                    <>
                      <VoiceLevel levelRef={dictation.levelRef} active />
                      <span className="truncate text-zinc-500 dark:text-zinc-400">
                        Listening… say &quot;full stop&quot;, &quot;new line&quot;, &quot;bullet point&quot;, &quot;scratch that&quot; or &quot;stop listening&quot;
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">{dictation.notice}</span>
                  )}
                </div>
              )}

              <div className="relative" onMouseMove={handleEditorMouseMove} onMouseLeave={() => setHoverImage(null)}>
                <div
                  ref={editorRef}
                  id="trade-analysis"
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-labelledby="trade-analysis-label"
                  data-placeholder="What did you see? What did you do? What would you change next time?"
                  onInput={handleEditorInput}
                  onClick={handleEditorClick}
                  onPaste={handleEditorPaste}
                  onMouseUp={saveEditorSelection}
                  onKeyUp={saveEditorSelection}
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
                    <Icon name="x" size={13} />
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
                    <Icon name="maximize" size={12} />
                  </button>
                )}
              </div>
              {imageUploadError && <p role="alert" className="mt-2 text-xs text-rose-500">{imageUploadError}</p>}
              <input type="hidden" {...register('analysis')} />
              <input type="hidden" {...register('images')} />
            </section>
          </div>
        </div>

        <footer className={`${footerClass} justify-end`}>
          {submitError ? <p role="alert" className="mr-auto text-xs font-medium text-rose-700 dark:text-rose-300">{submitError}</p> : <ShortcutHint className="mr-auto hidden md:block" />}
          <button type="button" onClick={requestClose} disabled={isSaving} className={ghostFooterButton}>Cancel</button>
          <button type="submit" disabled={isSaving} title={`Save (${MOD_LABEL}+Enter)`} className={primaryFooterButton}>
            {isSaving && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />}
            {isSaving ? 'Saving...' : initialTrade ? 'Save review' : 'Save trade'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default TradeForm