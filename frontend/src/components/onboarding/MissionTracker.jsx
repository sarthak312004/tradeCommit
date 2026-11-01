import { useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { journalContext, plannerContext } from '../../context/Context'
import { useGuidance } from '../../hooks/useGuidance'
import { useMentorProgress } from '../../hooks/useMentorProgress'
import { useProfile } from '../../hooks/useProfile'
import { listReviewHistory } from '../../services/aiRangeReviewApi'
import { CheckIcon, CloseIcon } from '../../utils/Icons.jsx'
import { controlPrimary, focusRing } from '../common/controlStyles'
import { deriveMission, countSavedTrades } from '../../utils/missionSteps'
import {
  MENTOR_OPENED_EVENT,
  MISSION_EVENTS,
  OPEN_MISSION_EVENT,
  getMentorSeen,
  getMissionReachedRaw,
  getMissionSkippedRaw,
  getMissionStatus,
  getMissionTarget,
  isMissionClosed,
  isMissionTrackerEnabled,
  markMissionReached,
  requestMissionAction,
  setMentorSeen,
  setMissionStatus,
  setMissionTarget,
  skipMissionStep,
  subscribeMission,
  trackMissionEvent,
} from '../../utils/missionTracker'
import { isTradingLoopEnabled, openTradingLoop } from '../../utils/tradingLoop'
import LoopIcon from '../tradingLoop/LoopIcon'
import './missionProgress.css'

const btnPrimary = controlPrimary
const btnGhost = `inline-flex h-8 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-50 ${focusRing}`
const select = `h-8 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-100 ${focusRing}`

const TITLES = {
  journal: 'Create a journal',
  planner: 'Create a planner',
  link: 'Connect a planner to your journal',
  trade: 'Log your first trade',
  feedback: 'Open your AI mentor feedback',
}

/**
 * The Trading Loop mission tracker. Outer gate: renders nothing (and makes no requests) unless the rollout switch is on and
 * this account was offered the tracker (new sign-up, or opted in from the profile menu). Existing accounts never see it by themselves.
 */
export default function MissionTracker({ onCreate }) {
  const { profile } = useProfile()
  const username = profile?.username
  const enabled = isMissionTrackerEnabled()
  const status = useSyncExternalStore(subscribeMission, () => (username ? getMissionStatus(username) : null), () => null)
  const closed = useSyncExternalStore(subscribeMission, () => (username ? isMissionClosed(username) : true), () => true)

  useEffect(() => {
    if (!enabled || !username) return undefined
    const open = () => {
      if (!isMissionClosed(username) && getMissionStatus(username) !== 'complete') setMissionStatus(username, 'active')
    }
    window.addEventListener(OPEN_MISSION_EVENT, open)
    return () => window.removeEventListener(OPEN_MISSION_EVENT, open)
  }, [enabled, username])

  if (!enabled || !username || closed || !['active', 'minimized', 'complete'].includes(status)) return null
  return <MissionPanel username={username} status={status} onCreate={onCreate} />
}

function MissionPanel({ username, status, onCreate }) {
  const navigate = useNavigate()
  const { journals, selectJournal, isLoading: journalsLoading } = useContext(journalContext)
  const { planners, isLoading: plannersLoading, updatePlanner } = useContext(plannerContext)
  const targetId = useSyncExternalStore(subscribeMission, () => getMissionTarget(username), () => null)
  const skippedRaw = useSyncExternalStore(subscribeMission, () => getMissionSkippedRaw(username), () => '[]')
  const mentorSeen = useSyncExternalStore(subscribeMission, () => getMentorSeen(username), () => false)
  const skipped = useMemo(() => {
    try {
      const list = JSON.parse(skippedRaw)
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }, [skippedRaw])

  const totalTrades = journals.reduce((sum, journal) => sum + countSavedTrades(journal), 0)
  const { progress: mentor } = useMentorProgress(totalTrades)
  const mentorRef = useRef(null)
  const [hasReview, setHasReview] = useState(false)
  const { activeId, modalOpen } = useGuidance()
  const suppressed = Boolean(activeId) || modalOpen
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pickPlanner, setPickPlanner] = useState('')
  const [pickJournal, setPickJournal] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [justHit, setJustHit] = useState(false)
  const headingId = useId()
  const closeTimer = useRef(null)
  const previousDoneCount = useRef(null)

  useEffect(() => {
    mentorRef.current = mentor
  }, [mentor])

  // the mentor request is best effort: if it fails the tracker still works, it just cannot show the mentor's trade count
  const ready = !journalsLoading && !plannersLoading
  const reachedRaw = useSyncExternalStore(subscribeMission, () => getMissionReachedRaw(username), () => '[]')
  const reached = useMemo(() => {
    try {
      const list = JSON.parse(reachedRaw)
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }, [reachedRaw])
  const input = { journals, planners, targetJournalId: targetId, mentor, feedbackSeen: hasReview || mentorSeen, skipped }
  const m = deriveMission({ ...input, sticky: reached })
  const liveDone = deriveMission({ ...input, journals: journals.filter((journal) => !String(journal.id).startsWith('pending-')) })
    .steps.filter((step) => step.done).map((step) => step.id).join(',')

  useEffect(() => {
    if (ready && liveDone) markMissionReached(username, liveDone.split(','))
  }, [ready, liveDone, username])

  useEffect(() => {
    if (previousDoneCount.current !== null && m.doneCount > previousDoneCount.current) {
      setJustHit(true)
      const timer = setTimeout(() => setJustHit(false), 800)
      previousDoneCount.current = m.doneCount
      return () => clearTimeout(timer)
    }
    previousDoneCount.current = m.doneCount
    return undefined
  }, [m.doneCount])

  // a saved review counts as "feedback exists" (cheap history read; it never calls the AI and never uses allowance)
  const reviewJournalId = m.targetJournal?.id ?? journals[0]?.id
  useEffect(() => {
    if (!mentor?.completed || mentor.firstFeedbackReceived || !reviewJournalId || hasReview) return undefined
    let cancelled = false
    listReviewHistory(reviewJournalId, { limit: 1 })
      .then((page) => !cancelled && setHasReview((page?.items?.length ?? 0) > 0))
      .catch(() => {}) // best effort: the "opened it once" signal still works
    return () => { cancelled = true }
  }, [mentor?.completed, mentor?.firstFeedbackReceived, reviewJournalId, hasReview])

  // opening the mentor after it has unlocked counts as seeing the feedback
  useEffect(() => {
    const seen = () => {
      if (mentorRef.current?.completed) setMentorSeen(username)
    }
    window.addEventListener(MENTOR_OPENED_EVENT, seen)
    return () => window.removeEventListener(MENTOR_OPENED_EVENT, seen)
  }, [username])

  // analytics: "started" once; step events only for steps that become done WHILE the tracker is open (baseline = what already existed)
  const previous = useRef(null)
  const doneKey = m.steps.map((step) => (step.done ? '1' : '0')).join('')
  useEffect(() => {
    if (!ready) return
    trackMissionEvent(username, MISSION_EVENTS.started)
    const [, planner, link, trade, feedback] = [...doneKey].map((flag) => flag === '1')
    const doneNow = { planner, link, trade, feedback }
    const before = previous.current
    if (before) {
      if (planner && !before.planner) trackMissionEvent(username, MISSION_EVENTS.plannerCreated)
      if (link && !before.link) trackMissionEvent(username, MISSION_EVENTS.plannerLinked)
      if (trade && !before.trade) trackMissionEvent(username, MISSION_EVENTS.firstTrade)
      if (feedback && !before.feedback) trackMissionEvent(username, MISSION_EVENTS.firstFeedback)
    }
    previous.current = doneNow
    if (doneKey === '11111' && status !== 'complete') {
      trackMissionEvent(username, MISSION_EVENTS.completed)
      setMissionStatus(username, 'complete')
    }
  }, [ready, doneKey, status, username])

  const minimize = () => setMissionStatus(username, 'minimized')
  const expand = () => setMissionStatus(username, 'active')
  const dismiss = () => {
    if (m.complete) setMissionStatus(username, 'dismissed')
  }
  const openPanel = () => {
    clearTimeout(closeTimer.current)
    setIsOpen(true)
  }
  const closePanelSoon = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setIsOpen(false), 180)
  }
  const minimizePanel = () => {
    minimize()
    setIsOpen(false)
  }
  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
  }

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const guard = async (work, fallback) => {
    if (busy) return // one request at a time: no double submit, no duplicate records
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (failure) {
      setError(failure?.message || fallback)
    } finally {
      setBusy(false)
    }
  }

  const linkPlanner = () => guard(async () => {
    if (!pickPlanner || !m.targetJournal) return
    await updatePlanner(pickPlanner, { linkedJournalId: m.targetJournal.id }) // the app's own planner-link call
    setPickPlanner('')
  }, 'Could not connect the planner. Nothing was changed; please try again.')

  const goTrade = () => {
    if (!m.targetJournal) return
    selectJournal(m.targetJournal.id)
    navigate('/')
    requestMissionAction('new-trade', m.targetJournal.id)
    minimize()
  }

  const goFeedback = () => {
    const withTrades = [...journals].sort((a, b) => countSavedTrades(b) - countSavedTrades(a))[0]
    const journal = m.targetJournal && countSavedTrades(m.targetJournal) > 0 ? m.targetJournal : withTrades
    if (!journal) return
    selectJournal(journal.id)
    navigate('/')
    requestMissionAction('mentor', journal.id)
    minimize()
  }

  if (!ready) return null

  const rowState = (step) => (step.done ? 'done' : step.skipped ? 'skipped' : step.id === m.currentId ? 'current' : step.locked ? 'locked' : 'open')

  return (
    <div
      className={`relative ${suppressed ? 'invisible' : ''}`}
      onMouseEnter={openPanel}
      onMouseLeave={closePanelSoon}
      onFocusCapture={openPanel}
      onBlurCapture={handleBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false)
          event.stopPropagation()
        }
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={headingId}
        aria-label={m.complete ? 'Trading Loop complete. Open guide summary.' : `Trading Loop progress: ${m.doneCount} of ${m.total} complete. Open guide.`}
        onClick={() => {
          // Resume the unified guide when enabled; hover/focus still reveals step details.
          if (isTradingLoopEnabled()) {
            openTradingLoop({ resume: true })
            return
          }
          expand()
          openPanel()
        }}
        className={`flex w-[min(34vw,13rem)] cursor-pointer flex-col gap-1.5 rounded-lg border border-zinc-300 bg-white/90 px-2.5 py-1.5 text-left shadow-sm backdrop-blur transition-colors hover:bg-white sm:w-[14rem] dark:border-white/[0.14] dark:bg-panel/90 dark:shadow-none dark:hover:bg-panel-hi ${focusRing}`}
      >
        <span className="flex w-full items-center justify-between gap-2 text-[10px] font-medium tracking-wide text-zinc-800 dark:text-zinc-200 sm:text-[11px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <LoopIcon className={`h-3.5 w-3.5 shrink-0 ${m.complete ? 'text-emerald-700 dark:text-emerald-400' : 'text-sky-700 dark:text-sky-300'}`} />
            <span className="truncate">{m.complete ? 'Loop complete' : 'Trading Loop'}</span>
          </span>
          {!m.complete && <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">{m.doneCount}/{m.total}</span>}
        </span>
        {!m.complete && (
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={m.total}
            aria-valuenow={m.doneCount}
            aria-label="Trading Loop progress"
            className="flex w-full items-center gap-[3px]"
          >
            {m.steps.map((step, index) => {
              const isFilled = index < m.doneCount
              const isNewest = justHit && index === m.doneCount - 1
              return (
              <span
                key={step.id}
                aria-hidden="true"
                title={`Progress segment ${index + 1}${isFilled ? ': filled' : ''}`}
                className={`mission-seg h-[5px] min-w-0 flex-1 rounded-full transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none ${
                  isFilled ? 'mission-seg-on' : 'bg-zinc-200 dark:bg-white/[0.12]'
                } ${isNewest ? 'mission-seg-hit' : ''}`}
              />
              )
            })}
          </span>
        )}
      </button>

      {isOpen && (
        <aside
          id={headingId}
          role="region"
          aria-labelledby={`${headingId}-title`}
          className="absolute left-1/2 top-[calc(100%+10px)] z-[70] flex max-h-[min(34rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-[0_16px_45px_rgba(0,0,0,0.14)] dark:border-white/[0.12] dark:bg-panel-hi dark:text-zinc-100 dark:shadow-black/50"
          onMouseEnter={openPanel}
        >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-white/[0.10]">
        <LoopIcon className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" />
        <h2 id={`${headingId}-title`} className="flex-1 text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
          {m.complete ? 'Your loop is running' : 'Your Trading Loop'}
        </h2>
        <span className="text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-400">{m.doneCount} of {m.total}</span>
        <button type="button" onClick={minimizePanel} aria-label="Minimise guide" className={`${btnGhost} !h-7 !w-7 justify-center !px-0`}><span aria-hidden="true">–</span></button>
        {m.complete && (
          <button type="button" onClick={dismiss} aria-label="Dismiss completed guide. You can reopen it from the profile menu." className={`${btnGhost} !h-7 !w-7 justify-center !px-0`}><CloseIcon className="h-3.5 w-3.5" /></button>
        )}
      </div>

      <div className="subtle-scrollbar min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
        {m.complete ? (
          <p className="text-[13px] leading-6 text-zinc-700 dark:text-zinc-300">
            Journal, plan, trade and feedback are all connected. From here the loop is simple: plan before you trade, log what you did, and bring the mentor's findings back into your strategy.
          </p>
        ) : (
          <ol className="space-y-1">
            {m.steps.map((step) => {
              const state = rowState(step)
              const isCurrent = state === 'current'
              return (
                <li key={step.id} className={`rounded-lg px-2 py-2 ${isCurrent ? 'bg-sky-700/[0.07] dark:bg-sky-400/[0.09]' : ''}`}>
                  <div className="flex items-center gap-2.5 text-[13px]">
                    <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${step.done ? 'border-sky-700 bg-sky-700 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-zinc-950' : isCurrent ? 'border-sky-700 dark:border-sky-400' : 'border-zinc-400 dark:border-white/[0.24]'}`}>
                      {step.done && <CheckIcon className="h-2.5 w-2.5" />}
                    </span>
                    <span className={`flex-1 ${step.done || step.skipped ? 'text-zinc-600 dark:text-zinc-400' : state === 'locked' ? 'text-zinc-600 dark:text-zinc-400' : 'font-medium text-zinc-900 dark:text-zinc-100'} ${step.done ? 'line-through' : ''}`}>
                      {TITLES[step.id]}
                    </span>
                    {step.skipped && <span className="text-[11px] text-zinc-600 dark:text-zinc-400">skipped</span>}
                    {step.id === 'feedback' && !step.done && <span className="text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">{Math.min(m.mentor.count, m.mentor.target)}/{m.mentor.target} trades</span>}
                  </div>

                  {isCurrent && (
                    <div className="mt-2 pl-[1.625rem]">
                      {step.id === 'journal' && (
                        <>
                          <p className="mb-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">A journal holds the trades of one account or strategy. It takes about 10 seconds.</p>
                          <button type="button" className={btnPrimary} onClick={() => onCreate?.('journals')}>Create journal</button>
                        </>
                      )}
                      {step.id === 'planner' && (
                        <>
                          <p className="mb-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">A planner is where you write down what you expect <em>before</em> you trade.</p>
                          <div className="flex items-center gap-1">
                            <button type="button" className={btnPrimary} onClick={() => onCreate?.('planners')}>Create planner</button>
                            <button type="button" className={btnGhost} onClick={() => skipMissionStep(username, 'planner')}>Not now</button>
                          </div>
                        </>
                      )}
                      {step.id === 'link' && <LinkStep m={m} busy={busy} pickPlanner={pickPlanner} setPickPlanner={setPickPlanner} onLink={linkPlanner} onCreate={onCreate} onSkip={() => skipMissionStep(username, 'link')} />}
                      {step.id === 'trade' && (
                        <>
                          <p className="mb-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">Add the asset, direction, entry and a note on why. Even an older trade works.</p>
                          <button type="button" className={btnPrimary} onClick={goTrade}>Log a trade in {m.targetJournal?.name}</button>
                        </>
                      )}
                      {step.id === 'feedback' && (
                        <>
                          <p className="mb-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">Your mentor is unlocked. It reads your rules, plans and trades together.</p>
                          <button type="button" className={btnPrimary} onClick={goFeedback}>Open AI mentor</button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {m.needsTargetChoice && !m.complete && (
          <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-white/[0.10]">
            <label htmlFor={`${headingId}-j`} className="mb-1.5 block text-xs font-medium text-zinc-800 dark:text-zinc-200">You have several journals. Which one is this guide for?</label>
            <div className="flex gap-2">
              <select id={`${headingId}-j`} className={select} value={pickJournal} onChange={(event) => setPickJournal(event.target.value)}>
                <option value="">Choose a journal</option>
                {journals.map((journal) => <option key={journal.id} value={journal.id}>{journal.name}</option>)}
              </select>
              <button type="button" className={btnPrimary} disabled={!pickJournal} onClick={() => setMissionTarget(username, pickJournal)}>Use</button>
            </div>
          </div>
        )}

        {!m.needsTargetChoice && m.targetJournal && journals.length > 1 && !m.complete && (
          <p className="mt-3 text-[11px] text-zinc-600 dark:text-zinc-400">
            Guide journal: {m.targetJournal.name}{' '}
            <button type="button" className="cursor-pointer font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300" onClick={() => setMissionTarget(username, null)}>change</button>
          </p>
        )}

        <p role="alert" className={error ? 'mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300' : 'sr-only'}>{error}</p>
      </div>
        </aside>
      )}
    </div>
  )
}

function LinkStep({ m, busy, pickPlanner, setPickPlanner, onLink, onCreate, onSkip }) {
  const id = useId()
  const options = m.linkablePlanners
  return (
    <>
      <p className="mb-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
        A connected planner lets the AI mentor compare what you planned with what you actually traded in <strong className="font-semibold">{m.targetJournal?.name}</strong>. Without the link, it only sees the trades.
      </p>
      {options.length > 0 ? (
        <>
          <label htmlFor={id} className="sr-only">Planner to connect</label>
          <select id={id} className={select} value={pickPlanner} onChange={(event) => setPickPlanner(event.target.value)}>
            <option value="">Choose a planner</option>
            {options.map((planner) => <option key={planner.id} value={planner.id}>{planner.name}</option>)}
          </select>
          <div className="mt-2 flex items-center gap-1">
            <button type="button" className={btnPrimary} disabled={!pickPlanner || busy} onClick={onLink}>{busy ? 'Connecting…' : 'Connect'}</button>
            <button type="button" className={btnGhost} onClick={onSkip}>Not now</button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">Your planners are already connected to other journals, and those stay as they are.</p>
          <div className="flex items-center gap-1">
            <button type="button" className={btnPrimary} onClick={() => onCreate?.('planners')}>Create a planner</button>
            <button type="button" className={btnGhost} onClick={onSkip}>Not now</button>
          </div>
        </>
      )}
    </>
  )
}
