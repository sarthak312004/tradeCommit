import { lazy, Suspense, useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { journalContext, plannerContext } from '../../context/Context'
import { useGuidance } from '../../hooks/useGuidance'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useProfile } from '../../hooks/useProfile'
import { useTheme } from '../../hooks/useTheme'
import { saveDemoFlywheelState } from '../../services/profileApi'
import { todayKey } from '../../utils/calendar'
import { loadPlanForm, preloadPlanForm } from '../../utils/formLoaders'
import {
  completeDemoFlywheel,
  DEMO_FLYWHEEL_CHANGE_EVENT,
  DEMO_FLYWHEEL_REPLAY_EVENT,
  DEMO_FLYWHEEL_STATUS,
  DEMO_FLYWHEEL_STEP,
  getDemoFlywheelState,
  isDemoFlywheelRunnable,
  previousDemoFlywheelStep,
  restartDemoFlywheel,
  setDemoFlywheelStep,
  skipDemoFlywheel,
} from '../../utils/demoFlywheel'
import { GUIDES } from '../../utils/guidance'
import { CalendarIcon, ChevronsLeftIcon, CloseIcon, FileIcon, LogoutIcon, MenuIcon, MessageSquareIcon } from '../../utils/Icons.jsx'
import { showToast } from '../../utils/toastStore'
import ScrollFade from '../common/ScrollFade'
import TradeJournal from '../rightContainer/journal/TradeJournal'
import PlannerCalendar from '../rightContainer/planner/PlannerCalendar'
import PlannerJournalLink from '../rightContainer/planner/PlannerJournalLink'
import JournalCard from '../sidebar/JournalCard'
import PlannerCard from '../sidebar/PlannerCard'
import SidebarSection from '../sidebar/SidebarSection'
import { EASE, FADE_BASE, fade, ghostBtn } from '../sidebar/sidebarStyles'
import { ThemeSegmented } from '../sidebar/ThemeToggle'
import {
  buildDemoJournal,
  buildDemoPlanEntries,
  buildDemoReviewData,
  DEMO_MENTOR_PROGRESS,
  DEMO_PLANNER,
} from './demoData'
import DemoGuidePanel, { DemoHighlight } from './DemoGuidePanel'
import { DEMO_STEPS } from './demoSteps'

const PlanForm = lazy(loadPlanForm)

export default function DemoFlywheel() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { profile } = useProfile()
  const { activeId, suspended, request, release } = useGuidance()
  const { theme, setTheme } = useTheme()
  const [version, bump] = useReducer((value) => value + 1, 0)

  const [demoJournal, setDemoJournal] = useState(() => buildDemoJournal())
  const [demoPlanner, setDemoPlanner] = useState(() => ({ ...DEMO_PLANNER }))
  const [demoPlanEntries, setDemoPlanEntries] = useState(() => buildDemoPlanEntries())
  const [demoReviewData] = useState(() => buildDemoReviewData())
  const [plannerOpenedInStep, setPlannerOpenedInStep] = useState(false)
  const [planFormState, setPlanFormState] = useState(null)
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [mentorOpenedInStep, setMentorOpenedInStep] = useState(false)
  const [stageElement, setStageElement] = useState(null)
  const startedPendingRef = useRef(false)

  const username = profile?.username
  const todayKeyStr = useMemo(() => todayKey(), [])
  const active = activeId === GUIDES.DEMO_FLYWHEEL

  useEffect(() => {
    const onChange = (event) => {
      if (event.type === DEMO_FLYWHEEL_CHANGE_EVENT && event.detail?.username !== username?.toLowerCase()) return
      bump()
    }
    window.addEventListener(DEMO_FLYWHEEL_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(DEMO_FLYWHEEL_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [username])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` re-reads the saved state
  const saved = useMemo(() => getDemoFlywheelState(username) ?? profile?.demoFlywheel ?? null, [username, profile?.demoFlywheel, version])

  const runnable = isDemoFlywheelRunnable(saved)
  const stepId = runnable && DEMO_STEPS[saved?.step] ? saved.step : runnable ? DEMO_FLYWHEEL_STEP.JOURNAL : null

  const demoView = stepId === DEMO_FLYWHEEL_STEP.PLANNER && plannerOpenedInStep ? 'planner' : 'journal'
  const effectiveContextOpen = stepId === DEMO_FLYWHEEL_STEP.CONTEXT && isContextOpen
  const effectiveMentorOpen = stepId === DEMO_FLYWHEEL_STEP.NEXT_PLAN || (stepId === DEMO_FLYWHEEL_STEP.AI_MENTOR && mentorOpenedInStep)

  useEffect(() => {
    if (stepId === DEMO_FLYWHEEL_STEP.PLANNER && demoView === 'planner') preloadPlanForm()
  }, [stepId, demoView])

  const persistState = useCallback((nextLocalState) => {
    if (!nextLocalState || !username) return
    saveDemoFlywheelState({ status: nextLocalState.status, step: nextLocalState.step }).catch((error) => {
      console.error('Could not save flywheel demo progress:', error)
    })
  }, [username])

  // Auto-request the guidance controller when runnable for a newly onboarded user
  useEffect(() => {
    if (!username || !runnable || activeId) return undefined
    request(GUIDES.DEMO_FLYWHEEL, { trigger: 'auto' })
    return undefined
  }, [username, runnable, activeId, request])

  // Transition pending -> active once granted the screen
  useEffect(() => {
    if (!active) {
      startedPendingRef.current = false
      return
    }
    if (saved?.status === DEMO_FLYWHEEL_STATUS.PENDING && !startedPendingRef.current) {
      startedPendingRef.current = true
      persistState(setDemoFlywheelStep(username, stepId ?? DEMO_FLYWHEEL_STEP.JOURNAL))
    }
  }, [active, saved?.status, stepId, username, persistState])

  // Replay from ProfileMenu ("Replay flywheel demo")
  useEffect(() => {
    const onReplay = () => {
      if (!username || activeId) return
      setDemoJournal(buildDemoJournal())
      setDemoPlanner({ ...DEMO_PLANNER })
      setDemoPlanEntries(buildDemoPlanEntries())
      setPlanFormState(null)
      setPlannerOpenedInStep(false)
      setIsContextOpen(false)
      setMentorOpenedInStep(false)
      persistState(restartDemoFlywheel(username))
      request(GUIDES.DEMO_FLYWHEEL, { trigger: 'user' })
    }
    window.addEventListener(DEMO_FLYWHEEL_REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(DEMO_FLYWHEEL_REPLAY_EVENT, onReplay)
  }, [username, activeId, persistState, request])

  // Scroll the carry-forward block into view inside the mentor dialog on Step 5
  useEffect(() => {
    if (!active || stepId !== DEMO_FLYWHEEL_STEP.NEXT_PLAN || !effectiveMentorOpen) return undefined
    const timer = setTimeout(() => {
      const target = stageElement?.querySelector('[data-tour="carry-forward"]')
      target?.scrollIntoView({ block: 'center', inline: 'nearest' })
    }, 80)
    return () => clearTimeout(timer)
  }, [active, stepId, effectiveMentorOpen, stageElement])

  const baseStep = stepId ? DEMO_STEPS[stepId] : null
  const activeStep = useMemo(() => {
    if (!baseStep) return null
    if (stepId === DEMO_FLYWHEEL_STEP.CONTEXT && effectiveContextOpen) {
      return {
        ...baseStep,
        target: baseStep.openTarget,
        primaryLabel: baseStep.openPrimaryLabel,
      }
    }
    if (stepId === DEMO_FLYWHEEL_STEP.PLANNER && demoView === 'planner') {
      return {
        ...baseStep,
        target: planFormState ? baseStep.formTarget : baseStep.openTarget,
        placement: baseStep.openPlacement,
        sidebar: baseStep.openSidebar,
        primaryLabel: planFormState ? baseStep.formPrimaryLabel : baseStep.openPrimaryLabel,
        ...(planFormState ? {
          openTitle: baseStep.formTitle,
          openNow: baseStep.formNow,
          openBody: baseStep.formBody,
          openNext: baseStep.formNext,
          openNote: baseStep.formNote,
        } : {}),
      }
    }
    return baseStep
  }, [baseStep, stepId, effectiveContextOpen, demoView, planFormState])

  const isOpenState = Boolean(stepId && ((stepId === DEMO_FLYWHEEL_STEP.CONTEXT && effectiveContextOpen) || (stepId === DEMO_FLYWHEEL_STEP.PLANNER && demoView === 'planner')))
  const isMobileNavOpen = Boolean(isMobile && activeStep?.sidebar)

  const leaveDemo = useCallback((finalState) => {
    if (username && finalState) persistState(finalState)
    setPlannerOpenedInStep(false)
    setIsContextOpen(false)
    setMentorOpenedInStep(false)
    release(GUIDES.DEMO_FLYWHEEL)
    navigate('/')
  }, [username, persistState, release, navigate])

  const handleSkip = useCallback(() => {
    leaveDemo(username ? skipDemoFlywheel(username) : null)
  }, [leaveDemo, username])

  const handleFinish = useCallback(() => {
    leaveDemo(username ? completeDemoFlywheel(username) : null)
  }, [leaveDemo, username])

  const handleReplay = useCallback(() => {
    if (!username) return
    setDemoJournal(buildDemoJournal())
    setDemoPlanner({ ...DEMO_PLANNER })
    setDemoPlanEntries(buildDemoPlanEntries())
    setPlanFormState(null)
    setPlannerOpenedInStep(false)
    setIsContextOpen(false)
    setMentorOpenedInStep(false)
    persistState(restartDemoFlywheel(username))
  }, [username, persistState])

  const goToStep = useCallback((nextStep) => {
    if (!username || !nextStep) return
    setPlannerOpenedInStep(false)
    setPlanFormState(null)
    setIsContextOpen(false)
    setMentorOpenedInStep(false)
    persistState(setDemoFlywheelStep(username, nextStep))
  }, [username, persistState])

  const openDemoPlanForm = useCallback((date, entry = null) => {
    setPlanFormState({ date, entry })
  }, [])

  const handleSaveDemoPlan = useCallback(async (values) => {
    const currentEntry = planFormState?.entry
    const entryId = currentEntry?.id ?? `demo-plan-${Date.now()}`
    const savedEntry = {
      ...currentEntry,
      _id: entryId,
      id: entryId,
      planner: demoPlanner.id,
      date: values.date,
      scope: currentEntry?.scope ?? 'day',
      title: values.title,
      content: values.content,
      images: values.images ?? [],
    }
    setDemoPlanEntries((current) => (
      current.some((entry) => entry.id === entryId)
        ? current.map((entry) => (entry.id === entryId ? savedEntry : entry))
        : [...current, savedEntry]
    ))
    showToast({ message: 'Saved in demo', tone: 'success' })
    goToStep(DEMO_FLYWHEEL_STEP.AI_MENTOR)
  }, [demoPlanner.id, goToStep, planFormState])

  const handleSaveDemoContext = useCallback(async (nextContext, options) => {
    setDemoJournal((current) => ({
      ...current,
      mode: options?.mode ?? current.mode,
      context: {
        strategy: nextContext?.strategy ?? current.context.strategy,
        attributes: nextContext?.attributes ?? current.context.attributes,
      },
    }))
    showToast({ message: 'Saved in demo', tone: 'success' })
    setIsContextOpen(false)
    goToStep(DEMO_FLYWHEEL_STEP.PLANNER)
  }, [goToStep])

  const handlePrimary = useCallback(() => {
    if (!stepId) return
    if (stepId === DEMO_FLYWHEEL_STEP.JOURNAL) {
      goToStep(DEMO_FLYWHEEL_STEP.CONTEXT)
      return
    }
    if (stepId === DEMO_FLYWHEEL_STEP.CONTEXT) {
      if (!effectiveContextOpen) {
        setIsContextOpen(true)
      } else {
        showToast({ message: 'Saved in demo', tone: 'success' })
        setIsContextOpen(false)
        goToStep(DEMO_FLYWHEEL_STEP.PLANNER)
      }
      return
    }
    if (stepId === DEMO_FLYWHEEL_STEP.PLANNER) {
      if (demoView !== 'planner') {
        setPlannerOpenedInStep(true)
      } else if (planFormState) {
        stageElement?.querySelector('[data-tour="planner-save-plan"]')?.click()
      } else if (!planFormState) {
        const demoEntry = demoPlanEntries[0]
        openDemoPlanForm(demoEntry?.date ?? todayKeyStr, demoEntry ?? null)
      }
      return
    }
    if (stepId === DEMO_FLYWHEEL_STEP.AI_MENTOR) {
      goToStep(DEMO_FLYWHEEL_STEP.NEXT_PLAN)
      return
    }
    if (stepId === DEMO_FLYWHEEL_STEP.NEXT_PLAN) {
      goToStep(DEMO_FLYWHEEL_STEP.FINISH)
      return
    }
    if (stepId === DEMO_FLYWHEEL_STEP.FINISH) {
      handleFinish()
    }
  }, [stepId, effectiveContextOpen, demoView, goToStep, handleFinish, openDemoPlanForm, todayKeyStr, planFormState, demoPlanEntries, stageElement])

  const handleBack = useCallback(() => {
    if (!stepId) return
    const prev = previousDemoFlywheelStep(stepId)
    if (prev) goToStep(prev)
  }, [stepId, goToStep])

  // Advance when the user clicks the carry-forward target directly in step 5
  useEffect(() => {
    if (!active || !stageElement || !stepId) return undefined
    const handleStageClick = (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) return
      if (stepId === DEMO_FLYWHEEL_STEP.NEXT_PLAN && target.closest('[data-tour="carry-forward"]')) {
        goToStep(DEMO_FLYWHEEL_STEP.FINISH)
      }
    }
    stageElement.addEventListener('click', handleStageClick)
    return () => stageElement.removeEventListener('click', handleStageClick)
  }, [active, stageElement, stepId, goToStep])

  const handleKey = useEffectEvent((event) => {
    if (suspended || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target
    if (target instanceof HTMLElement && target !== document.body && !target.closest('[data-guide-card]')) return
    if (event.key === 'Escape') handleSkip()
    else if (event.key === 'ArrowRight') handlePrimary()
    else if (event.key === 'ArrowLeft') handleBack()
    else return
    event.preventDefault()
  })

  useEffect(() => {
    if (!active) return undefined
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [active])

  const demoJournalContextValue = useMemo(() => ({
    journals: [demoJournal],
    selectedJournalId: demoJournal.id,
    selectedJournal: demoJournal,
    isLoading: false,
    error: null,
    selectJournal: () => {
      if (stepId === DEMO_FLYWHEEL_STEP.JOURNAL) goToStep(DEMO_FLYWHEEL_STEP.CONTEXT)
    },
    createJournal: async () => demoJournal,
    updateJournal: async (_id, name) => {
      setDemoJournal((current) => ({ ...current, name }))
      showToast({ message: 'Saved in demo', tone: 'success' })
    },
    updateJournalContext: async (_id, context, options) => handleSaveDemoContext(context, options),
    updateJournalAutoLogState: () => {},
    deleteJournal: async () => {},
    addTrade: async () => null,
    importTrades: async () => ({ importedCount: 0 }),
    retryTrade: () => {},
    discardTrade: () => {},
    updateTrade: async () => {},
    deleteTrade: async () => {},
    uploadTradeImage: async () => '',
    refreshJournals: async () => {},
  }), [demoJournal, stepId, goToStep, handleSaveDemoContext])

  const demoPlannerContextValue = useMemo(() => ({
    planners: [demoPlanner],
    isLoading: false,
    error: null,
    createPlanner: async () => demoPlanner,
    updatePlanner: async (_id, changes) => {
      if ('linkedJournalId' in (changes ?? {})) {
        const linked = changes.linkedJournalId ? {
          id: demoJournal.id,
          name: demoJournal.name,
          icon: demoJournal.icon,
          currency: demoJournal.currency,
        } : null
        setDemoPlanner((current) => ({
          ...current,
          linkedJournalId: changes.linkedJournalId,
          linkedJournal: linked,
        }))
      }
      showToast({ message: 'Saved in demo', tone: 'success' })
      return demoPlanner
    },
    deletePlanner: async () => {},
    refreshPlanners: async () => {},
  }), [demoPlanner, demoJournal])

  const demoConfig = useMemo(() => ({
    mentorProgress: DEMO_MENTOR_PROGRESS,
    demoReview: demoReviewData,
    portalTarget: stageElement,
    isContextOpen: effectiveContextOpen,
    onContextOpenChange: (open) => {
      setIsContextOpen(open)
    },
    isMentorOpen: effectiveMentorOpen,
    onMentorOpenChange: (open) => {
      setMentorOpenedInStep(open)
      if (open && stepId === DEMO_FLYWHEEL_STEP.AI_MENTOR) {
        goToStep(DEMO_FLYWHEEL_STEP.NEXT_PLAN)
      }
    },
  }), [demoReviewData, stageElement, effectiveContextOpen, effectiveMentorOpen, stepId, goToStep])

  const isVisible = active || (runnable && !activeId)
  if (!isVisible || !activeStep || suspended) return null

  const demoToast = () => showToast({ message: 'Not available in the demo' })

  return (
    <journalContext.Provider value={demoJournalContextValue}>
      <plannerContext.Provider value={demoPlannerContextValue}>
        <div
          data-demo-stage=""
          aria-label="Flywheel demo workspace"
          className={`fixed inset-0 z-[45] flex ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden bg-canvas text-zinc-900 transition-colors duration-200 dark:bg-night dark:text-zinc-100`}
        >
          {/* Workspace: same layout as the real app. `contain: layout` keeps every dialog opened inside it
              (context, mentor, plan) within this box, so the explanation panel beside it is never covered. */}
          <div ref={setStageElement} className="relative flex min-h-0 min-w-0 flex-1 [contain:layout] overflow-hidden">
            <div className="pointer-events-none absolute left-1/2 top-2 z-[88] -translate-x-1/2">
              <span
                data-tour="demo-badge"
                className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-white/95 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-900 shadow-sm backdrop-blur-sm dark:border-sky-400/30 dark:bg-panel/95 dark:text-sky-300"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                Demo data · nothing is saved
              </span>
            </div>

            {isMobile && (
              <div
                aria-hidden="true"
                className={`absolute inset-0 z-[35] bg-black/40 transition-opacity duration-300 motion-reduce:transition-none ${isMobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              />
            )}

            {/* Same sidebar as the real app (classes, sections, footer), driven by demo data */}
            <aside
              aria-label="Demo sidebar"
              inert={isMobile && !isMobileNavOpen}
              className={
                isMobile
                  ? `absolute inset-y-0 z-40 flex w-[260px] flex-col overflow-hidden border-r border-zinc-600/40 bg-sidebar transition-[left,visibility] duration-300 ${EASE} motion-reduce:transition-none dark:border-white/[0.10] dark:bg-side ${isMobileNavOpen ? 'visible left-0 shadow-2xl' : 'invisible -left-[264px]'}`
                  : `relative flex w-[260px] shrink-0 flex-col overflow-hidden border-r border-zinc-600/40 bg-sidebar dark:border-white/[0.10] dark:bg-side`
              }
            >
              <div className="flex h-12 shrink-0 items-center">
                <div className="flex w-[260px] shrink-0 items-center justify-between pl-[10px] pr-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                      <img src="/favicon.svg" alt="" className="h-6 w-6 object-contain" />
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium text-zinc-800 dark:text-zinc-100">TradeCommit</span>
                  </div>
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center text-zinc-700 dark:text-zinc-300">
                    {isMobile ? <CloseIcon className="h-4 w-4" /> : <ChevronsLeftIcon className="h-4 w-4" />}
                  </span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <SidebarSection
                  title="Journals"
                  tourId="sidebar-journals"
                  addLabel="New journal"
                  isSidebarOpen
                  setIsSidebarOpen={() => {}}
                  isFormOpen={false}
                  onFormOpenChange={demoToast}
                  renderForm={() => null}
                  railIcon={FileIcon}
                  railItems={[]}
                  isEmpty={false}
                  emptyText="No journals yet."
                >
                  <div data-tour="demo-journal-row">
                    <JournalCard
                      journal={demoJournal}
                      isSelected={demoView === 'journal'}
                      onSelect={() => {
                        setPlannerOpenedInStep(false)
                        if (stepId === DEMO_FLYWHEEL_STEP.JOURNAL) goToStep(DEMO_FLYWHEEL_STEP.CONTEXT)
                      }}
                    />
                  </div>
                </SidebarSection>

                <div className="mx-3 shrink-0 border-t border-zinc-300 dark:border-white/[0.10]" />

                <SidebarSection
                  title="Trade planner"
                  tourId="sidebar-planners"
                  addLabel="New trade planner"
                  isSidebarOpen
                  setIsSidebarOpen={() => {}}
                  isFormOpen={false}
                  onFormOpenChange={demoToast}
                  renderForm={() => null}
                  railIcon={CalendarIcon}
                  railItems={[]}
                  isEmpty={false}
                  emptyText="No planners yet."
                >
                  <div data-tour="demo-planner-row">
                    <PlannerCard
                      planner={demoPlanner}
                      isSelected={demoView === 'planner'}
                      onSelect={() => setPlannerOpenedInStep(true)}
                    />
                  </div>
                </SidebarSection>
              </div>

              <div className="relative h-[164px] shrink-0 border-t border-zinc-300 dark:border-white/[0.10]">
                <div className={`absolute inset-y-0 left-0 flex w-[260px] flex-col justify-center gap-1 px-2 ${FADE_BASE} ${fade(true)}`}>
                  <div className="flex h-8 items-center justify-between px-2">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Theme</span>
                    <ThemeSegmented theme={theme} setTheme={setTheme} />
                  </div>
                  <button type="button" onClick={demoToast} className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] ${ghostBtn}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 5h3v3" />
                    </svg>
                    <span className="truncate">Market research</span>
                  </button>
                  <button type="button" onClick={demoToast} className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] ${ghostBtn}`}>
                    <MessageSquareIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">Feedback &amp; bugs</span>
                  </button>
                  <button type="button" onClick={demoToast} className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] ${ghostBtn}`}>
                    <LogoutIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">Log out</span>
                  </button>
                </div>
              </div>
            </aside>

            <main className="tc-ambient flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {/* same header as the real TopBar */}
              <header className="relative z-30 flex min-h-[64px] items-center justify-between gap-2 border-b border-zinc-300 bg-white/70 px-3 py-3 shadow-sm sm:min-h-[72px] sm:gap-4 sm:px-6 dark:border-white/[0.10] dark:bg-panel dark:shadow-none">
                <div className="relative flex min-w-0 items-center gap-1.5">
                  {isMobile && (
                    <span aria-hidden="true" className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-800 dark:text-zinc-100">
                      <MenuIcon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium uppercase leading-4 tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
                      {demoView === 'journal' ? 'Journal' : `Trade planner · ${demoPlanner.type}`}
                    </p>
                    <h1 className="mt-0.5 truncate text-xl font-semibold leading-8 tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
                      {demoView === 'journal' ? demoJournal.name : demoPlanner.name}
                    </h1>
                  </div>
                </div>
              </header>

              {demoView === 'journal' ? (
                <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
                  <TradeJournal
                    key={demoJournal.id}
                    view="trades"
                    journal={demoJournal}
                    journals={[demoJournal]}
                    onAddTrade={async () => null}
                    onUpdateTrade={async () => {}}
                    onDeleteTrade={async () => {}}
                    onUploadTradeImage={async () => ''}
                    onSaveContext={(_id, context, options) => handleSaveDemoContext(context, options)}
                    demoConfig={demoConfig}
                  />
                </ScrollFade>
              ) : (
                <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName="subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
                  <div className="mb-4 flex flex-wrap items-center gap-2.5">
                    <PlannerJournalLink planner={demoPlanner} />
                  </div>
                  <PlannerCalendar
                    entries={demoPlanEntries}
                    tourEntryId={stepId === DEMO_FLYWHEEL_STEP.PLANNER ? demoPlanEntries[0]?.id : null}
                    onCreateForDate={() => showToast({ message: 'Open the highlighted demo plan to continue.' })}
                    onOpenEntry={(entry) => openDemoPlanForm(entry.date, entry)}
                  />
                </ScrollFade>
              )}
              {demoView === 'planner' && planFormState && (
                <Suspense fallback={null}>
                  <PlanForm
                    plannerId={demoPlanner.id}
                    plannerName={demoPlanner.name}
                    plannerType={demoPlanner.type}
                    draftKey={`tradecommit:demo-plan-form:${username}:${planFormState.entry?.id ?? planFormState.date}`}
                    initialEntry={planFormState.entry}
                    initialDate={planFormState.date}
                    onSubmit={handleSaveDemoPlan}
                    onClose={() => setPlanFormState(null)}
                    onUploadImage={async () => ''}
                    guideOverlayActive
                    tourSaveTarget={stepId === DEMO_FLYWHEEL_STEP.PLANNER}
                  />
                </Suspense>
              )}
            </main>
          </div>

          <DemoGuidePanel
            stepId={stepId}
            step={activeStep}
            isOpenState={isOpenState}
            isMobile={isMobile}
            canGoBack={Boolean(previousDemoFlywheelStep(stepId))}
            onPrimary={handlePrimary}
            onBack={handleBack}
            onSkip={handleSkip}
            onSecondary={activeStep.secondaryLabel ? handleReplay : null}
            onJump={goToStep}
          />
        </div>
      </plannerContext.Provider>

      <DemoHighlight selector={activeStep.target} />
    </journalContext.Provider>
  )
}
