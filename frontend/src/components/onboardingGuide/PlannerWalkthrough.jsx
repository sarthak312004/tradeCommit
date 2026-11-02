import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { journalContext } from '../../context/Context'
import { useGuidance } from '../../hooks/useGuidance'
import { useProfile } from '../../hooks/useProfile'
import { savePlannerWalkthroughState } from '../../services/profileApi'
import { GUIDES } from '../../utils/guidance'
import { GUIDE_CHANGE_EVENT, getGuideState } from '../../utils/onboardingGuide'
import {
  getNextPlannerWalkthroughStep,
  isPlannerWalkthroughRunnable,
  PLANNER_WALKTHROUGH_INTERACTION_EVENT,
  PLANNER_WALKTHROUGH_STEPS,
} from '../../utils/plannerWalkthrough'
import GuideSurface from './GuideSurface'
import { useTargetRect } from './useTargetRect'

const START_DELAY_MS = 700
const at = (id) => `[data-tour="${id}"]`

const STEPS = Object.freeze({
  connection: {
    target: at('planner-journal'),
    placement: 'bottom',
    interactive: true,
    title: 'Connect a journal to your Planner',
    body: 'Linking a journal lets the AI Mentor compare what you planned with the trades you actually took. A missed or skipped plan is not treated as a mistake.',
    note: 'This connection is optional and can be changed at any time.',
    primaryLabel: 'Continue',
  },
  'open-plan': {
    target: at('planner-open-plan'),
    placement: 'bottom',
    interactive: true,
    title: 'Open a plan from the calendar',
    body: 'Click this date to open the plan editor. The next tour steps will start once the form is open.',
    note: 'Click today’s highlighted date to start a plan for today.',
    primaryLabel: 'Click the date',
    primaryDisabled: true,
  },
  'deep-mode': {
    target: at('planner-deep-mode'),
    placement: 'left',
    interactive: true,
    title: 'Use Deep Mode for a focused planning session',
    body: 'Turn on Deep Focus when you want a quieter workspace. It adds the focus tint and access to the timer and music controls while you plan.',
    note: 'Deep Focus is optional; turn it on or off whenever it suits you.',
    primaryLabel: 'Continue',
  },
  'quick-plan': {
    target: at('planner-quick-plan'),
    placement: 'bottom',
    interactive: true,
    title: 'Build a Quick Plan',
    body: 'Start with an optional template, choose a bias, and jot down the setup, levels, entry and invalidation. The fields are optional and are saved as a regular plan.',
    primaryLabel: 'Continue',
  },
  'full-editor': {
    target: at('planner-full-editor'),
    placement: 'bottom',
    interactive: true,
    title: 'Switch to the Full Editor when you need more room',
    body: 'Use the rich-text editor for open-ended notes, formatted details and screenshots. You can move between modes when the plan is still empty.',
    note: 'Quick Plan and Full Editor save into the same plan format.',
    primaryLabel: 'Finish tour',
  },
})

const isTerminalMainGuide = (profile) => {
  const state = getGuideState(profile?.username) ?? profile?.onboardingGuide
  return !state || state.status === 'completed' || state.status === 'skipped'
}

function PlannerWalkthrough({ plannerId, isPlanOpen, onOpenPlan, onActiveChange }) {
  const { profile } = useProfile()
  const { journals, isLoading: journalsLoading } = useContext(journalContext)
  const { activeId, modalOpen, request, release } = useGuidance()
  const [savedWalkthrough, setSavedWalkthrough] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [guideVersion, bumpGuideVersion] = useReducer((version) => version + 1, 0)
  const startedRef = useRef(false)

  useEffect(() => {
    const resetWalkthrough = () => {
      setSavedWalkthrough(null)
      startedRef.current = false
    }
    window.addEventListener('auth-state-changed', resetWalkthrough)
    return () => window.removeEventListener('auth-state-changed', resetWalkthrough)
  }, [])

  useEffect(() => {
    const handleGuideChange = (event) => {
      if (event.detail?.username !== profile?.username?.toLowerCase()) return
      bumpGuideVersion()
    }
    window.addEventListener(GUIDE_CHANGE_EVENT, handleGuideChange)
    return () => window.removeEventListener(GUIDE_CHANGE_EVENT, handleGuideChange)
  }, [profile?.username])

  const serverWalkthrough = profile?.plannerWalkthrough
  const localUpdatedAt = Date.parse(savedWalkthrough?.updatedAt ?? '') || 0
  const serverUpdatedAt = Date.parse(serverWalkthrough?.updatedAt ?? '') || 0
  const walkthrough = savedWalkthrough?.plannerId === plannerId && localUpdatedAt > serverUpdatedAt
    ? savedWalkthrough
    : serverWalkthrough
  const runnable = isPlannerWalkthroughRunnable(walkthrough, plannerId)
  const stepId = runnable && STEPS[walkthrough.step] ? walkthrough.step : null
  const baseStep = stepId ? STEPS[stepId] : null
  const active = activeId === GUIDES.PLANNER_WALKTHROUGH
  const hasJournal = journals.some((journal) => !String(journal.id).startsWith('pending-'))
  const step = stepId === 'connection' && !hasJournal
    ? {
        ...baseStep,
        interactive: false,
        body: 'A Planner can be connected to a journal so the AI Mentor can compare plans with trades. Create a journal first; you can connect it here later.',
        note: 'This connection is optional and can be changed at any time.',
      }
    : baseStep
  const ready = Boolean(profile?.username) && !journalsLoading

  const persist = useCallback(async (status, step) => {
    try {
      const saved = await savePlannerWalkthroughState({ plannerId, status, step })
      setSavedWalkthrough(saved)
      setSaveError('')
      return saved
    } catch (error) {
      console.error('Could not save Planner walkthrough progress:', error)
      setSaveError(error.message || 'Could not save Planner walkthrough progress. Check your connection and try again.')
      return null
    }
  }, [plannerId])

  const goToStep = useCallback(async (nextStep) => {
    if (!nextStep) return
    await persist('in_progress', nextStep)
  }, [persist])

  const finish = useCallback(async (status) => {
    const saved = await persist(status, stepId ?? 'full-editor')
    if (saved) release(GUIDES.PLANNER_WALKTHROUGH)
  }, [persist, release, stepId])

  useEffect(() => {
    if (!runnable || !ready || !isTerminalMainGuide(profile) || activeId || modalOpen) return undefined
    const timer = setTimeout(() => request(GUIDES.PLANNER_WALKTHROUGH, { trigger: 'user' }), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [runnable, ready, profile, activeId, modalOpen, request, guideVersion])

  useEffect(() => {
    if (!active || walkthrough?.status !== 'pending' || startedRef.current) return
    startedRef.current = true
    persist('in_progress', walkthrough.step).then((saved) => {
      if (!saved) startedRef.current = false
    })
  }, [active, persist, walkthrough?.status, walkthrough?.step])

  useEffect(() => {
    onActiveChange(active, active ? stepId : null)
  }, [active, onActiveChange, stepId])

  useEffect(() => {
    if (active && stepId !== 'connection' && stepId !== 'open-plan' && !isPlanOpen) onOpenPlan()
  }, [active, isPlanOpen, onOpenPlan, stepId])

  useEffect(() => {
    if (active && !runnable) release(GUIDES.PLANNER_WALKTHROUGH)
  }, [active, runnable, release])

  const next = getNextPlannerWalkthroughStep(stepId)
  const previous = PLANNER_WALKTHROUGH_STEPS[PLANNER_WALKTHROUGH_STEPS.indexOf(stepId) - 1] ?? null
  const onPrimary = useCallback(
    () => stepId === 'open-plan' ? undefined : next ? goToStep(next) : finish('completed'),
    [finish, goToStep, next, stepId]
  )
  const onBack = useCallback(() => previous && goToStep(previous), [goToStep, previous])
  const onSkip = useCallback(() => finish('skipped'), [finish])

  useEffect(() => {
    if (!active || !stepId) return undefined
    const handleInteraction = (event) => {
      if (event.detail?.step !== stepId) return
      if (stepId === 'full-editor') finish('completed')
      else if (next) goToStep(next)
    }
    window.addEventListener(PLANNER_WALKTHROUGH_INTERACTION_EVENT, handleInteraction)
    return () => window.removeEventListener(PLANNER_WALKTHROUGH_INTERACTION_EVENT, handleInteraction)
  }, [active, finish, goToStep, next, stepId])

  useEffect(() => {
    if (!active) return undefined
    const handleKey = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && target !== document.body && !target.closest('[data-guide-card]')) return
      if (event.key === 'Escape') onSkip()
      else if (event.key === 'ArrowRight') onPrimary()
      else if (event.key === 'ArrowLeft' && previous) onBack()
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [active, onPrimary, onBack, onSkip, previous])

  const { rect, status: targetStatus } = useTargetRect(active && step ? step.target : null, stepId ?? 'none')
  const progressIndex = useMemo(() => PLANNER_WALKTHROUGH_STEPS.indexOf(stepId), [stepId])

  if (!active || !step) return null

  return (
    <GuideSurface
      stepId={stepId}
      step={step}
      rect={targetStatus !== 'missing' && rect ? rect : null}
      interactive={step.interactive}
      canGoBack={Boolean(previous && stepId !== 'deep-mode')}
      onPrimary={onPrimary}
      onBack={onBack}
      onSkip={onSkip}
      progressSteps={PLANNER_WALKTHROUGH_STEPS}
      progressIndex={progressIndex}
      stageLabel="Planner feature walkthrough"
      error={saveError}
      primaryDisabled={step?.primaryDisabled}
    />
  )
}

export default PlannerWalkthrough
