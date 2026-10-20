import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarIcon,
  CheckIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CloseIcon,
  FileIcon,
  HashIcon,
  MaximizeIcon,
  MinimizeIcon,
  PlusIcon,
  SlidersIcon,
  TextIcon
} from '../../../utils/Icons.jsx'
import { FIELD_TYPES, MAX_CUSTOM_FIELDS, MAX_STRATEGY_LENGTH, makeFieldKey, toFormField } from '../../../utils/customFields'
import { focusRing } from '../../common/controlStyles'
import { ghostFooterButton, iconButtonClass } from '../../common/formStyles'
import { cleanStrategy, richTextLength, strategyToHtml } from '../../../utils/richText'
import { MOD_LABEL, useFormShortcuts } from '../../../hooks/useFormShortcuts'
import BasicRichTextEditor from '../../common/BasicRichTextEditor'

const TYPE_ICONS = { text: TextIcon, number: HashIcon, date: CalendarIcon, checkbox: CheckSquareIcon }
const TYPE_HINTS = { text: 'Free text', number: 'Numbers, e.g. 1.5', date: 'A calendar day', checkbox: 'Yes or no' }

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All trades', hint: 'Also adds these properties to trades you already logged. Values they already have are kept.' },
  { value: 'future', label: 'New trades only', hint: 'Trades you already logged stay exactly as they are.' }
]
// The "Apply changes to" choice is remembered per journal (in this browser), so reopening the dialog starts from
// what you picked last time. It can be changed again at any time.
const scopeKey = (journalId) => `tradecommit:context-scope:${journalId}`
const readScope = (journalId) => {
  try {
    const saved = window.localStorage.getItem(scopeKey(journalId))
    return SCOPE_OPTIONS.some((option) => option.value === saved) ? saved : 'all'
  } catch {
    return 'all'
  }
}
const rememberScope = (journalId, scope) => {
  try {
    window.localStorage.setItem(scopeKey(journalId), scope)
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
}
// Dialog size (normal / wide) is remembered in this browser too.
const WIDE_KEY = 'tradecommit:context-wide'
const readWide = () => {
  try {
    return window.localStorage.getItem(WIDE_KEY) === '1'
  } catch {
    return false
  }
}
const rememberWide = (isWide) => {
  try {
    window.localStorage.setItem(WIDE_KEY, isWide ? '1' : '0')
  } catch {
    // storage unavailable: the size just isn't remembered
  }
}

/* ---- look & feel: the same neutral surfaces, hairline borders and soft focus as TradeForm / PlanForm ---- */

// primary footer button look, minus its disabled:cursor-wait (that is what showed the loading cursor)
const saveButtonClass =
  'inline-flex h-9 min-w-[116px] items-center justify-center rounded-lg bg-zinc-900 px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-zinc-700 disabled:cursor-default disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white'

// minimal inline cells: no box until hovered or focused, text is clipped with an ellipsis instead of spilling out
const cellClass = [
  'h-8 w-full min-w-0 truncate rounded-md bg-transparent px-2 text-[13px] text-zinc-900',
  'outline-none transition-colors duration-150 placeholder:text-zinc-500',
  'hover:bg-zinc-100 focus:bg-zinc-100',
  'dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]'
].join(' ')
const numberCellClass = `${cellClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
const dateCellClass = `${cellClass} [color-scheme:light] dark:[color-scheme:dark]`

const tileClass =
  'flex shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-zinc-300'

// what gets sent to (and compared with) the server copy
const toPayload = (strategy, attributes) => ({
  strategy: cleanStrategy(strategy),
  attributes: attributes.map((field) => ({
    key: field.key,
    type: field.type,
    label: String(field.label ?? '').trim() || FIELD_TYPES[field.type].label,
    value: field.type === 'checkbox' ? Boolean(field.value) : field.value ?? ''
  }))
})

/** A titled block of the form: small icon tile, title, one line of help, optional aside (a counter) on the right. */
function Section({ Icon, title, titleId, description, aside, children }) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`${tileClass} mt-0.5 h-8 w-8`}>
            <Icon className="h-[15px] w-[15px]" />
          </span>
          <div className="min-w-0">
            <h4 id={titleId} className="text-sm font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-50">{title}</h4>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Thin progress bar + "123/6000" for the strategy length. */
function LengthMeter({ length, max }) {
  const ratio = Math.min(1, length / max)
  const over = length > max
  const near = !over && ratio >= 0.9
  const bar = over ? 'bg-rose-500' : near ? 'bg-amber-500' : 'bg-zinc-400 dark:bg-zinc-500'
  const text = over ? 'font-medium text-rose-700 dark:text-rose-300' : near ? 'text-amber-800 dark:text-amber-300' : 'text-zinc-600 dark:text-zinc-400'

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span aria-hidden="true" className="h-1 w-14 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
        <span className={`block h-full rounded-full transition-all duration-200 ${bar}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className={`text-[11px] tabular-nums ${text}`}>{length}/{max}</span>
    </div>
  )
}

function AttributeRow({ field, autoFocus, onChange, onRemove }) {
  const TypeIcon = TYPE_ICONS[field.type] ?? TextIcon
  const typeLabel = FIELD_TYPES[field.type].label
  const valueLabel = `${field.label || typeLabel} default value`

  return (
    <div className="group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-0.5 py-1 md:grid-cols-[11.5rem_minmax(0,1fr)_1.75rem]">
      <div className="flex min-w-0 items-center gap-1">
        <span className="flex h-8 w-6 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400" title={typeLabel}>
          <TypeIcon className="h-[15px] w-[15px]" />
        </span>
        <input
          value={field.label}
          onChange={(event) => onChange({ label: event.target.value })}
          autoFocus={autoFocus}
          aria-label="Property name"
          placeholder="Name"
          maxLength={40}
          autoComplete="off"
          className={`${cellClass} font-medium text-zinc-700 dark:text-zinc-200`}
        />
      </div>

      <div className="order-3 col-span-2 min-w-0 pl-7 md:order-none md:col-span-1 md:pl-0">
        {field.type === 'checkbox' ? (
          <label className="flex h-8 items-center px-2">
            <input
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={(event) => onChange({ value: event.target.checked })}
              aria-label={valueLabel}
              className="h-4 w-4 cursor-pointer rounded accent-zinc-800 dark:accent-zinc-200"
            />
          </label>
        ) : (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            step={field.type === 'number' ? 'any' : undefined}
            value={field.value ?? ''}
            onChange={(event) => onChange({ value: event.target.value })}
            aria-label={valueLabel}
            autoComplete="off"
            placeholder="No default"
            className={field.type === 'number' ? numberCellClass : field.type === 'date' ? dateCellClass : cellClass}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        title="Remove property"
        aria-label={`Remove ${field.label || typeLabel} property`}
        className="order-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:bg-zinc-100 focus-visible:opacity-100 focus-visible:outline-none md:order-none md:opacity-0 md:group-hover/row:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50 dark:focus-visible:bg-white/10"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** "Add property" button with a small type menu (Text / Number / Date / Checkbox). */
function AddPropertyMenu({ disabled, onAdd }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    // an open menu takes the first Esc (preventDefault tells the dialog's own Esc handler to stand down)
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-50"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add property
        <ChevronDownIcon className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-150 dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Property type"
          className="absolute left-0 top-full z-20 mt-1.5 w-60 rounded-xl border border-zinc-300 bg-white p-1 shadow-xl motion-safe:animate-[fadeIn_120ms_ease-out] dark:border-white/[0.14] dark:bg-panel-hi"
        >
          {Object.entries(FIELD_TYPES).map(([type, config]) => {
            const TypeIcon = TYPE_ICONS[type]
            return (
              <button
                key={type}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onAdd(type)
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-white/[0.07] dark:focus-visible:bg-white/[0.07]"
              >
                <span className={`${tileClass} h-7 w-7`}>
                  <TypeIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{config.label}</span>
                  <span className="block text-[11px] text-zinc-600 dark:text-zinc-400">{TYPE_HINTS[type]}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Modal for the journal's context: a free-text strategy description plus default properties
 * that every new trade form in this journal starts with.
 * `onSave(context, { applyToExisting })` returns a promise; `applyToExisting` says whether the default
 * properties are also added to trades that were logged before.
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function JournalContextDialog({ journalId, journalName, context, mode = "live", onSave, onClose }) {
  // the strategy is rich text: older journals hold plain text, which is turned into paragraphs once, here
  const [initialStrategy] = useState(() => strategyToHtml(context?.strategy))
  const [strategy, setStrategy] = useState(initialStrategy)
  const [strategyLength, setStrategyLength] = useState(() => richTextLength(strategyToHtml(context?.strategy)))
  const [journalMode, setJournalMode] = useState(mode === "backtest" ? "backtest" : "live")
  const [isWide, setIsWide] = useState(readWide)
  const [attributes, setAttributes] = useState(() => (context?.attributes ?? []).map(toFormField))
  const [focusKey, setFocusKey] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState(() => readScope(journalId)) // 'all' = also update existing trades, 'future' = new trades only
  const dialogRef = useRef(null)

  // Take focus off the "Context" button that opened this dialog. Otherwise it stays focused underneath, and
  // pressing Esc turns the browser's keyboard-focus ring on for it, so it keeps glowing after the dialog closes.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  const savedContextPayload = useMemo(() => JSON.stringify(toPayload(strategyToHtml(context?.strategy), (context?.attributes ?? []).map(toFormField))), [context])
  const currentContextPayload = JSON.stringify(toPayload(strategy, attributes))
  const contextDirty = currentContextPayload !== savedContextPayload
  const savedPayload = useMemo(() => JSON.stringify({ ...toPayload(strategyToHtml(context?.strategy), (context?.attributes ?? []).map(toFormField)), mode: mode === "backtest" ? "backtest" : "live" }), [context, mode])
  const isDirty = JSON.stringify({ ...toPayload(strategy, attributes), mode: journalMode }) !== savedPayload
  const isTooLong = strategyLength > MAX_STRATEGY_LENGTH
  const canSave = isDirty && !isSaving && !isTooLong

  // a long strategy is easy to lose with a stray Esc or click outside, so ask first when there are unsaved edits
  const requestClose = () => {
    if (isSaving) return
    if (isDirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  // Esc closes (an open menu takes the first Esc) and Ctrl/Cmd + Enter saves, like the trade and plan forms
  useFormShortcuts({ formRef: dialogRef, onEscape: requestClose, canClose: !isSaving, canSubmit: canSave })

  const handleStrategyChange = useCallback((html, text) => {
    setStrategy(html)
    setStrategyLength(text.length)
  }, [])

  const toggleWide = () => {
    setIsWide((current) => {
      rememberWide(!current)
      return !current
    })
  }

  const addAttribute = (type) => {
    if (attributes.length >= MAX_CUSTOM_FIELDS) return
    const key = makeFieldKey()
    setFocusKey(key)
    setAttributes((current) => [...current, { key, label: FIELD_TYPES[type].label, type, value: FIELD_TYPES[type].empty }])
  }

  const changeAttribute = (key, patch) => {
    setAttributes((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)))
  }

  const removeAttribute = (key) => {
    setAttributes((current) => current.filter((field) => field.key !== key))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSave) return

    setIsSaving(true)
    setError('')
    try {
      await onSave(toPayload(strategy, attributes), { applyToExisting: contextDirty && scope === 'all', mode: journalMode })
      rememberScope(journalId, scope)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof TypeError ? "Can't reach the server. Check your connection and try again." : saveError.message || 'Could not save the context')
      setIsSaving(false)
    }
  }

  const selectedScope = SCOPE_OPTIONS.find((option) => option.value === scope) ?? SCOPE_OPTIONS[0]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Journal context"
        className={`flex w-full flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none transition-[max-width] duration-200 motion-safe:animate-[fadeIn_180ms_ease-out] dark:border-white/[0.14] dark:bg-panel ${
          isWide ? 'h-[92vh] max-w-6xl' : 'max-h-[90vh] max-w-3xl'
        }`}
      >
        {/* header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-white/[0.08]">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`${tileClass} h-10 w-10 rounded-xl`}>
              <SlidersIcon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">Journal context</h3>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                How you trade <span className="font-medium text-zinc-800 dark:text-zinc-200">{journalName}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleWide}
              title={isWide ? 'Smaller window' : 'Bigger window'}
              aria-label={isWide ? 'Make the window smaller' : 'Make the window bigger'}
              aria-pressed={isWide}
              className={`${iconButtonClass} hidden md:flex`}
            >
              {isWide ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={requestClose} disabled={isSaving} aria-label="Close" className={iconButtonClass}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* body */}
        <div
          className={`subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6 ${
            isWide ? 'space-y-8 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-10 lg:space-y-0' : 'space-y-8'
          }`}
        >
          <Section
            Icon={FileIcon}
            title="Strategy"
            titleId="journal-strategy-label"
            description="Entries, risk, stops, hours, what you skip. Saved with the journal and used as background for AI insights."
            aside={
              <div className="flex shrink-0 items-center gap-1.5 self-center">
                <div role="group" aria-label="Journal mode" className="inline-flex items-center rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-0.5 shadow-[0_2px_8px_rgb(59_130_246/0.12)] dark:border-[#60a5fa]/30 dark:bg-[#17263a] dark:shadow-[0_2px_8px_rgb(59_130_246/0.14)]">
                  {[
                    { value: 'live', label: 'Live' },
                    { value: 'backtest', label: 'Backtest' }
                  ].map((option) => {
                    const selected = journalMode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        title={option.value === 'live' ? 'Review real execution and risk management' : 'Review historical or simulated trading data'}
                        onClick={() => setJournalMode(option.value)}
                        className={`h-6 cursor-pointer rounded-md px-2 text-[11px] font-medium transition-all duration-200 ${focusRing} ${
                          selected
                            ? 'bg-gradient-to-br from-[#dbeafe] via-[#cfe4ff] to-[#bfdbfe] text-[#1e4f91] shadow-[0_1px_3px_rgb(37_99_235/0.24),inset_0_0_0_1px_rgb(59_130_246/0.2)] dark:from-[#29466b] dark:via-[#263f60] dark:to-[#213651] dark:text-[#c2dcff] dark:shadow-[0_1px_4px_rgb(0_0_0/0.4),inset_0_0_0_1px_rgb(96_165_250/0.3)]'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            }
          >
            <div className="rounded-xl border border-zinc-300 bg-zinc-50/60 p-2 transition-colors focus-within:border-zinc-400 dark:border-white/[0.14] dark:bg-white/[0.02] dark:focus-within:border-white/30">
              <BasicRichTextEditor
                id="journal-strategy"
                labelledBy="journal-strategy-label"
                initialHtml={initialStrategy}
                onChange={handleStrategyChange}
                editorClassName={`px-2 ${isWide ? 'min-h-[52vh]' : 'min-h-[260px]'}`}
                placeholder="e.g. Intraday breakouts on index futures. I trade the first 90 minutes only, risk 1% per trade and skip high-impact news days."
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className={`text-[11px] ${isTooLong ? 'font-medium text-rose-700 dark:text-rose-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
                {isTooLong ? 'Too long. Shorten it to save.' : 'Tip: use lists to keep each rule easy to check.'}
              </p>
              <LengthMeter length={strategyLength} max={MAX_STRATEGY_LENGTH} />
            </div>
          </Section>

          <Section
            Icon={SlidersIcon}
            title="Default properties"
            description="Added to every new trade in this journal, starting with the values you set here. You can still edit or remove them on any trade."
            aside={
              <span className="mt-0.5 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-300">
                {attributes.length}/{MAX_CUSTOM_FIELDS}
              </span>
            }
          >
            {attributes.length === 0 ? (
              <p className="border-y border-zinc-200/70 py-4 text-xs leading-relaxed text-zinc-600 dark:border-white/[0.06] dark:text-zinc-400">
                No default properties yet. Add the details you note on every trade, like a setup name, risk % or session.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200/70 border-y border-zinc-200/70 dark:divide-white/[0.06] dark:border-white/[0.06]">
                {attributes.map((field) => (
                  <AttributeRow
                    key={field.key}
                    field={field}
                    autoFocus={field.key === focusKey}
                    onChange={(patch) => changeAttribute(field.key, patch)}
                    onRemove={() => removeAttribute(field.key)}
                  />
                ))}
              </div>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <AddPropertyMenu disabled={attributes.length >= MAX_CUSTOM_FIELDS} onAdd={addAttribute} />
              {attributes.length >= MAX_CUSTOM_FIELDS && <span className="text-xs text-zinc-600 dark:text-zinc-400">You have reached the limit.</span>}
            </div>

            {/* which trades the property changes reach */}
            <fieldset className="mt-6 min-w-0">
              <legend className="mb-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">Apply changes to</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {SCOPE_OPTIONS.map((option) => {
                  const selected = scope === option.value
                  return (
                    <label
                      key={option.value}
                      className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors has-[:focus-visible]:border-zinc-900 dark:has-[:focus-visible]:border-zinc-200 ${
                        selected
                          ? 'border-zinc-900 bg-zinc-100/80 dark:border-zinc-200 dark:bg-white/[0.07]'
                          : 'border-zinc-300 hover:bg-zinc-50 dark:border-white/[0.14] dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="context-scope"
                        value={option.value}
                        checked={selected}
                        onChange={() => setScope(option.value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                          selected
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                            : 'border-zinc-400 dark:border-white/30'
                        }`}
                      >
                        {selected && <CheckIcon className="h-3 w-3" />}
                      </span>
                      <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{option.label}</span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{selectedScope.hint}</p>
            </fieldset>
          </Section>
        </div>

        {/* footer */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-6 py-3 dark:border-white/[0.08]">
          <div className="min-w-0 text-xs">
            {error ? (
              <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>
            ) : isDirty ? (
              <p className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>Unsaved changes</span>
                <span className="hidden text-zinc-600 md:inline dark:text-zinc-400">· {MOD_LABEL} + Enter to save</span>
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={requestClose} disabled={isSaving} className={`${ghostFooterButton} disabled:opacity-50`}>Cancel</button>
            <button type="submit" disabled={!canSave} className={saveButtonClass}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </footer>
      </form>
    </div>,
    document.body
  )
}

export default JournalContextDialog
