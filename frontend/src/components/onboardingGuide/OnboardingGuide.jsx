import { useCallback, useContext, useEffect, useEffectEvent, useMemo, useReducer } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { journalContext, plannerContext } from '../../context/Context'
import { useProfile } from '../../hooks/useProfile'
import { useGuidance } from '../../hooks/useGuidance'
import { GUIDES } from '../../utils/guidance'
import { getOnboardingWorkflowProgress } from '../../utils/onboardingProgress'
import { saveOnboardingGuideState } from '../../services/profileApi'
import {
  GUIDE_CHANGE_EVENT,
  GUIDE_REPLAY_EVENT,
  GUIDE_STATUS,
  GUIDE_STEP,
  completeOnboardingGuide,
  getGuideState,
  isGuideRunnable,
  isJournalStep,
  nextGuideStep,
  previousGuideStep,
  resolveGuideStep,
  restartOnboardingGuide,
  setGuideStep,
  skipOnboardingGuide,
} from '../../utils/onboardingGuide'
import GuideSurface from './GuideSurface'
import { GUIDE_STEPS } from './guideSteps'
import { useTargetRect } from './useTargetRect'

const START_DELAY_MS = 700 // let the page settle before the first card appears
const isPending = (journal) => String(journal.id).startsWith('pending-')
const onJournalPage = (pathname) => !pathname.startsWith('/planner/') && pathname !== '/market-research'

/**
 * The guided onboarding: PLAN -> JOURNAL -> AI FEEDBACK as ONE continuous walkthrough (see utils/onboardingGuide.js for the
 * steps, persistence and completion rules). Mounted once by Home, inside the guidance controller, which makes sure it never
 * overlaps another guide or an open form.
 *
 *   - starts by itself only for an account that was queued at the end of onboarding (nobody else is ever pulled in);
 *   - "Take the guided tour" in the profile menu replays it on demand;
 *   - progress is saved on every step, so a refresh resumes where the user was;
 *   - it follows the user: creating the journal moves it on and shows the journal.
 */
export default function OnboardingGuide({ isNavOpen, setNavOpen, autoCloseNav = false, openCreateForm }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { journals, isLoading: journalsLoading } = useContext(journalContext)
  const plannersLoading = useContext(plannerContext)?.isLoading
  const { activeId, suspended, request, release } = useGuidance()
  const [version, bump] = useReducer((value) => value + 1, 0)

  const username = profile?.username
  const active = activeId === GUIDES.ONBOARDING
  const workflowProgress = useMemo(
    () => getOnboardingWorkflowProgress(profile?.onboardingGuide),
    [profile?.onboardingGuide]
  )

  // re-read the saved state whenever it changes (this tab, or another one)
  useEffect(() => {
    const onChange = (event) => {
      if (event.type === GUIDE_CHANGE_EVENT && event.detail?.username !== username?.toLowerCase()) return
      bump()
    }
    window.addEventListener(GUIDE_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(GUIDE_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [username])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` re-reads the saved state
  const saved = useMemo(() => getGuideState(username), [username, version])

  const facts = useMemo(
    () => ({
      hasJournal: journals.some((journal) => !isPending(journal)),
      hasTrades: journals.some((journal) => (journal.trades?.length ?? 0) > 0),
    }),
    [journals]
  )
  const ready = Boolean(username) && !journalsLoading && !plannersLoading
  const resolved = useMemo(() => (ready && saved ? resolveGuideStep(saved, facts) : null), [ready, saved, facts])
  const runnable = isGuideRunnable(resolved)
  const stepId = runnable ? resolved.step : null
  const step = stepId ? GUIDE_STEPS[stepId] : null

  const persistState = useCallback((state) => {
    if (!state || !username) return
    saveOnboardingGuideState(state).catch((error) => {
      console.error('Could not save onboarding guide progress:', error)
    })
  }, [username])

  // keep the saved state in line with what the user did (journal created, journal deleted, guide no longer needed)
  useEffect(() => {
    if (!resolved || !saved) return
    if (resolved.status === GUIDE_STATUS.COMPLETED && saved.status !== GUIDE_STATUS.COMPLETED) {
      persistState(completeOnboardingGuide(username))
    } else if (isGuideRunnable(resolved) && (resolved.step !== saved.step || (active && saved.status === GUIDE_STATUS.PENDING))) {
      persistState(setGuideStep(username, resolved.step))
    }
  }, [resolved, saved, username, active, persistState])

  // ask to start: only a queued (or replayed) guide. The controller decides: one guide at a time, nothing while a form is open.
  useEffect(() => {
    if (!runnable || activeId) return undefined
    const timer = setTimeout(() => request(GUIDES.ONBOARDING, { trigger: 'auto' }), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [runnable, activeId, request])

  // finished, skipped or no longer needed: give the screen back
  useEffect(() => {
    if (active && ready && !runnable) release(GUIDES.ONBOARDING)
  }, [active, ready, runnable, release])

  // "Take the guided tour" in the profile menu
  useEffect(() => {
    const replay = () => {
      if (!username || activeId) return // a guide is already on screen: never interrupt it
      persistState(restartOnboardingGuide(username))
      request(GUIDES.ONBOARDING, { trigger: 'user' })
    }
    window.addEventListener(GUIDE_REPLAY_EVENT, replay)
    return () => window.removeEventListener(GUIDE_REPLAY_EVENT, replay)
  }, [username, activeId, persistState, request])

  // the journal steps live on the journal page: creating the journal (or a refresh) brings the user there
  useEffect(() => {
    if (active && runnable && isJournalStep(stepId) && !onJournalPage(pathname)) navigate('/')
  }, [active, runnable, stepId, pathname, navigate])

  // steps that point into the sidebar need it open; on phones it is a menu on top of the page, so it is put away for the rest
  useEffect(() => {
    if (!active || !step) return
    if (step.sidebar && !isNavOpen) setNavOpen(true)
    else if (autoCloseNav && !step.sidebar && isNavOpen) setNavOpen(false)
  }, [active, step, isNavOpen, setNavOpen, autoCloseNav])

  const { rect, status: targetStatus } = useTargetRect(active && step ? step.target : null, stepId ?? 'none')

  const skip = () => {
    if (username) persistState(skipOnboardingGuide(username))
  }
  const goNext = () => {
    const next = nextGuideStep(stepId)
    if (next) persistState(setGuideStep(username, next))
    else persistState(completeOnboardingGuide(username))
  }
  const goBack = () => {
    const previous = previousGuideStep(stepId)
    if (previous) persistState(setGuideStep(username, previous))
  }
  const onPrimary = () => {
    if (step.primary === 'create-journal') openCreateForm?.('journals')
    else if (step.primary === 'finish') persistState(completeOnboardingGuide(username))
    else goNext()
  }

  // Escape puts the guide away. Only when focus is on the card or the page itself, so Escape in a form field keeps its own meaning.
  const handleKey = useEffectEvent((event) => {
    if (suspended || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target
    if (target instanceof HTMLElement && target !== document.body && !target.closest('[data-guide-card]')) return
    if (event.key === 'Escape') skip()
    else if (event.key === 'ArrowRight' && step?.primary !== 'create-journal') goNext()
    else if (event.key === 'ArrowLeft') goBack()
    else return
    event.preventDefault()
  })
  useEffect(() => {
    if (!active) return undefined
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [active])

  if (!active || !step || suspended) return null

  // an element that never showed up must not strand the user: the card simply appears without its connector
  const anchored = targetStatus !== 'missing' && rect

  return (
    <GuideSurface
      stepId={stepId}
      step={step}
      rect={anchored ? rect : null}
      interactive={step.interactive}
      waiting={stepId === GUIDE_STEP.CREATE_JOURNAL && journals.some(isPending)}
      canGoBack={Boolean(previousGuideStep(stepId))}
      onPrimary={onPrimary}
      onBack={goBack}
      onSkip={skip}
      stageOverride={workflowProgress.currentStage ?? 'feedback'}
      stageProgress={workflowProgress.stages}
    />
  )
}
