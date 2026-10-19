import { badgeBase, badgeTone, dotTone } from '../../common/controlStyles'
import { dateInputClass, footerClass, ghostFooterButton, iconButtonClass, inputClass, numberInputClass, primaryFooterButton } from '../../common/formStyles'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { formatMoney, formatR, getTradePnl, getTradeR, toneOf } from '../../../utils/tradeAnalytics'
import { DEFAULT_CURRENCY } from '../../../utils/currencies'
import { FIELD_TYPES, MAX_CUSTOM_FIELDS, makeFieldKey, toFormField } from '../../../utils/customFields'
import { MOD_LABEL, useFormShortcuts } from '../../../hooks/useFormShortcuts'
import { todayKey } from '../../../utils/calendar'
import { useLivePrice } from '../../../hooks/useLivePrice'
import { useSymbolSearch } from '../../../hooks/useSymbolSearch'
import ShortcutHint from '../../common/ShortcutHint'
import DeferredEditor from '../../common/DeferredEditor'
import { useDrawerMotion } from '../../common/useDrawerMotion'
import SymbolSuggestions from './SymbolSuggestions'

// built when the form opens, in local time (UTC would show yesterday for Indian users before 5:30 am)
const getDefaultValues = () => ({
  date: todayKey(),
  symbol: '',
  quantity: '',
  risk: '', // helper only, never saved: when filled it sizes the quantity from entry and stop loss
  entry: '',
  stopLoss: '',
  exit: '',
  direction: 'Long',
  analysis: '',
  images: [],
  customFields: []
})

// last quantity used per symbol, kept in this browser only
const QUANTITY_MEMORY_KEY = 'tradecommit:lastQuantity'
const readQuantityMemory = () => {
  try {
    return JSON.parse(localStorage.getItem(QUANTITY_MEMORY_KEY)) ?? {}
  } catch {
    return {}
  }
}
const rememberQuantity = (symbol, quantity) => {
  try {
    const memory = readQuantityMemory()
    delete memory[symbol]
    memory[symbol] = quantity // re-added last, so the 200 most recent symbols are the ones kept
    const recent = Object.fromEntries(Object.entries(memory).slice(-200))
    localStorage.setItem(QUANTITY_MEMORY_KEY, JSON.stringify(recent))
  } catch {
    // storage blocked or full: remembering the quantity is only a convenience
  }
}

// quantity that risks `risk` between entry and stop loss (whole units when there are more than one)
const sizeFromRisk = (risk, entry, stop) => {
  const amount = Number(risk)
  const distance = Math.abs(Number(entry) - Number(stop))
  if (!(amount > 0) || !(Number(entry) > 0) || !(Number(stop) > 0) || !(distance > 0)) return null
  const size = amount / distance
  return size >= 1 ? Math.floor(size) : Number(size.toFixed(4))
}

// keep the stop loss at the same number of decimals the price has (1.08123 -> 5, 2845.1 -> 2)
const roundToTick = (price, value) => {
  const decimals = price >= 1000 ? 2 : price >= 100 ? 3 : price >= 10 ? 4 : price >= 1 ? 5 : 8
  return Number(value.toFixed(decimals))
}

/* ---------- motion + layout constants ---------- */
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const DURATION = 180
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
  risk: (<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
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

// A soft mint glow that fades in and out behind a field that was just filled in for the user.
// `pulse` changes every time the field is filled, which restarts the animation.
function Flash({ pulse, children }) {
  return (
    <div className="relative">
      {pulse ? <span key={pulse} aria-hidden="true" className="tc-soft-flash pointer-events-none absolute inset-0 rounded-lg" /> : null}
      {children}
    </div>
  )
}

//---------------------Main Form-------------
function TradeForm({ journalName, currency = DEFAULT_CURRENCY, templateFields = [], initialTrade = null, initialDate = null, onSubmit, onClose, onUploadImage, respectReducedMotion = false }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH)
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [picked, setPicked] = useState(null) // suggestion chosen from the asset-name dropdown
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [flashed, setFlashed] = useState({}) // fields that were just auto-filled
  const [reduceMotion] = useState(() => respectReducedMotion && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const editorRef = useRef(null) // the TiptapEditor (text, screenshots, dictation all live inside it)
  const isSavingRef = useRef(false) // blocks a second submit (e.g. Enter key) while saving
  const isResizingRef = useRef(false)
  const closeTimerRef = useRef(null)
  const formRef = useRef(null)
  const overlayRef = useRef(null)
  const addMenuRef = useRef(null)
  const pendingFocusKeyRef = useRef(null)
  const symbolInputRef = useRef(null)
  const isNewTradeRef = useRef(!initialTrade) // decided once: a new trade opens with the cursor in the asset name
  const entryManualRef = useRef(Boolean(initialTrade)) // true once the user typed the entry price themselves
  const filledForRef = useRef(null) // instrument whose live price is currently auto-filled into entry
  const qtyManualRef = useRef(Boolean(initialTrade)) // true once the user typed the quantity themselves
  const qtyFromMemoryRef = useRef(false) // quantity currently comes from the remembered one for this symbol
  const flashTimerRef = useRef(null)
  const stopManualRef = useRef(Boolean(initialTrade)) // true once the user typed the stop loss themselves
  const autoStopRef = useRef(null) // { price, distance } the automatic stop loss is based on
  const templateRef = useRef(templateFields) // fields of the latest trade, read once when the form opens
  const { register, handleSubmit, setValue, getValues, reset, watch, control, formState: { errors } } = useForm({ defaultValues: getDefaultValues() })
  const { fields: customFields, append: appendCustomField, remove: removeCustomField } = useFieldArray({ control, name: 'customFields' })

  const duration = reduceMotion ? 0 : DURATION
  // slide-in starts before the first paint (no 2-frame wait, no extra render of this big form); see useDrawerMotion
  const { slideOut } = useDrawerMotion({ overlayRef, panelRef: formRef, duration })
  const live = watch()
  const direction = live.direction
  const draftPnl = getTradePnl(live)
  const draftR = getTradeR(live)
  const draftRisk = (() => {
    const entry = Number(live.entry)
    const stop = Number(live.stopLoss)
    const quantity = Number(live.quantity)
    return entry > 0 && stop > 0 && quantity > 0 && entry !== stop ? Math.abs(entry - stop) * quantity : null
  })()
  const isDraftClosed = String(live.exit ?? '').trim() !== ''

  // live price: new trades follow today's market; an open trade being reviewed only gets the exit shortcut
  const prefer = currency === 'INR' ? 'IN' : 'GLOBAL'
  const typedSymbol = String(live.symbol ?? '').trim().toUpperCase()
  const pickedMatches = picked !== null && picked.display.toUpperCase() === typedSymbol
  const priceEnabled = initialTrade ? !isDraftClosed : true
  const { quote, status: priceStatus } = useLivePrice({
    symbol: pickedMatches ? picked.symbol : typedSymbol,
    exact: pickedMatches && picked.exact,
    prefer,
    enabled: priceEnabled
  })
  const suggestions = useSymbolSearch({ query: typedSymbol, enabled: searchOpen && !pickedMatches, prefer })
  const suggestionsOpen = searchOpen && suggestions.length > 0

  useEffect(() => {
    const formValues = initialTrade
      ? {
          ...getDefaultValues(),
          ...initialTrade,
          quantity: initialTrade.quantity ?? initialTrade.qty ?? '',
          direction: initialTrade.direction ?? initialTrade.side ?? 'Long',
          customFields: (initialTrade.customFields ?? []).map(toFormField)
        }
      : { ...getDefaultValues(), ...(initialDate ? { date: initialDate } : {}), customFields: templateRef.current.map(toFormField) }

    entryManualRef.current = Boolean(initialTrade)
    filledForRef.current = null
    stopManualRef.current = Boolean(initialTrade)
    qtyManualRef.current = Boolean(initialTrade)
    qtyFromMemoryRef.current = false
    autoStopRef.current = null
    reset(formValues)
  }, [initialTrade, initialDate, reset])

  const flash = (...names) => {
    setFlashed((previous) => ({ ...previous, ...Object.fromEntries(names.map((name) => [name, (previous[name] ?? 0) + 1])) }))
    clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashed({}), 1700)
  }

  // Stop loss a few points away from the price, below it for a Long and above it for a Short
  const applyAutoStop = (directionValue) => {
    const base = autoStopRef.current
    if (!base || stopManualRef.current) return
    const stop = directionValue === 'Short' ? base.price + base.distance : base.price - base.distance
    if (stop > 0) setValue('stopLoss', String(roundToTick(base.price, stop)), { shouldDirty: true, shouldValidate: true })
  }

  // New trade: the first live price for a symbol fills the entry price and a matching stop loss (once, so they
  // don't drift while you write). Nothing the user typed is ever overwritten.
  useEffect(() => {
    if (initialTrade || !quote || entryManualRef.current || filledForRef.current === quote.symbol) return
    filledForRef.current = quote.symbol
    setValue('entry', String(quote.price), { shouldDirty: true, shouldValidate: true })
    autoStopRef.current = quote.stopDistance ? { price: quote.price, distance: quote.stopDistance } : null
    applyAutoStop(getValues('direction'))
    flash('entry', autoStopRef.current ? 'stopLoss' : 'entry')
  }, [quote, initialTrade, setValue, getValues]) // eslint-disable-line react-hooks/exhaustive-deps

  // Long <-> Short flips the automatic stop loss to the other side of the price
  useEffect(() => {
    applyAutoStop(direction)
  }, [direction]) // eslint-disable-line react-hooks/exhaustive-deps

  // the symbol changed: prices we filled in for the old one no longer apply
  useEffect(() => {
    if (!filledForRef.current || entryManualRef.current) return
    filledForRef.current = null
    setValue('entry', '')
    if (autoStopRef.current && !stopManualRef.current) setValue('stopLoss', '')
    autoStopRef.current = null
  }, [typedSymbol, setValue])

  // Risk amount + entry + stop loss -> quantity (until the user types a quantity of their own)
  const riskValue = live.risk
  const entryValue = live.entry
  const stopValue = live.stopLoss
  useEffect(() => {
    if (qtyManualRef.current) return
    const size = sizeFromRisk(riskValue, entryValue, stopValue)
    if (size === null) return
    qtyFromMemoryRef.current = false
    setValue('quantity', String(size), { shouldDirty: true, shouldValidate: true })
  }, [riskValue, entryValue, stopValue, setValue])

  // Quantity you used last time for this symbol
  useEffect(() => {
    if (initialTrade || qtyManualRef.current) return
    const remembered = readQuantityMemory()[typedSymbol]
    if (remembered && !(Number(getValues('risk')) > 0)) {
      qtyFromMemoryRef.current = true
      setValue('quantity', String(remembered), { shouldDirty: true, shouldValidate: true })
      flash('quantity')
    } else if (!remembered && qtyFromMemoryRef.current) {
      qtyFromMemoryRef.current = false
      setValue('quantity', '')
    }
  }, [typedSymbol, initialTrade, setValue, getValues])

  const focusQuantity = () => document.getElementById('trade-quantity')?.focus()

  const pickSuggestion = (item) => {
    setPicked({ display: item.display, symbol: item.symbol, exact: Boolean(item.exact) })
    setValue('symbol', item.display, { shouldDirty: true, shouldValidate: true })
    setSearchOpen(false)
    setActiveSuggestion(-1)
    focusQuantity() // entry fills itself, so the next thing to type is the quantity
  }

  const handleSymbolKeyDown = (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey) return // Ctrl/Cmd+Enter still saves the form
    if (event.key === 'ArrowDown' && suggestionsOpen) {
      event.preventDefault()
      setActiveSuggestion((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestionsOpen) {
      event.preventDefault()
      setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault() // Enter moves on instead of submitting a half-filled form
      const item = suggestionsOpen ? suggestions[activeSuggestion] : undefined
      if (item) {
        pickSuggestion(item)
      } else {
        setSearchOpen(false)
        focusQuantity()
      }
    } else if (event.key === 'Escape' && suggestionsOpen) {
      event.preventDefault() // closes the list only, not the whole form
      setSearchOpen(false)
    }
  }

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

  useEffect(() => () => {
    clearTimeout(closeTimerRef.current)
    clearTimeout(flashTimerRef.current)
  }, [])

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
    slideOut()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onClose?.()
    }, duration)
  }

  // Take focus off whatever opened this form (the trade card you clicked). If it stays focused underneath, pressing
  // Esc to close turns the browser's keyboard-focus ring on for it, and the card keeps its highlighted border.
  useEffect(() => {
    const form = formRef.current
    if (isNewTradeRef.current && symbolInputRef.current) {
      symbolInputRef.current.focus({ preventScroll: true }) // a new trade starts with the cursor in the asset name
    } else if (form && !form.contains(document.activeElement)) {
      form.focus({ preventScroll: true })
    }
  }, [])

  // Esc closes the form, Ctrl/Cmd + Enter saves it (both are off while it is already saving)
  useFormShortcuts({ formRef, onEscape: requestClose, canClose: !isSaving, canSubmit: !isSaving })

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

    setSubmitError('')
    setIsSaving(true)
    try {
      // text + screenshots as they are right now (local previews included). `draft.prepare()` finishes the uploads later.
      const draft = await editorRef.current.getDraft()

      const cleanCustomFields = (values.customFields ?? []).map((field) => ({
        key: field.key,
        type: field.type,
        label: String(field.label ?? '').trim() || (FIELD_TYPES[field.type] ?? FIELD_TYPES.text).label,
        value: field.type === 'checkbox' ? Boolean(field.value) : field.value ?? ''
      }))

      const payload = {
        ...values,
        risk: undefined, // sizing helper only
        analysis: draft.html,
        images: draft.images,
        removedImages: draft.removedImages,
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
        date: values.date || todayKey()
      }

      // Runs in the background before the trade is sent: waits for screenshots that were still uploading and
      // swaps their local previews for hosted URLs. Safe to run again on "Retry" (finished uploads are reused,
      // failed ones are uploaded again from the original file).
      const prepare = async () => {
        const finished = await draft.prepare()
        return { ...payload, analysis: finished.html, images: finished.images, removedImages: finished.removedImages }
      }

      if (normalizedSymbol && Number(normalizedQuantity) > 0) rememberQuantity(normalizedSymbol, normalizedQuantity)

      editorRef.current.markSubmitted() // the card may show a local preview until the hosted copy replaces it
      Promise.resolve(onSubmit(payload, { prepare })).catch(() => {}) // failures are shown on the trade card
      requestClose()
    } catch (error) {
      setSubmitError(error.message || 'Could not save this trade. Please try again.')
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  const symbolField = register('symbol', {
    required: 'Asset name is required',
    onChange: () => {
      setPicked(null)
      setSearchOpen(true)
      setActiveSuggestion(-1)
    }
  })

  const grow = `width ${duration}ms ${EASE}`

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/30 p-2 backdrop-blur-[2px] md:p-3"
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
          // no width easing while the user drags the edge, otherwise it feels laggy
          transition: isDragging ? 'none' : grow
        }}
        className="relative flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <style>{`
          @keyframes tc-soft-flash { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 } }
          .tc-soft-flash { background: rgb(52 211 153 / 0.12); box-shadow: inset 0 0 0 1px rgb(52 211 153 / 0.3); animation: tc-soft-flash 1500ms cubic-bezier(0.4, 0, 0.2, 1) both }
          @media (prefers-reduced-motion: reduce) { .tc-soft-flash { animation: none; opacity: 0 } }
        `}</style>
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
            <div className="flex items-start gap-4">
              <div className="relative min-w-0 flex-1">
                <input
                  {...symbolField}
                  ref={(element) => {
                    symbolField.ref(element)
                    symbolInputRef.current = element
                  }}
                  onBlur={(event) => {
                    symbolField.onBlur(event)
                    setSearchOpen(false)
                  }}
                  onKeyDown={handleSymbolKeyDown}
                  role="combobox"
                  aria-label="Asset name"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen}
                  aria-controls="trade-symbol-options"
                  aria-activedescendant={suggestionsOpen && activeSuggestion >= 0 ? `trade-symbol-options-${activeSuggestion}` : undefined}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="e.g. RELIANCE or EURUSD"
                  className="w-full rounded-md bg-transparent text-2xl font-semibold uppercase leading-tight tracking-tight text-zinc-900 outline-none placeholder:font-semibold placeholder:normal-case placeholder:text-zinc-500 sm:text-3xl sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-400"
                />
                {suggestionsOpen && (
                  <SymbolSuggestions id="trade-symbol-options" items={suggestions} activeIndex={activeSuggestion} onPick={pickSuggestion} />
                )}
              </div>
              <div className="w-[9.5rem] shrink-0 pt-1 sm:pt-2">
                <label htmlFor="trade-date" className="sr-only">Trade date</label>
                <input id="trade-date" type="date" {...register('date')} className={dateInputClass} />
              </div>
            </div>
            {errors.symbol && <p className="mt-1 text-xs text-rose-500">{errors.symbol.message}</p>}

            {/* live status: Closed / P&L / R share one badge shape, h-6 with gap-2, and wrap as whole chips */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
              {/* small Long / Short switch: the stop loss follows it */}
              <div role="radiogroup" aria-label="Direction" className="inline-flex items-center gap-0.5">
                {directionOptions.map(({ value, icon, tone }) => (
                  <label key={value} className="cursor-pointer">
                    <input type="radio" value={value} {...register('direction')} className="peer sr-only" />
                    <span
                      className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-400/50 ${
                        direction === value
                          ? tone
                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100'
                      }`}
                    >
                      <Icon name={icon} size={12} />
                      {value}
                    </span>
                  </label>
                ))}
              </div>

            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="inline-flex items-center gap-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
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
              {draftRisk !== null && (
                <span className={`${badgeBase} ${badgeTone.neutral}`}>
                  Risk {formatMoney(draftRisk, { currency })}
                </span>
              )}
            </div>
            </div>

            {/* properties: two columns when the drawer is wide enough */}
            <div className="@container mt-6">
              <div className="grid gap-x-12 gap-y-1 @2xl:grid-cols-2">
                <PropertyRow icon="entry" label="Entry price" htmlFor="trade-entry" error={errors.entry?.message}>
                  <Flash pulse={flashed.entry}>
                  <input
                    id="trade-entry"
                    type="number"
                    min="0"
                    step="any"
                    {...register('entry', {
                      required: 'Entry price is required',
                      onChange: () => { entryManualRef.current = true } // typed by hand: stop auto-filling
                    })}
                    placeholder={priceEnabled && !initialTrade && priceStatus === 'loading' ? 'Fetching price…' : '0.00'}
                    className={numberInputClass}
                  />
                  </Flash>
                </PropertyRow>

                <PropertyRow icon="shield" label="Stop loss" hint="optional" htmlFor="trade-stop-loss" error={errors.stopLoss?.message}>
                  <Flash pulse={flashed.stopLoss}>
                  <input
                    id="trade-stop-loss"
                    type="number"
                    min="0"
                    step="any"
                    {...register('stopLoss', {
                      onChange: () => { stopManualRef.current = true }, // typed by hand: stop auto-filling
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
                  </Flash>
                </PropertyRow>

                <PropertyRow icon="risk" label="Risk" hint="optional" htmlFor="trade-risk">
                  <input
                    id="trade-risk"
                    type="number"
                    min="0"
                    step="any"
                    {...register('risk', { onChange: () => { qtyManualRef.current = false } })} // a new risk amount re-sizes the quantity
                    placeholder="Sizes the quantity"
                    className={numberInputClass}
                  />
                </PropertyRow>

                <PropertyRow icon="hash" label="Quantity" htmlFor="trade-quantity" error={errors.quantity?.message}>
                  <Flash pulse={flashed.quantity}>
                    <input
                      id="trade-quantity"
                      type="number"
                      min="0"
                      step="any"
                      {...register('quantity', {
                        required: 'Quantity is required',
                        onChange: () => { qtyManualRef.current = true } // typed by hand: stop auto-filling
                      })}
                      placeholder="0.00"
                      className={numberInputClass}
                    />
                  </Flash>
                </PropertyRow>

                <PropertyRow icon="exit" label="Exit price" hint="optional" htmlFor="trade-exit">
                  <Flash pulse={flashed.exit}>
                    <input id="trade-exit" type="number" min="0" step="any" {...register('exit')} placeholder="Leave open" className={numberInputClass} />
                  </Flash>
                  {/* soft hint: only while the exit is empty and a stop loss is set */}
                  {Number(stopValue) > 0 && String(live.exit ?? '').trim() === '' && (
                    <button
                      type="button"
                      onClick={() => {
                        setValue('exit', String(stopValue).trim(), { shouldDirty: true, shouldValidate: true })
                        flash('exit')
                      }}
                      title="Use the stop loss price as the exit price"
                      className="mt-1 ml-2 inline-flex cursor-pointer items-center gap-1 rounded text-[11px] text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 motion-safe:animate-[fadeIn_150ms_ease-out] dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      Stopped out?
                      <span className="font-medium tabular-nums text-sky-700 underline decoration-sky-700/30 underline-offset-2 dark:text-sky-300 dark:decoration-sky-300/30">
                        Use {String(stopValue).trim()}
                      </span>
                    </button>
                  )}
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
            <DeferredEditor
              ref={editorRef}
              id="trade-analysis"
              label="Trade analysis"
              initialHtml={initialTrade?.analysis ?? ''}
              placeholder="What did you see? What did you do? What would you change next time?"
              onUploadImage={onUploadImage}
            />
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