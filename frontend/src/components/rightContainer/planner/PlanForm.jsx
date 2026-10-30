import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import FormDrawer from '../../common/FormDrawer'
import PropertyRow from '../../common/PropertyRow'
import ShortcutHint from '../../common/ShortcutHint'
import DeferredEditor from '../../common/DeferredEditor'
import FocusTimerPanel from './FocusTimerPanel'
import { dateInputClass, ghostFooterButton, primaryFooterButton } from '../../common/formStyles'
import { CalendarIcon } from '../../../utils/Icons.jsx'
import { SlidersIcon } from '../../../utils/Icons.jsx'
import { formatLongDate, todayKey } from '../../../utils/calendar'
import { MOD_LABEL } from '../../../hooks/useFormShortcuts'
import { useFocusPreferences } from '../../../hooks/useFocusPreferences'
import { readFormDraft, writeFormDraft } from '../../../utils/formDraftStorage'

const MAX_TITLE = 120
const FOCUS_THEMES = [
  { value: 'sage', label: 'Sage', swatch: 'bg-[#8b9b83]' },
  { value: 'ocean', label: 'Ocean', swatch: 'bg-sky-500' },
  { value: 'amber', label: 'Amber', swatch: 'bg-amber-500' },
]

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
.deep-mode-footer { border-top: 0; background: #f7f6f2; }
.dark .deep-mode-footer { border-top: 0; background: #111311; }
@keyframes deep-wave-drift { from { transform: translateY(-3px) scaleY(.88); } to { transform: translateY(4px) scaleY(1.08); } }
@keyframes deep-breathe { 0%,100% { opacity: .55; box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { opacity: 1; box-shadow: 0 0 0 4px rgba(16,185,129,.08); } }
@media (prefers-reduced-motion: reduce) { .deep-focus-waves path, .deep-focus-breathe { animation: none !important; } }
`


/**
 * Drawer form to write (or review) the plan for one calendar day.
 * Same layout as TradeForm: big title header, property rows, rich text body with screenshots.
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
function PlanForm({ plannerId, plannerName, plannerType, initialEntry = null, initialDate, onSubmit, onDelete, onClose, onUploadImage, carryForward = null }) {
  const defaultDate = initialEntry?.date ?? initialDate ?? todayKey()
  const draftKey = `tradecommit:plan-form-draft:${plannerId}:${initialEntry?.id ?? 'new'}`
  const [savedDraft] = useState(() => readFormDraft(draftKey))
  const contentDraftRef = useRef(savedDraft?.content ?? initialEntry?.content ?? '')
  const { register, handleSubmit, control, getValues, formState: { errors } } = useForm({
    defaultValues: { title: initialEntry?.title ?? '', date: defaultDate, ...(savedDraft?.values ?? {}) }
  })
  const drawerRef = useRef(null)
  const editorRef = useRef(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [deepMode, setDeepMode] = useState(() => savedDraft?.deepMode === true)
  const [isFocusSettingsOpen, setIsFocusSettingsOpen] = useState(false)
  const focusSettingsRef = useRef(null)
  const focusSettingsButtonRef = useRef(null)
  const { preferences, isLoaded: areFocusPreferencesLoaded, loadError, isSaving: areFocusPreferencesSaving, saveError, savePreferences, retryLoad } = useFocusPreferences()

  const formValues = useWatch({ control })

  useEffect(() => {
    const timer = setTimeout(() => writeFormDraft(draftKey, { values: formValues, content: contentDraftRef.current, deepMode }), 200)
    return () => clearTimeout(timer)
  }, [draftKey, formValues, deepMode])

  useEffect(() => {
    const flushSave = () => writeFormDraft(draftKey, { values: getValues(), content: contentDraftRef.current, deepMode })
    window.addEventListener('pagehide', flushSave)
    return () => {
      window.removeEventListener('pagehide', flushSave)
    }
  }, [draftKey, getValues, deepMode])

  useEffect(() => {
    if (!isFocusSettingsOpen) return undefined
    const handlePointerDown = (event) => {
      if (!focusSettingsRef.current?.contains(event.target)) setIsFocusSettingsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFocusSettingsOpen(false)
        focusSettingsButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFocusSettingsOpen])

  useEffect(() => {
    if (!deepMode) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [deepMode])

  const saveFocusPreferences = (next) => {
    savePreferences(next)
  }

  const focusSettingsControls = (
    <div ref={focusSettingsRef} className="relative shrink-0">
      <button
        ref={focusSettingsButtonRef}
        type="button"
        onClick={() => setIsFocusSettingsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-controls="focus-settings-panel"
        aria-label="Focus settings"
        aria-expanded={isFocusSettingsOpen}
        title="Focus settings"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70 ${isFocusSettingsOpen ? 'border-stone-300 bg-white/80 text-stone-700 dark:border-white/15 dark:bg-white/[0.08] dark:text-stone-100' : 'border-transparent text-stone-500 hover:bg-stone-200/60 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-white/[0.07] dark:hover:text-stone-100'}`}
      >
        <SlidersIcon className="h-4 w-4" />
      </button>
      {isFocusSettingsOpen && (
        <div id="focus-settings-panel" role="dialog" aria-label="Focus settings" className="absolute right-0 top-[calc(100%+10px)] z-[60] w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-stone-200 bg-[#fbfaf7] p-3.5 text-stone-800 shadow-[0_16px_45px_rgba(20,25,20,0.16)] dark:border-white/10 dark:bg-[#1b1e1b] dark:text-stone-100 dark:shadow-black/40">
          <div className="mt-3 border-t border-stone-200/80 pt-3 dark:border-white/[0.08]">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">Focus tint</p>
            <div role="radiogroup" aria-label="Focus theme" className="grid grid-cols-3 gap-1.5">
              {FOCUS_THEMES.map(({ value, label, swatch }) => {
                const active = preferences.focusTheme === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => saveFocusPreferences({ ...preferences, focusTheme: value })}
                    disabled={!areFocusPreferencesLoaded || areFocusPreferencesSaving}
                    title={active ? `${label} focus tint selected` : `Switch to ${label} focus tint`}
                    className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border text-[10px] font-medium transition-colors disabled:opacity-60 ${active ? 'border-stone-400/70 bg-white text-stone-800 shadow-sm dark:border-white/20 dark:bg-white/[0.09] dark:text-white' : 'border-transparent text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/[0.06]'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${swatch}`} />
                    {label}{active && <span aria-hidden="true" className="ml-0.5">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
          {loadError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">{loadError} <button type="button" onClick={retryLoad} className="font-medium underline underline-offset-2">Retry</button></p>}
          {saveError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">{saveError}</p>}
        </div>
      )}
    </div>
  )

  const date = formValues?.date ?? defaultDate
  const isBusy = isSaving

  const handleFormSubmit = async (values) => {
    setSubmitError('')
    setIsSaving(true)
    try {
      const draft = await editorRef.current.getDraft()
      editorRef.current.markSubmitted()
      onSubmit(
        { title: values.title.trim(), date: values.date || todayKey(), content: draft.html, images: draft.images, removedImages: draft.removedImages },
        draft.prepare
      )
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

  const submitForm = (event) => handleSubmit(handleFormSubmit)(event)

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
        {onDelete && !isConfirmingDelete && (
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
        {submitError && <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">{submitError}</p>}
      </div>

      <div className="flex items-center gap-2">
        <ShortcutHint className="mr-2 hidden md:block" />
        <button type="button" onClick={() => drawerRef.current?.close()} className={ghostFooterButton}>Cancel</button>
        <button type="submit" disabled={isBusy} title={`Save (${MOD_LABEL}+Enter)`} className={primaryFooterButton}>
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
      sidePanel={deepMode ? <FocusTimerPanel theme={preferences.focusTheme} /> : null}
      headerExtra={(
        <>
          {deepMode && focusSettingsControls}
          <button type="button" onClick={() => {
            setDeepMode((value) => !value)
            setIsFocusSettingsOpen(false)
          }} aria-pressed={deepMode} aria-label={deepMode ? 'Turn off deep focus' : 'Turn on deep focus'} className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-all duration-300 ${deepMode ? 'border-stone-300/80 bg-white/70 text-stone-700 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-200' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full transition-colors ${deepMode ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
            <span className="hidden sm:inline">{deepMode ? 'Deep focus on' : 'Deep focus'}</span>
          </button>
        </>
      )}
      onSubmit={submitForm}
      onClose={onClose}
      footer={footer}
      canClose={!isBusy}
      canSubmit={!isBusy}
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
        {...register('title', { validate: (value) => value.trim() !== '' || 'Give this plan a title' })}
        aria-label="Plan title"
        autoComplete="off"
        maxLength={MAX_TITLE}
        placeholder="e.g. Nifty breakout plan"
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
      </div>

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

      <DeferredEditor
        ref={editorRef}
        id="plan-content"
        label="Trade plan"
        initialHtml={savedDraft?.content ?? initialEntry?.content ?? ''}
        placeholder="Levels, setups, entry & exit rules, risk, what would invalidate the idea…"
        onUploadImage={onUploadImage}
        onChange={(html) => {
          contentDraftRef.current = html
          writeFormDraft(draftKey, { values: getValues(), content: html, deepMode })
        }}
      />
    </FormDrawer>
    </>
  )
}

export default PlanForm
