import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import FormDrawer from '../../common/FormDrawer'
import PropertyRow from '../../common/PropertyRow'
import ShortcutHint from '../../common/ShortcutHint'
import DeferredEditor from '../../common/DeferredEditor'
import QuickPlanFields from './QuickPlanFields'
import WeeklyPlanForm from './WeeklyPlanForm'
import { dateInputClass, ghostFooterButton, primaryFooterButton } from '../../common/formStyles'
import { CalendarIcon } from '../../../utils/Icons.jsx'
import { formatLongDate, fromDateKey, todayKey } from '../../../utils/calendar'
import { MOD_LABEL } from '../../../hooks/useFormShortcuts'
import { useDeepFocus } from '../../../context/useDeepFocus'
import { clearFormDraft, readFormDraft, writeFormDraft } from '../../../utils/formDraftStorage'
import { EMPTY_QUICK, MAX_TITLE, buildQuickPlanHtml, deriveTitle, hasQuickContent, htmlHasText, sanitizeQuick } from '../../../utils/quickPlan'
import { BLANK_TEMPLATE_ID, getTemplate } from '../../../utils/quickPlanTemplates'
import { PLANNER_WALKTHROUGH_INTERACTION_EVENT } from '../../../utils/plannerWalkthrough'

// Which writing mode a NEW plan opens in. Remembered per browser; editing an existing plan always uses the full editor.
const MODE_PREF_KEY = 'tradecommit:plan-form-mode'
const isMode = (value) => value === 'quick' || value === 'full'
const readModePreference = () => {
  const saved = readFormDraft(MODE_PREF_KEY)
  return isMode(saved?.mode) ? saved.mode : 'quick'
}
const shortDateLabel = (key) => {
  try {
    return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

const modeButton = (active) => `inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:bg-white/[0.08] ${active ? 'bg-zinc-100 text-cyan-800 dark:bg-white/[0.08] dark:text-cyan-300' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`

const deepModeStyles = `
.deep-mode-scroll { background: radial-gradient(ellipse at 50% 0%, rgba(195, 204, 185, .12), transparent 58%); }
.dark .deep-mode-scroll { background: radial-gradient(ellipse at 50% 0%, rgba(130, 150, 120, .07), transparent 58%); }
.deep-mode-scroll[data-focus-theme="ocean"] { background: radial-gradient(ellipse at 50% 0%, rgba(96, 165, 250, .10), transparent 58%); }
.dark .deep-mode-scroll[data-focus-theme="ocean"] { background: radial-gradient(ellipse at 50% 0%, rgba(56, 135, 190, .10), transparent 58%); }
.deep-mode-scroll[data-focus-theme="amber"] { background: radial-gradient(ellipse at 50% 0%, rgba(217, 153, 85, .10), transparent 58%); }
.dark .deep-mode-scroll[data-focus-theme="amber"] { background: radial-gradient(ellipse at 50% 0%, rgba(190, 130, 65, .09), transparent 58%); }
.deep-focus-waves { height: 68px; opacity: .68; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.deep-focus-waves svg { width: 100%; height: 100%; overflow: visible; }
.deep-focus-waves path { fill: none; stroke: #8b9b83; stroke-width: .8; opacity: .32; animation: deep-wave-drift 12s ease-in-out infinite alternate; }
.deep-focus-waves path:nth-child(2n) { stroke: #b7a994; animation-duration: 16s; animation-direction: alternate-reverse; }
.deep-focus-waves path:nth-child(3n) { animation-duration: 20s; opacity: .2; }
.dark .deep-focus-waves path { stroke: #9cac91; opacity: .24; }
.deep-mode-scroll[data-focus-theme="ocean"] .deep-focus-waves path { stroke: #5797bb; }
.dark .deep-mode-scroll[data-focus-theme="ocean"] .deep-focus-waves path { stroke: #78b9d8; }
.deep-mode-scroll[data-focus-theme="amber"] .deep-focus-waves path { stroke: #b98752; }
.dark .deep-mode-scroll[data-focus-theme="amber"] .deep-focus-waves path { stroke: #d3a66e; }
.deep-focus-breathe { animation: deep-breathe 4s ease-in-out infinite; }
@keyframes deep-wave-drift { from { transform: translateY(-3px) scaleY(.88); } to { transform: translateY(4px) scaleY(1.08); } }
@keyframes deep-breathe { 0%,100% { opacity: .55; box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { opacity: 1; box-shadow: 0 0 0 4px rgba(16,185,129,.08); } }
@media (prefers-reduced-motion: reduce) { .deep-focus-waves path, .deep-focus-breathe { animation: none !important; } }
`


/**
 * Drawer form to write (or review) the plan for one calendar day.
 * Same layout as TradeForm: big title header, property rows, rich text body with screenshots.
 *
 * A NEW plan opens in Quick Plan mode (a few optional guided fields) and can expand into the full editor at any time.
 * Quick fields are written into the plan's rich-text `content`, so the stored shape is the same in both modes.
 * Editing an existing plan always uses the full editor, exactly as before.
 *
 * @param {string}   plannerName
 * @param {string}   plannerType
 * @param {object}   [initialEntry]  existing plan when editing
 * @param {string}   [initialDate]   date key preselected for a new plan
 * @param {Function} onSubmit        async ({ title, date, content, images }) => void
 * @param {Function} [onDelete]      async () => void   (editing only)
 * @param {Function} onClose
 * @param {Function} onUploadImage   (file) => Promise<url>
 * @param {object}   [carryForward]  { rule, planLine, checkpoint } the linked journal's latest mentor review asked the trader to apply
 */
function DailyPlanForm({ plannerName, plannerType, initialEntry = null, initialDate, draftKey, onSubmit, onDelete, onClose, onUploadImage, carryForward = null, guideOverlayActive = false, readOnly = false }) {
  const defaultDate = initialEntry?.date ?? initialDate ?? todayKey()
  const [savedDraft] = useState(() => readFormDraft(draftKey))
  const savedValues = savedDraft?.values && typeof savedDraft.values === 'object' ? savedDraft.values : {}
  const initialContent = typeof savedDraft?.content === 'string' ? savedDraft.content : initialEntry?.content ?? ''
  // Existing plans, and drafts saved before Quick Plan existed (no `mode`), keep the full editor so nothing is hidden.
  const [initialMode] = useState(() => (initialEntry ? 'full' : savedDraft ? (isMode(savedDraft.mode) ? savedDraft.mode : 'full') : readModePreference()))
  const { register, handleSubmit, watch, subscribe, formState: { errors } } = useForm({
    defaultValues: {
      title: typeof savedValues.title === 'string' ? savedValues.title : initialEntry?.title ?? '',
      date: typeof savedValues.date === 'string' ? savedValues.date : defaultDate
    }
  })
  const drawerRef = useRef(null)
  const editorRef = useRef(null)
  const editorDraftRef = useRef(initialContent)
  const latestFormValuesRef = useRef({
    title: typeof savedValues.title === 'string' ? savedValues.title : initialEntry?.title ?? '',
    date: typeof savedValues.date === 'string' ? savedValues.date : defaultDate
  })
  const draftClosedRef = useRef(false)
  const [initialQuick] = useState(() => sanitizeQuick(savedDraft?.quick))
  const [initialTemplate] = useState(() => (typeof savedDraft?.template === 'string' ? getTemplate(savedDraft.template).id : BLANK_TEMPLATE_ID))
  const modeRef = useRef(initialMode)
  const quickRef = useRef(initialQuick)
  const templateRef = useRef(initialTemplate)
  const contentTouchedRef = useRef(Boolean(savedDraft)) // true once there is editor text the user wrote (or restored)
  const discardConfirmedRef = useRef(false)
  const confirmDiscardRef = useRef(false)
  const [mode, setMode] = useState(initialMode)
  const [quick, setQuick] = useState(initialQuick)
  const [templateId, setTemplateId] = useState(initialTemplate)
  const [seedHtml, setSeedHtml] = useState(initialContent) // what the full editor starts with when it (re)mounts
  const [fullHasText, setFullHasText] = useState(() => htmlHasText(initialContent))
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false)
  const [showRestored, setShowRestored] = useState(Boolean(savedDraft))
  const [submitError, setSubmitError] = useState('')
  const { isEnabled: deepMode, preferences, setPlannerHeaderHost } = useDeepFocus()
  const isQuick = mode === 'quick' && !initialEntry

  // one place that writes the draft, so Quick fields, editor text, title and date are always saved together
  const persistDraft = useCallback((values = latestFormValuesRef.current) => {
    if (draftClosedRef.current) return
    writeFormDraft(draftKey, {
      values: {
        title: typeof values.title === 'string' ? values.title : '',
        date: typeof values.date === 'string' ? values.date : defaultDate
      },
      content: editorDraftRef.current,
      mode: modeRef.current,
      quick: quickRef.current,
      template: templateRef.current
    })
  }, [defaultDate, draftKey])

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [])

  useEffect(() => {
    let saveTimer
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        latestFormValuesRef.current = values
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => persistDraft(values), 200)
      }
    })
    const flushDraft = () => persistDraft(latestFormValuesRef.current)
    window.addEventListener('pagehide', flushDraft)
    return () => {
      clearTimeout(saveTimer)
      unsubscribe()
      window.removeEventListener('pagehide', flushDraft)
    }
  }, [persistDraft, subscribe])

  const handleQuickChange = (next) => {
    quickRef.current = next
    setQuick(next)
    persistDraft()
  }

  const handleTemplateChange = (id) => {
    templateRef.current = id
    setTemplateId(id)
    persistDraft()
  }

  const rememberMode = (next) => writeFormDraft(MODE_PREF_KEY, { mode: next })

  // Quick -> full editor: what was typed becomes formatted text at the top of the editor, then the fields reset
  const openFullEditor = () => {
    window.dispatchEvent(new CustomEvent(PLANNER_WALKTHROUGH_INTERACTION_EVENT, { detail: { step: 'full-editor' } }))
    if (modeRef.current === 'full') return // already there: re-seeding would reset the live editor
    const compiled = buildQuickPlanHtml(quickRef.current)
    const seed = `${compiled}${editorDraftRef.current}`
    editorDraftRef.current = seed
    if (compiled) contentTouchedRef.current = true
    quickRef.current = EMPTY_QUICK
    modeRef.current = 'full'
    setQuick(EMPTY_QUICK)
    setSeedHtml(seed)
    setFullHasText(htmlHasText(seed))
    setMode('full')
    rememberMode('full')
    persistDraft()
  }

  // full editor -> Quick: only while the editor is empty, because free-form text can't be shown as fields
  const openQuickPlan = () => {
    window.dispatchEvent(new CustomEvent(PLANNER_WALKTHROUGH_INTERACTION_EVENT, { detail: { step: 'quick-plan' } }))
    if (modeRef.current === 'quick') return
    if (htmlHasText(editorDraftRef.current)) return
    editorDraftRef.current = ''
    modeRef.current = 'quick'
    setSeedHtml('')
    setMode('quick')
    rememberMode('quick')
    persistDraft()
  }

  // Esc, the X button and Cancel all come through here: ask before throwing away unsaved text
  const isDirty = () => {
    const values = latestFormValuesRef.current
    return (values.title ?? '') !== (initialEntry?.title ?? '') ||
      (values.date ?? defaultDate) !== defaultDate ||
      contentTouchedRef.current ||
      hasQuickContent(quickRef.current)
  }

  const guardClose = () => {
    if (discardConfirmedRef.current || draftClosedRef.current) return true
    if (confirmDiscardRef.current) { // asked already: Esc / X again means "keep editing"
      confirmDiscardRef.current = false
      setIsConfirmingDiscard(false)
      return false
    }
    if (!isDirty()) return true
    confirmDiscardRef.current = true
    setIsConfirmingDelete(false)
    setIsConfirmingDiscard(true)
    return false
  }

  const keepEditing = () => {
    confirmDiscardRef.current = false
    setIsConfirmingDiscard(false)
  }

  const discardAndClose = () => {
    discardConfirmedRef.current = true
    drawerRef.current?.close()
  }

  const handleClose = () => {
    draftClosedRef.current = true
    clearFormDraft(draftKey)
    onClose()
  }

  const date = watch('date')
  const isBusy = isSaving
  const autoTitle = deriveTitle({ setup: isQuick ? quick.setup : '', bias: isQuick ? quick.bias : '', dateLabel: shortDateLabel(date || defaultDate) })

  const handleFormSubmit = async (values) => {
    setSubmitError('')
    setIsSaving(true)
    try {
      const typedTitle = values.title.trim()
      const dateKey = values.date || todayKey()
      let payload
      let prepare
      if (isQuick) {
        // no editor is mounted in Quick mode: the fields are the content, and there are no screenshots to upload
        const content = buildQuickPlanHtml(quickRef.current)
        if (!typedTitle && !content) throw new Error('Add a title or fill in at least one field to save this plan.')
        payload = { title: typedTitle || deriveTitle({ setup: quickRef.current.setup, bias: quickRef.current.bias, dateLabel: shortDateLabel(dateKey) }), date: dateKey, content, images: [], removedImages: [] }
      } else {
        const draft = await editorRef.current.getDraft()
        // a new plan needs a title or some text; with only text, the title is filled in so the backend's required title is met
        if (!initialEntry && !typedTitle && !htmlHasText(draft.html)) throw new Error('Add a title or write a few notes to save this plan.')
        payload = { title: typedTitle || deriveTitle({ dateLabel: shortDateLabel(dateKey) }), date: dateKey, content: draft.html, images: draft.images, removedImages: draft.removedImages }
        prepare = draft.prepare
      }
      await onSubmit(payload, prepare)
      draftClosedRef.current = true
      editorRef.current?.markSubmitted()
      clearFormDraft(draftKey)
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not save this plan. Please try again.')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setSubmitError('')
    setIsSaving(true)
    try {
      await onDelete()
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not delete this plan. Please try again.')
      setIsSaving(false)
    }
  }

  const breadcrumb = (
    <>
      {plannerName}
      <span className="mx-1.5 opacity-60">/</span>
      {initialEntry ? 'Plan' : 'New plan'}
    </>
  )

  const footer = (
    <>
      <div className="flex items-center gap-2">
        {isConfirmingDiscard && (
          <>
            <span role="alert" className="text-[13px] text-zinc-600 dark:text-zinc-300">Discard this unsaved plan?</span>
            <button type="button" onClick={keepEditing} className={ghostFooterButton}>Keep editing</button>
            <button type="button" onClick={discardAndClose} className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300">Discard</button>
          </>
        )}
        {onDelete && !isConfirmingDelete && !isConfirmingDiscard && (
          <button type="button" onClick={() => setIsConfirmingDelete(true)} disabled={isBusy} className="h-9 rounded-lg px-3 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-300">
            Delete
          </button>
        )}
        {onDelete && isConfirmingDelete && (
          <>
            <span role={isSaving ? 'status' : undefined} aria-live="polite" className="text-[13px] text-zinc-600 dark:text-zinc-300">
              {isSaving ? 'Deleting plan...' : 'Delete this plan?'}
            </span>
            <button type="button" onClick={() => setIsConfirmingDelete(false)} disabled={isSaving} className={ghostFooterButton}>Keep</button>
            <button type="button" onClick={handleDelete} disabled={isSaving} className="inline-flex h-9 min-w-[100px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-rose-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-default disabled:opacity-70 dark:bg-rose-500 dark:hover:bg-rose-600">
              {isSaving && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />}
              {isSaving ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
        {submitError && !isConfirmingDiscard && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">{submitError}</p>}
      </div>

      <div className="flex items-center gap-2">
        <ShortcutHint className="mr-2 hidden md:block" />
        <button type="button" onClick={() => drawerRef.current?.close()} className={ghostFooterButton}>Cancel</button>
        <button type="submit" disabled={isBusy || readOnly} title={readOnly ? 'Read-only on Free. Upgrade to edit' : `Save (${MOD_LABEL}+Enter)`} className={primaryFooterButton}>
          {isBusy ? 'Saving...' : initialEntry ? 'Save plan' : 'Create plan'}
        </button>
      </div>
    </>
  )

  return (
    <>
    <style>{deepModeStyles}</style>
    <FormDrawer
      ref={drawerRef}
      ariaTitle={`${initialEntry ? 'Edit plan in' : 'New plan in'} ${plannerName}`}
      breadcrumb={breadcrumb}
      deepMode={deepMode}
      deepTheme={preferences.focusTheme}
      headerExtra={<div ref={setPlannerHeaderHost} className="flex items-center gap-1" />}
      onSubmit={handleSubmit(handleFormSubmit)}
      onClose={handleClose}
      footer={footer}
      canClose={!isBusy}
      canSubmit={!isBusy && !readOnly}
      onBeforeClose={guardClose}
      guideOverlayActive={guideOverlayActive}
    >
      {deepMode && (
        <section className="deep-focus-intro mb-8 overflow-hidden rounded-2xl border border-stone-200/80 bg-white/55 px-5 pb-4 pt-3 shadow-[0_12px_45px_rgba(73,81,67,0.035)] dark:border-white/[0.08] dark:bg-white/[0.025] sm:px-8" aria-label="Deep focus atmosphere">
          <div className="deep-focus-waves" aria-hidden="true">
            <svg viewBox="0 0 900 92" preserveAspectRatio="none">
              {Array.from({ length: 9 }, (_, index) => <path key={index} d={`M0 ${42 + index * 1.8} C 130 ${8 + index * 4}, 210 ${78 - index * 2}, 340 ${40 + index * 1.3} S 580 ${12 + index * 3}, 700 ${43 + index * 1.4} S 820 ${66 - index * 2}, 900 ${35 + index * 2}`} />)}
            </svg>
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">A quieter workspace</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">Slow down. Think clearly. Plan with intention.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 px-3 py-1.5 text-[11px] text-stone-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-400"><span className="deep-focus-breathe h-1.5 w-1.5 rounded-full bg-emerald-500" /> Focus space</span>
          </div>
        </section>
      )}

      {/* header = plan title */}
      <input
        {...register('title', { validate: (value) => !!initialEntry && value.trim() === '' ? 'Give this plan a title' : true })}
        aria-label="Plan title"
        autoComplete="off"
        maxLength={MAX_TITLE}
        placeholder={initialEntry ? 'e.g. Nifty breakout plan' : isQuick ? `Title (optional) \u00b7 ${autoTitle}` : 'e.g. Nifty breakout plan'}
        className="w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-900 outline-none placeholder:font-bold placeholder:text-zinc-300 sm:text-4xl sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-700"
      /> 
      {errors.title && <p className="mt-1 text-xs text-rose-500">{errors.title.message}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
          {plannerType}
        </span>
        {date && (
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {formatLongDate(date)}
          </span>
        )}
        {!initialEntry && (
          <div role="group" aria-label="Writing mode" className="ml-auto inline-flex items-center rounded-lg border border-zinc-200 p-0.5 dark:border-white/[0.10]">
            <button type="button" data-tour="planner-quick-plan" aria-pressed={isQuick} onClick={openQuickPlan} disabled={!isQuick && fullHasText} title={!isQuick && fullHasText ? 'Clear the editor to switch back to Quick plan' : undefined} className={modeButton(isQuick)}>Quick plan</button>
            <button type="button" data-tour="planner-full-editor" aria-pressed={!isQuick} onClick={openFullEditor} className={modeButton(!isQuick)}>Full editor</button>
          </div>
        )}
      </div>
      {showRestored && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
          Restored your unsaved draft.
          <button type="button" onClick={() => setShowRestored(false)} className="font-medium text-zinc-600 hover:text-zinc-900 hover:underline focus:outline-none focus-visible:underline dark:text-zinc-300 dark:hover:text-zinc-100">Dismiss</button>
        </p>
      )}

      <div className="mt-6">
        <PropertyRow Icon={CalendarIcon} label="Date" htmlFor="plan-date" error={errors.date?.message}>
          <input id="plan-date" type="date" {...register('date', { required: 'Pick a date' })} className={dateInputClass} />
        </PropertyRow>
      </div>

      <hr className="my-6 border-zinc-300 dark:border-white/[0.12]" />

      {carryForward?.rule && !initialEntry && (
        <aside aria-label="From your last mentor review" className="mb-5 rounded-xl border border-[#d6a88f]/70 bg-[#fbf6f1] px-4 py-3.5 dark:border-[#e08a68]/30 dark:bg-[#e08a68]/[0.07]">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#a24d2e] dark:text-[#e08a68]">From your last mentor review</p>
          <p className="mt-1.5 text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">{carryForward.rule}</p>
          {carryForward.planLine && <p className="mt-1.5 text-[13px] leading-6 text-zinc-600 dark:text-zinc-300">Write in this plan: {carryForward.planLine}</p>}
          {carryForward.checkpoint && <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Next review checks: {carryForward.checkpoint}</p>}
        </aside>
      )}

      {isQuick ? (
        <QuickPlanFields
          values={quick}
          onChange={handleQuickChange}
          templateId={templateId}
          onTemplateChange={handleTemplateChange}
          autoFocus={!savedDraft}
          onOpenFullEditor={openFullEditor}
        />
      ) : (
        <DeferredEditor
          ref={editorRef}
          id="plan-content"
          label="Trade plan"
          initialHtml={seedHtml}
          placeholder="Levels, setups, entry & exit rules, risk, what would invalidate the idea…"
          onUploadImage={onUploadImage}
          onChange={(html) => {
            if (draftClosedRef.current) return
            editorDraftRef.current = html
            contentTouchedRef.current = true
            setFullHasText(htmlHasText(html))
            persistDraft()
          }}
        />
      )}
    </FormDrawer>
    </>
  )
}

/**
 * Entry point used by the planner. A weekly plan (an existing entry with scope "week", or a new one opened with
 * `scope="week"`) renders the weekly variant in the same drawer. Everything else is the daily form, unchanged.
 */
function PlanForm(props) {
  const isWeekly = props.scope === 'week' || props.initialEntry?.scope === 'week'
  return isWeekly ? <WeeklyPlanForm {...props} /> : <DailyPlanForm {...props} />
}

export default PlanForm
