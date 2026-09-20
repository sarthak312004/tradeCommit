import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

const defaultValues = {
  date: new Date().toISOString().slice(0, 10),
  symbol: '',
  quantity: '',
  entry: '',
  exit: '',
  direction: 'Long',
  analysis: '',
  images: []
}

/* ---------- motion + layout constants ---------- */
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DURATION = 320
const EDGE_GAP = 16 // gap between the floating panel and the viewport edge (md:p-4)
const EXPANDED_WIDTH = 1100 // clamped by max-w-full on small screens

/* ---------- tiny stroke icon set (inherits currentColor) ---------- */
const iconPaths = {
  calendar: (<><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>),
  hash: (<><path d="M4 9h16" /><path d="M4 15h16" /><path d="M10 3 8 21" /><path d="m16 3-2 18" /></>),
  direction: (<><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></>),
  entry: (<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>),
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
  x: (<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>)
}

function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  )
}

/* ---------- shared styles ---------- */
const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200'

const inputClass = 'h-[30px] w-full rounded-md bg-transparent px-2 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 hover:bg-zinc-100 focus:bg-zinc-100 focus:ring-1 focus:ring-sky-500/40 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]'
const numberInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
const dateInputClass = `${inputClass} [color-scheme:light] dark:[color-scheme:dark]`

const toolbarButtonClass = 'flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'

const editorClass = [
  'min-h-64 py-4 text-[15px] leading-7 text-zinc-800 outline-none dark:text-zinc-200',
  'empty:before:pointer-events-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-zinc-600',
  '[&_h2]:mb-1 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-9',
  '[&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-8',
  '[&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 dark:[&_blockquote]:border-zinc-600',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-zinc-200 dark:[&_img]:border-white/10'
].join(' ')

const directionOptions = [
  { value: 'Long', tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { value: 'Short', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300' }
]

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

/* ---------- small building blocks ---------- */
function PropertyRow({ icon, label, hint, htmlFor, error, children }) {
  const Label = htmlFor ? 'label' : 'div'
  const labelProps = htmlFor ? { htmlFor } : {}

  return (
    <div className="flex items-start gap-2 py-0.5">
      <Label {...labelProps} className="flex h-[30px] w-36 shrink-0 items-center gap-2 text-[13px] text-zinc-500 sm:w-40 dark:text-zinc-400">
        <span className="text-zinc-400 dark:text-zinc-500"><Icon name={icon} size={16} /></span>
        <span className="truncate">{label}</span>
        {hint && <span className="text-[11px] text-zinc-400/80 dark:text-zinc-600">{hint}</span>}
      </Label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <p className="mt-0.5 px-2 text-[11px] text-rose-500">{error}</p>}
      </div>
    </div>
  )
}

function ToolbarButton({ title, icon, onClick }) {
  return (
    <button type="button" title={title} aria-label={title} onMouseDown={keepSelection} onClick={onClick} className={toolbarButtonClass}>
      <Icon name={icon} size={15} />
    </button>
  )
}

//---------------------Main Form-------------
function TradeForm({ journalName, initialTrade = null, onSubmit, onClose, respectReducedMotion = false }) {
  const [drawerWidth, setDrawerWidth] = useState(640)
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reduceMotion] = useState(() => respectReducedMotion && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const editorRef = useRef(null)
  const imageInputRef = useRef(null)
  const isResizingRef = useRef(false)
  const closeTimerRef = useRef(null)
  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm({ defaultValues })

  const duration = reduceMotion ? 0 : DURATION
  const direction = watch('direction')

  useEffect(() => {
    const formValues = initialTrade
      ? {
          ...defaultValues,
          ...initialTrade,
          quantity: initialTrade.quantity ?? initialTrade.qty ?? '',
          direction: initialTrade.direction ?? initialTrade.side ?? 'Long'
        }
      : defaultValues

    reset(formValues)
    if (editorRef.current) editorRef.current.innerHTML = formValues.analysis ?? ''
  }, [initialTrade, reset])

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
      setDrawerWidth(Math.min(900, Math.max(420, window.innerWidth - EDGE_GAP - event.clientX)))
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

  const runEditorCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    setValue('analysis', editorRef.current?.innerHTML ?? '', { shouldDirty: true })
  }

  const handleEditorInput = (event) => {
    setValue('analysis', event.currentTarget.innerHTML, { shouldDirty: true })
  }

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      editorRef.current?.focus()
      document.execCommand('insertImage', false, reader.result)
      setValue('images', [...(editorRef.current?.querySelectorAll('img') ?? [])].map((image) => image.src), { shouldDirty: true })
      setValue('analysis', editorRef.current?.innerHTML ?? '', { shouldDirty: true })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleFormSubmit = (values) => {
    onSubmit({
      ...values,
      symbol: values.symbol.trim().toUpperCase(),
      quantity: values.quantity.trim(),
      entry: values.entry.trim(),
      exit: values.exit.trim(),
      pnl: '$0',
      side: values.direction,
      qty: values.quantity.trim(),
      status: values.exit.trim() ? 'Closed' : 'Open',
      date: values.date || 'Today'
    })
    reset(defaultValues)
  }

  const slide = `transform ${duration}ms ${EASE}`
  const grow = `width ${duration}ms ${EASE}`

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/30 p-3 backdrop-blur-[2px] md:p-4"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${duration}ms ${EASE}` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-form-title"
    >
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        style={{
          width: `${expanded ? EXPANDED_WIDTH : drawerWidth}px`,
          transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 2rem))',
          // no width easing while the user drags the edge, otherwise it feels laggy
          transition: isDragging ? slide : `${grow}, ${slide}`
        }}
        className="relative flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#202020]"
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
            <p className="truncate pl-1 text-xs text-zinc-400 dark:text-zinc-500">
              {journalName}
              <span className="mx-1.5 opacity-60">/</span>
              {initialTrade ? 'Trade review' : 'New trade'}
            </p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close trade form" title="Close" className={iconButtonClass}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* page body */}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#d4d4d8_transparent] [scrollbar-width:thin] dark:[scrollbar-color:#3f3f46_transparent]">
          <div className="mx-auto w-full max-w-[720px] px-8 pb-16 pt-4 sm:px-10">
            {/* title = asset name */}
            <input
              {...register('symbol', { required: 'Asset name is required' })}
              aria-label="Asset name"
              autoComplete="off"
              placeholder="e.g. BTCUSD"
              className="w-full bg-transparent text-3xl font-bold uppercase tracking-tight text-zinc-900 outline-none placeholder:font-bold placeholder:normal-case placeholder:text-zinc-300 sm:text-[40px] sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-700"
            />
            {errors.symbol && <p className="mt-1 text-xs text-rose-500">{errors.symbol.message}</p>}

            {/* properties */}
            <div className="mt-6">
              <PropertyRow icon="calendar" label="Date" htmlFor="trade-date">
                <input id="trade-date" type="date" {...register('date')} className={dateInputClass} />
              </PropertyRow>

              <PropertyRow icon="hash" label="Quantity" htmlFor="trade-quantity" error={errors.quantity?.message}>
                <input id="trade-quantity" type="number" min="0" step="any" {...register('quantity', { required: 'Quantity is required' })} placeholder="0.00" className={numberInputClass} />
              </PropertyRow>

              <PropertyRow icon="direction" label="Direction">
                <div role="radiogroup" aria-label="Direction" className="flex h-[30px] items-center gap-1 px-1">
                  {directionOptions.map(({ value, tone }) => (
                    <label key={value} className="cursor-pointer">
                      <input type="radio" value={value} {...register('direction')} className="peer sr-only" />
                      <span
                        className={`block rounded-[4px] px-2 py-0.5 text-[13px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400/50 ${
                          direction === value
                            ? tone
                            : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300'
                        }`}
                      >
                        {value}
                      </span>
                    </label>
                  ))}
                </div>
              </PropertyRow>

              <PropertyRow icon="entry" label="Entry price" htmlFor="trade-entry" error={errors.entry?.message}>
                <input id="trade-entry" type="number" min="0" step="any" {...register('entry', { required: 'Entry price is required' })} placeholder="0.00" className={numberInputClass} />
              </PropertyRow>

              <PropertyRow icon="exit" label="Exit price" hint="optional" htmlFor="trade-exit">
                <input id="trade-exit" type="number" min="0" step="any" {...register('exit')} placeholder="Leave open" className={numberInputClass} />
              </PropertyRow>
            </div>

            <hr className="my-8 border-zinc-200 dark:border-white/[0.08]" />

            {/* analysis */}
            <section className="group">
              <div className="mb-2 flex items-baseline justify-between">
                <span id="trade-analysis-label" className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Trade analysis</span>
                <span className="hidden text-[11px] text-zinc-400 sm:block dark:text-zinc-600">Your notes, thesis, and screenshots</span>
              </div>

              <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-zinc-200/80 bg-white py-1.5 opacity-70 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100 hover:opacity-100 dark:border-white/[0.08] dark:bg-[#202020]">
                <ToolbarButton title="Bold" icon="bold" onClick={() => runEditorCommand('bold')} />
                <ToolbarButton title="Italic" icon="italic" onClick={() => runEditorCommand('italic')} />
                <select
                  title="Text style"
                  aria-label="Text style"
                  defaultValue="p"
                  onChange={(event) => runEditorCommand('formatBlock', event.target.value)}
                  className="mx-0.5 h-7 cursor-pointer rounded-md bg-transparent px-1.5 text-xs text-zinc-500 outline-none transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:[color-scheme:dark] dark:hover:bg-white/10"
                >
                  <option value="p">Text</option>
                  <option value="h2">Headline</option>
                  <option value="h3">Subheadline</option>
                  <option value="h4">Small heading</option>
                </select>
                <ToolbarButton title="Bulleted list" icon="list" onClick={() => runEditorCommand('insertUnorderedList')} />
                <ToolbarButton title="Numbered list" icon="listOrdered" onClick={() => runEditorCommand('insertOrderedList')} />
                <ToolbarButton title="Pointer" icon="pointer" onClick={() => runEditorCommand('formatBlock', 'p')} />
                <ToolbarButton title="Quote" icon="quote" onClick={() => runEditorCommand('formatBlock', 'blockquote')} />
                <span className="mx-1.5 h-4 w-px bg-zinc-200 dark:bg-white/10" />
                <button
                  type="button"
                  onMouseDown={keepSelection}
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100"
                >
                  <Icon name="image" size={14} />
                  Add image
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>

              <div
                ref={editorRef}
                id="trade-analysis"
                contentEditable
                role="textbox"
                aria-multiline="true"
                aria-labelledby="trade-analysis-label"
                data-placeholder="Start writing your setup, what you noticed, and what you learned..."
                onInput={handleEditorInput}
                className={editorClass}
              />
              <input type="hidden" {...register('analysis')} />
              <input type="hidden" {...register('images')} />
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 px-6 py-3 dark:border-white/[0.08]">
          <button type="button" onClick={requestClose} className="h-8 rounded-md px-3 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100">Cancel</button>
          <button type="submit" className="h-8 rounded-md bg-sky-500 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-sky-600">{initialTrade ? 'Save review' : 'Save trade'}</button>
        </footer>
      </form>
    </div>
  )
}

export default TradeForm