import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import FormDrawer from '../../common/FormDrawer'
import PropertyRow from '../../common/PropertyRow'
import ShortcutHint from '../../common/ShortcutHint'
import DeferredEditor from '../../common/DeferredEditor'
import WeeklyPlanFields from './WeeklyPlanFields'
import { ghostFooterButton, primaryFooterButton } from '../../common/formStyles'
import { CalendarIcon } from '../../../utils/Icons.jsx'
import { todayKey } from '../../../utils/calendar'
import { MOD_LABEL } from '../../../hooks/useFormShortcuts'
import { useDeepFocus } from '../../../context/useDeepFocus'
import { clearFormDraft, readFormDraft, writeFormDraft } from '../../../utils/formDraftStorage'
import {
  DEFAULT_WEEKLY_SECTIONS, EMPTY_WEEKLY, MAX_TITLE, appendWeeklyPlanHtml, hasWeeklyContent, htmlHasText,
  sanitizeWeekly, sanitizeWeeklySections, weekRangeLabel, weekStartKey, weekTitle, weeklyDraftKey
} from '../../../utils/quickPlan'

const isMode = (value) => value === 'quick' || value === 'full'

const modeButton = (active) => `inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:bg-white/[0.08] ${active ? 'bg-zinc-100 text-cyan-800 dark:bg-white/[0.08] dark:text-cyan-300' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'}`

/**
 * The weekly variant of PlanForm, rendered in the same drawer. A weekly plan is saved with scope "week" and `date` set
 * to the week's first day (Monday, as a "YYYY-MM-DD" string). The week is shown as text, never picked.
 *
 * A NEW weekly plan opens in Quick mode; an existing one opens in the full editor, as a daily plan does.
 * Its draft is stored under its own key, so it never mixes with a daily draft.
 *
 * Props are PlanForm's, plus `plannerId` (used for the draft key; falls back to the entry's own plannerId).
 * `initialDate` is the week's FIRST day (the calendar passes it, following its own first weekday); it is used as given.
 * Without one, a new plan is for the week of today, starting on Monday.
 * `initialSections` are the section cards to open on a NEW plan, on top of the default ones (a restored draft wins).
 */
function WeeklyPlanForm({ plannerName, plannerType, plannerId, initialEntry = null, initialDate, initialSections: requestedSections, quickSection, onSubmit, onDelete, onClose, onUploadImage, guideOverlayActive = false }) {
  const [weekStart] = useState(() => initialEntry?.date ?? initialDate ?? weekStartKey(todayKey()))
  const draftKey = weeklyDraftKey(plannerId ?? initialEntry?.plannerId ?? 'planner', weekStart)
  const defaultTitle = initialEntry?.title ?? weekTitle(weekStart)
  const [savedDraft] = useState(() => readFormDraft(draftKey))
  const savedValues = savedDraft?.values && typeof savedDraft.values === 'object' ? savedDraft.values : {}
  const initialTitle = typeof savedValues.title === 'string' ? savedValues.title : defaultTitle
  const initialContent = typeof savedDraft?.content === 'string' ? savedDraft.content : initialEntry?.content ?? ''
  const [initialMode] = useState(() => (quickSection ? 'quick' : initialEntry ? 'full' : savedDraft && isMode(savedDraft.mode) ? savedDraft.mode : 'quick'))
  const { register, handleSubmit, subscribe } = useForm({ defaultValues: { title: initialTitle } })
  const drawerRef = useRef(null)
  const editorRef = useRef(null)
  const editorDraftRef = useRef(initialContent)
  const latestTitleRef = useRef(initialTitle)
  const draftClosedRef = useRef(false)
  const [initialQuick] = useState(() => sanitizeWeekly(savedDraft?.quick))
  const [initialSections] = useState(() => {
    if (quickSection) {
      if (quickSection === 'bias') return []
      const savedSections = savedDraft ? sanitizeWeeklySections(savedDraft.sections) : []
      return [...new Set([...savedSections, quickSection])]
    }
    if (savedDraft) return sanitizeWeeklySections(savedDraft.sections)
    const extra = Array.isArray(requestedSections) ? sanitizeWeeklySections(requestedSections) : []
    return [...DEFAULT_WEEKLY_SECTIONS, ...extra.filter((key) => !DEFAULT_WEEKLY_SECTIONS.includes(key))]
  })
  const modeRef = useRef(initialMode)
  const quickRef = useRef(initialQuick)
  const sectionsRef = useRef(initialSections)
  const contentTouchedRef = useRef(Boolean(savedDraft))
  const discardConfirmedRef = useRef(false)
  const confirmDiscardRef = useRef(false)
  const [mode, setMode] = useState(initialMode)
  const [quick, setQuick] = useState(initialQuick)
  const [sections, setSections] = useState(initialSections)
  const [seedHtml, setSeedHtml] = useState(initialContent)
  const [fullHasText, setFullHasText] = useState(() => htmlHasText(initialContent))
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false)
  const [showRestored, setShowRestored] = useState(Boolean(savedDraft))
  const [submitError, setSubmitError] = useState('')
  const { isEnabled: deepMode, preferences, setPlannerHeaderHost } = useDeepFocus()
  const isQuick = mode === 'quick'

  const persistDraft = useCallback((title = latestTitleRef.current) => {
    if (draftClosedRef.current) return
    writeFormDraft(draftKey, {
      values: { title: typeof title === 'string' ? title : '' },
      content: editorDraftRef.current,
      mode: modeRef.current,
      quick: quickRef.current,
      sections: sectionsRef.current
    })
  }, [draftKey])

  useEffect(() => {
    let saveTimer
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        latestTitleRef.current = values.title
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => persistDraft(values.title), 200)
      }
    })
    const flushDraft = () => persistDraft()
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

  const handleSectionsChange = (next) => {
    sectionsRef.current = next
    setSections(next)
    persistDraft()
  }

  const openFullEditor = () => {
    if (modeRef.current === 'full') return
    const seed = appendWeeklyPlanHtml(editorDraftRef.current, quickRef.current, sectionsRef.current)
    editorDraftRef.current = seed
    if (hasWeeklyContent(quickRef.current, sectionsRef.current)) contentTouchedRef.current = true
    quickRef.current = EMPTY_WEEKLY
    sectionsRef.current = [...DEFAULT_WEEKLY_SECTIONS]
    modeRef.current = 'full'
    setQuick(EMPTY_WEEKLY)
    setSections([...DEFAULT_WEEKLY_SECTIONS])
    setSeedHtml(seed)
    setFullHasText(htmlHasText(seed))
    setMode('full')
    persistDraft()
  }

  // only while the editor is empty: free-form text can't be shown as fields
  const openQuickPlan = () => {
    if (modeRef.current === 'quick') return
    if (htmlHasText(editorDraftRef.current)) return
    editorDraftRef.current = ''
    modeRef.current = 'quick'
    setSeedHtml('')
    setMode('quick')
    persistDraft()
  }

  const isDirty = useCallback(() =>
    (latestTitleRef.current ?? '') !== defaultTitle ||
    contentTouchedRef.current ||
    hasWeeklyContent(quickRef.current, sectionsRef.current), [defaultTitle])

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!isDirty()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  const guardClose = () => {
    if (discardConfirmedRef.current || draftClosedRef.current) return true
    if (confirmDiscardRef.current) {
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

  const isBusy = isSaving

  const handleFormSubmit = async (values) => {
    setSubmitError('')
    setIsSaving(true)
    try {
      const title = values.title.trim() || weekTitle(weekStart)
      let payload
      let prepare
      if (isQuick) {
        payload = {
          title,
          date: weekStart,
          scope: 'week',
          content: appendWeeklyPlanHtml(editorDraftRef.current, quickRef.current, sectionsRef.current),
          images: initialEntry?.images ?? [],
          removedImages: []
        }
      } else {
        const draft = await editorRef.current.getDraft()
        payload = { title, date: weekStart, scope: 'week', content: draft.html, images: draft.images, removedImages: draft.removedImages }
        prepare = draft.prepare
      }
      await onSubmit(payload, prepare)
      draftClosedRef.current = true
      editorRef.current?.markSubmitted()
      clearFormDraft(draftKey)
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not save this weekly plan. Please try again.')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setSubmitError('')
    setIsSaving(true)
    try {
      await onDelete()
      draftClosedRef.current = true
      clearFormDraft(draftKey)
      drawerRef.current?.close()
    } catch (error) {
      setSubmitError(error.message || 'Could not delete this weekly plan. Please try again.')
      setIsSaving(false)
    }
  }

  const submitWeeklyForm = (event) => handleSubmit(handleFormSubmit)(event)

  const breadcrumb = (
    <>
      {plannerName}
      <span className="mx-1.5 opacity-60">/</span>
      {initialEntry ? 'Weekly plan' : 'New weekly plan'}
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
        <button type="submit" disabled={isBusy} title={`Save (${MOD_LABEL}+Enter)`} className={primaryFooterButton}>
          {isBusy ? 'Saving...' : initialEntry ? 'Save weekly plan' : 'Create weekly plan'}
        </button>
      </div>
    </>
  )

  return (
    <FormDrawer
      ref={drawerRef}
      ariaTitle={`${initialEntry ? 'Edit weekly plan in' : 'New weekly plan in'} ${plannerName}`}
      breadcrumb={breadcrumb}
      deepMode={deepMode}
      deepTheme={preferences.focusTheme}
      headerExtra={<div ref={setPlannerHeaderHost} className="flex items-center gap-1" />}
      onSubmit={submitWeeklyForm}
      onClose={handleClose}
      footer={footer}
      canClose={!isBusy}
      canSubmit={!isBusy}
      onBeforeClose={guardClose}
      guideOverlayActive={guideOverlayActive}
    >
      <input
        {...register('title')}
        aria-label="Plan title"
        autoComplete="off"
        maxLength={MAX_TITLE}
        placeholder={weekTitle(weekStart)}
        className="w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-900 outline-none placeholder:font-bold placeholder:text-zinc-300 sm:text-4xl sm:leading-tight dark:text-zinc-50 dark:placeholder:text-zinc-700"
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
          {plannerType}
        </span>
        <span className="rounded-md bg-zinc-100 px-2 py-1 font-medium text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">Weekly</span>
        {!initialEntry && (
          <div role="group" aria-label="Writing mode" className="ml-auto inline-flex items-center rounded-lg border border-zinc-200 p-0.5 dark:border-white/[0.10]">
            <button type="button" aria-pressed={isQuick} onClick={openQuickPlan} disabled={!isQuick && fullHasText} title={!isQuick && fullHasText ? 'Clear the editor to switch back to Quick plan' : undefined} className={modeButton(isQuick)}>Quick plan</button>
            <button type="button" aria-pressed={!isQuick} onClick={openFullEditor} className={modeButton(!isQuick)}>Full editor</button>
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
        <PropertyRow Icon={CalendarIcon} label="Week">
          <p className="flex h-8 items-center px-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{weekRangeLabel(weekStart) || weekStart}</p>
        </PropertyRow>
      </div>

      <hr className="my-6 border-zinc-300 dark:border-white/[0.12]" />

      {isQuick ? (
        <WeeklyPlanFields
          values={quick}
          sections={sections}
          onChange={handleQuickChange}
          onSectionsChange={handleSectionsChange}
          autoFocus={!savedDraft}
          onOpenFullEditor={openFullEditor}
        />
      ) : (
        <DeferredEditor
          ref={editorRef}
          id="plan-content"
          label="Weekly plan"
          initialHtml={seedHtml}
          placeholder="Key levels, events to watch, risk budget, goals, rules…"
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
  )
}

export default WeeklyPlanForm
