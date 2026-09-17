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

function TradeForm({ journalName, initialTrade = null, onSubmit, onClose }) {
  const [drawerWidth, setDrawerWidth] = useState(640)
  const editorRef = useRef(null)
  const imageInputRef = useRef(null)
  const isResizingRef = useRef(false)
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm({ defaultValues })

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

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!isResizingRef.current) return
      setDrawerWidth(Math.min(900, Math.max(420, window.innerWidth - event.clientX)))
    }

    const stopResizing = () => {
      isResizingRef.current = false
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
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="trade-form-title">
      <form onSubmit={handleSubmit(handleFormSubmit)} style={{ width: `${drawerWidth}px` }} className="relative flex h-full max-w-full flex-col overflow-hidden border-l border-zinc-200 bg-stone-50 shadow-2xl dark:border-zinc-800 dark:bg-[#171a1d]">
        <div role="separator" aria-label="Resize trade form" aria-orientation="vertical" onPointerDown={startResizing} className="group absolute bottom-0 left-0 top-0 z-20 hidden w-2 -translate-x-1/2 cursor-ew-resize md:block">
          <span className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-300 opacity-0 transition group-hover:opacity-100 dark:bg-zinc-600" />
        </div>

        <header className="flex items-start justify-between border-b border-zinc-200 px-8 py-6 dark:border-zinc-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500">{initialTrade ? 'Trade review' : 'New trade'}</p>
            <h2 id="trade-form-title" className="mt-1 text-xl font-semibold tracking-[-0.04em] text-zinc-900 dark:text-zinc-100">{initialTrade ? 'Review trade in' : 'Add to'} {journalName}</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Check your setup, execution, and lessons before saving.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close trade form" className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Date
              <input type="date" {...register('date')} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Asset name
              <input {...register('symbol', { required: 'Asset name is required' })} placeholder="e.g. BTCUSD" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm uppercase outline-none transition placeholder:normal-case placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              {errors.symbol && <span className="mt-1 block text-[11px] text-rose-500">{errors.symbol.message}</span>}
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Quantity
              <input type="number" min="0" step="any" {...register('quantity', { required: 'Quantity is required' })} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              {errors.quantity && <span className="mt-1 block text-[11px] text-rose-500">{errors.quantity.message}</span>}
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Direction
              <select {...register('direction')} className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"><option>Long</option><option>Short</option></select>
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Entry price
              <input type="number" min="0" step="any" {...register('entry', { required: 'Entry price is required' })} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
              {errors.entry && <span className="mt-1 block text-[11px] text-rose-500">{errors.entry.message}</span>}
            </label>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Exit price <span className="font-normal text-zinc-400">(optional)</span>
              <input type="number" min="0" step="any" {...register('exit')} placeholder="Leave open" className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            </label>
          </div>

          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <label htmlFor="trade-analysis" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Trade analysis</label>
              <span className="text-[10px] text-zinc-400">Your notes, thesis, and screenshots</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                <button type="button" title="Bold" aria-label="Bold" onClick={() => runEditorCommand('bold')} className="h-7 w-7 rounded-md text-xs font-bold text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">B</button>
                <button type="button" title="Italic" aria-label="Italic" onClick={() => runEditorCommand('italic')} className="h-7 w-7 rounded-md text-xs italic text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">I</button>
                <select title="Text style" aria-label="Text style" defaultValue="p" onChange={(event) => runEditorCommand('formatBlock', event.target.value)} className="h-7 rounded-md border-0 bg-transparent px-1 text-[11px] text-zinc-600 outline-none hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"><option value="p">Text</option><option value="h2">Headline</option><option value="h3">Subheadline</option><option value="h4">Small heading</option></select>
                <button type="button" title="Bulleted list" aria-label="Bulleted list" onClick={() => runEditorCommand('insertUnorderedList')} className="h-7 w-7 rounded-md text-sm text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">•</button>
                <button type="button" title="Numbered list" aria-label="Numbered list" onClick={() => runEditorCommand('insertOrderedList')} className="h-7 w-7 rounded-md text-xs text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">1.</button>
                <button type="button" title="Pointer" aria-label="Pointer" onClick={() => runEditorCommand('formatBlock', 'p')} className="h-7 w-7 rounded-md text-sm text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">↖</button>
                <button type="button" title="Quote" aria-label="Quote" onClick={() => runEditorCommand('formatBlock', 'blockquote')} className="h-7 w-7 rounded-md text-xs text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">❝</button>
                <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
                <button type="button" onClick={() => imageInputRef.current?.click()} className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800">Add image</button>
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
              <div ref={editorRef} id="trade-analysis" contentEditable role="textbox" aria-multiline="true" data-placeholder="Start writing your setup, what you noticed, and what you learned..." onInput={handleEditorInput} className="min-h-72 px-6 py-6 text-sm leading-7 text-zinc-700 outline-none empty:before:pointer-events-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] dark:text-zinc-200 dark:empty:before:text-zinc-600 [&_blockquote]:border-l-2 [&_blockquote]:border-sky-400 [&_blockquote]:pl-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-medium [&_h4]:font-medium [&_img]:my-3 [&_img]:max-h-72 [&_img]:rounded-xl [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6" />
              <input type="hidden" {...register('analysis')} />
              <input type="hidden" {...register('images')} />
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-zinc-200 px-8 py-5 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">Cancel</button>
          <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600">{initialTrade ? 'Save review' : 'Save trade'}</button>
        </footer>
      </form>
    </div>
  )
}

export default TradeForm