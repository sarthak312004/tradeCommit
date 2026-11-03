import { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { journalContext, plannerContext } from '../../../context/Context'
import { usePlanEntries } from '../../../hooks/usePlanEntries'
import { usePlan } from '../../../hooks/usePlan'
import { getCarryForward } from '../../../services/aiRangeReviewApi'
import { todayKey, formatLongDate } from '../../../utils/calendar'
import { loadPlanForm } from '../../../utils/formLoaders'
import { CloseIcon } from '../../../utils/Icons.jsx'
import {
  DEFAULT_PLANNER_TYPE,
  MAX_PLANNER_NAME,
  PLANNER_TYPE_PRESETS
} from '../../../utils/plannerTypes'
import { iconButtonClass } from '../../common/formStyles'
import { createFieldLabel, createTextField } from '../../sidebar/sidebarStyles'

// the existing plan form (rich text editor included) stays code-split, exactly as on the planner page
const PlanForm = lazy(loadPlanForm)

const CONNECT_INTRO = "Connect a trade planner to this journal to create today's trading plan and compare planned setups with executed trades."

const primaryButton =
  'tc-btn-primary h-8 cursor-pointer rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton =
  'h-8 cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:shadow-none dark:hover:bg-white/[0.06]'
const tabButton = (active) =>
  `h-full flex-1 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60 ${
    active
      ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-zinc-100'
      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100'
  }`
const optionClass = (selected) =>
  `flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600 dark:has-[:focus-visible]:ring-sky-400 ${
    selected
      ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-white/[0.07]'
      : 'border-zinc-300 hover:bg-zinc-50 dark:border-white/[0.14] dark:hover:bg-white/[0.04]'
  }`

const toMessage = (error, fallback) =>
  error instanceof TypeError ? "Can't reach the server. Check your connection and try again." : error?.message || fallback

/**
 * Compact modal shell, same look as the export dialog. Rendered in a portal because the page header uses
 * backdrop-blur, which would trap `fixed` children. Escape / backdrop click / X close it unless `busy`.
 */
function PlanTodayModal({ label, title, subtitle, busy = false, onClose, children }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = busy ? () => {} : onClose
  })

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event) => event.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-busy={busy || undefined}
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className={`${iconButtonClass} cursor-pointer disabled:opacity-50`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/** The journal has no connected planner: connect an existing one, or create one that is connected right away. */
function ConnectPlannerDialog({ journal, onClose }) {
  const { planners, createPlanner, updatePlanner } = useContext(plannerContext)
  const { journals = [] } = useContext(journalContext) ?? {}
  const [tab, setTab] = useState(() => (planners.length > 0 ? 'connect' : 'create'))
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState(() => `${journal.name ?? 'Journal'} plans`.slice(0, MAX_PLANNER_NAME))
  const [type, setType] = useState(DEFAULT_PLANNER_TYPE)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const savingRef = useRef(false) // blocks a second click before React has re-rendered the disabled button

  const journalName = (id) => journals.find((item) => String(item.id) === String(id))?.name ?? 'another journal'
  const selectedPlanner = planners.find((planner) => planner.id === selectedId) ?? null
  const movesFromOther = Boolean(selectedPlanner?.linkedJournalId) && String(selectedPlanner.linkedJournalId) !== String(journal.id)

  const plannerType = type.trim()
  const canCreate = Boolean(name.trim()) && Boolean(plannerType)

  const run = async (action, fallback) => {
    if (savingRef.current) return
    savingRef.current = true
    setIsSaving(true)
    setError('')
    try {
      // On success the planner context holds the connected planner, and the flow switches to today's plan form.
      await action()
    } catch (actionError) {
      setError(toMessage(actionError, fallback))
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const handleConnect = (event) => {
    event.preventDefault()
    if (!selectedPlanner) return
    run(() => updatePlanner(selectedPlanner.id, { linkedJournalId: journal.id }), 'Could not connect the planner')
  }

  const handleCreate = (event) => {
    event.preventDefault()
    if (!canCreate) return
    run(() => createPlanner(name.trim(), plannerType, journal.id), 'Could not create the planner')
  }

  const switchTab = (next) => {
    if (isSaving) return
    setError('')
    setTab(next)
  }

  return (
    <PlanTodayModal label="Connect a planner" title="Connect a planner" subtitle={journal.name} busy={isSaving} onClose={onClose}>
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{CONNECT_INTRO}</p>

      <div role="group" aria-label="How to connect" className="mt-4 flex h-8 items-center rounded-lg border border-zinc-300 bg-white p-0.5 shadow-sm dark:border-white/[0.14] dark:bg-panel dark:shadow-none">
        <button type="button" aria-pressed={tab === 'connect'} disabled={isSaving} onClick={() => switchTab('connect')} className={tabButton(tab === 'connect')}>
          Connect existing
        </button>
        <button type="button" aria-pressed={tab === 'create'} disabled={isSaving} onClick={() => switchTab('create')} className={tabButton(tab === 'create')}>
          Create new
        </button>
      </div>

      {tab === 'connect' ? (
        <form onSubmit={handleConnect} className="mt-4">
          {planners.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-400/60 p-4 text-center text-xs text-zinc-600 dark:border-white/[0.14] dark:text-zinc-300">
              You don&apos;t have a planner yet.{' '}
              <button type="button" onClick={() => switchTab('create')} className="cursor-pointer font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300">
                Create one
              </button>
            </p>
          ) : (
            <fieldset disabled={isSaving}>
              <legend className="sr-only">Choose a planner</legend>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5 subtle-scrollbar">
                {planners.map((planner) => {
                  const elsewhere = planner.linkedJournalId && String(planner.linkedJournalId) !== String(journal.id)
                  return (
                    <label key={planner.id} className={optionClass(selectedId === planner.id)}>
                      <input
                        type="radio"
                        name="plan-today-planner"
                        value={planner.id}
                        checked={selectedId === planner.id}
                        onChange={() => setSelectedId(planner.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-800 dark:accent-zinc-200"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{planner.name}</span>
                        <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {planner.type}
                          {elsewhere ? ` · connected to ${journalName(planner.linkedJournalId)}` : ''}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {movesFromOther && (
            <p role="status" className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              This planner is connected to {journalName(selectedPlanner.linkedJournalId)}. Connecting it here moves it to this journal; its plans are kept.
            </p>
          )}
          {error && <p role="alert" className="mt-2 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className={secondaryButton}>Cancel</button>
            <button type="submit" disabled={!selectedPlanner || isSaving} className={primaryButton}>
              {isSaving ? 'Connecting…' : 'Connect & plan today'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCreate} className="mt-4">
          <div className="space-y-3">
            <div>
              <label htmlFor="plan-today-planner-name" className={createFieldLabel}>Planner name</label>
              <input
                id="plan-today-planner-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. NIFTY setups"
                maxLength={MAX_PLANNER_NAME}
                autoComplete="off"
                readOnly={isSaving}
                className={createTextField}
              />
            </div>
            <div>
              <label htmlFor="plan-today-planner-type" className={createFieldLabel}>Planner type</label>
              <select
                id="plan-today-planner-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={isSaving}
                className={createTextField}
              >
                {PLANNER_TYPE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>{preset}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p role="alert" className="mt-2 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className={secondaryButton}>Cancel</button>
            <button type="submit" disabled={!canCreate || isSaving} className={primaryButton}>
              {isSaving ? 'Creating…' : 'Create & plan today'}
            </button>
          </div>
        </form>
      )}
    </PlanTodayModal>
  )
}

/** Several plans already exist for today: open one of them, or start another. Nothing is overwritten. */
function PlanChooser({ plannerName, today, plans, onOpen, onCreate, onClose }) {
  return (
    <PlanTodayModal label="Choose a plan" title="Today's plans" subtitle={`${plannerName} · ${formatLongDate(today)}`} onClose={onClose}>
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
        You already have {plans.length} plans for today. Open one to edit it, or create another.
      </p>
      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto subtle-scrollbar">
        {plans.map((plan) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => onOpen(plan)}
              className="w-full cursor-pointer rounded-lg border border-zinc-300 p-2.5 text-left text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-white/[0.14] dark:text-zinc-100 dark:hover:bg-white/[0.04] dark:focus-visible:ring-sky-400"
            >
              <span className="block truncate">{plan.title || 'Untitled plan'}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>Cancel</button>
        <button type="button" onClick={onCreate} className={primaryButton}>Create another plan</button>
      </div>
    </PlanTodayModal>
  )
}

/**
 * Today's plan for a connected planner. Lives in its own component so `usePlanEntries` is always called
 * unconditionally (rules of hooks) and is keyed by planner, so it reloads whenever the planner changes.
 * Saving goes through the hook's addEntry / updateEntry, i.e. the same plannerApi calls as the planner page.
 */
function ConnectedPlanToday({ planner, journal, onClose, onRetry }) {
  const { entries, isLoading, error, addEntry, updateEntry, removeEntry, uploadImage } = usePlanEntries(planner.id)
  // fixed when the flow opens: a form left open over midnight keeps the day it was opened for
  const [today] = useState(todayKey)
  // null = not decided yet; { kind: 'new' } | { kind: 'edit', entry } | { kind: 'choose' }
  const [selection, setSelection] = useState(null)
  const [carryForward, setCarryForward] = useState(null)
  const { entitlements } = usePlan()

  // the change the journal's latest mentor review asked for, shown inside the form (same as the planner page)
  useEffect(() => {
    let cancelled = false
    getCarryForward(journal.id)
      .then((response) => { if (!cancelled) setCarryForward(response?.commitment ?? null) })
      .catch((carryError) => {
        if (!cancelled) console.error('Could not load the mentor carry-forward hint:', carryError)
      })
    return () => { cancelled = true }
  }, [journal.id])

  const todaysPlans = useMemo(() => entries.filter((entry) => entry.date === today && !entry.syncState), [entries, today])

  // Decide once, when the plans have loaded: none -> new plan, one -> edit it, several -> let the user choose.
  // The decision is frozen so saving (which changes `entries`) never swaps the open form for another.
  if (selection === null && !isLoading && !error) {
    if (todaysPlans.length === 0) setSelection({ kind: 'new' })
    else if (todaysPlans.length === 1) setSelection({ kind: 'edit', entry: todaysPlans[0] })
    else setSelection({ kind: 'choose' })
  }

  if (selection === null) {
    if (error) {
      return (
        <PlanTodayModal label="Today's plan" title="Today's plan" subtitle={planner.name} onClose={onClose}>
          <p role="alert" className="text-[13px] leading-relaxed text-rose-600 dark:text-rose-400">{error}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Plans have to load first so an existing plan for today is never duplicated.</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>Close</button>
            <button type="button" onClick={onRetry} className={primaryButton}>Try again</button>
          </div>
        </PlanTodayModal>
      )
    }
    return (
      <PlanTodayModal label="Today's plan" title="Today's plan" subtitle={planner.name} onClose={onClose}>
        <p role="status" className="flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
          <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-white/20 dark:border-t-zinc-200" />
          Loading today&apos;s plan…
        </p>
      </PlanTodayModal>
    )
  }

  if (selection.kind === 'choose') {
    return (
      <PlanChooser
        plannerName={planner.name}
        today={today}
        plans={todaysPlans}
        onOpen={(entry) => setSelection({ kind: 'edit', entry })}
        onCreate={() => setSelection({ kind: 'new' })}
        onClose={onClose}
      />
    )
  }

  // the live entry (so saved edits show), or the one that was opened if it vanished while the form is still closing
  const currentEntry = selection.kind === 'edit' ? entries.find((entry) => entry.id === selection.entry.id) ?? selection.entry : null
  const draftKey = `tradecommit:plan-form-draft:${planner.id}:${currentEntry?.id ?? 'new'}`
  const handleSubmit = (values, prepare) =>
    currentEntry ? updateEntry(currentEntry.id, values, prepare) : addEntry(values, prepare)

  return (
    <Suspense fallback={null}>
      <PlanForm
        key={currentEntry?.id ?? `new-${today}`}
        plannerId={planner.id}
        plannerName={planner.name}
        plannerType={planner.type}
        draftKey={draftKey}
        initialEntry={currentEntry}
        initialDate={today}
        onSubmit={handleSubmit}
        onDelete={currentEntry ? () => removeEntry(currentEntry.id) : undefined}
        onClose={onClose}
        onUploadImage={uploadImage}
        carryForward={entitlements?.aiCarryForward ? carryForward : null}
      />
    </Suspense>
  )
}

/**
 * "Plan today" for the selected journal. The planner is found through its `linkedJournalId`; without one the user
 * connects or creates a planner first. After either, the planner context updates and today's plan form opens
 * straight away over the journal.
 */
function PlanTodayFlow({ journal, onClose }) {
  const { planners, isLoading } = useContext(plannerContext)
  const [attempt, setAttempt] = useState(0)
  const planner = planners.find((item) => item.linkedJournalId && String(item.linkedJournalId) === String(journal.id)) ?? null

  if (planner) {
    return (
      <ConnectedPlanToday
        key={`${planner.id}:${attempt}`}
        planner={planner}
        journal={journal}
        onClose={onClose}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    )
  }

  if (isLoading) {
    return (
      <PlanTodayModal label="Plan today" title="Plan today" subtitle={journal.name} onClose={onClose}>
        <p role="status" className="text-[13px] text-zinc-600 dark:text-zinc-300">Loading your planners…</p>
      </PlanTodayModal>
    )
  }

  return <ConnectPlannerDialog journal={journal} onClose={onClose} />
}

export default PlanTodayFlow
