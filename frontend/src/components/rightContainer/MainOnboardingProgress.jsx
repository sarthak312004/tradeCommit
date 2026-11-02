import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { getOnboardingWorkflowProgress } from '../../utils/onboardingProgress'
import './mainOnboardingProgress.css'

const COMPLETION_NOTICE_PREFIX = 'tradecommit:onboarding-workflow-completion:v1:'
const NOTICE_DURATION_MS = 8000

const noticeKey = (username, completedAt) => (
  `${COMPLETION_NOTICE_PREFIX}${username}:${completedAt || 'complete'}`
)

const hasSeenNotice = (key) => {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

const markNoticeSeen = (key) => {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Keep the notice available for this session if storage is disabled.
  }
}

function MainOnboardingProgress({ contrast = false }) {
  const { profile } = useProfile()
  const progress = getOnboardingWorkflowProgress(profile?.onboardingGuide)
  const [completionNoticeKey, setCompletionNoticeKey] = useState(null)
  const previous = useRef({ username: null, complete: false })
  const username = profile?.username?.toLowerCase() ?? null
  const completedAt = profile?.onboardingGuide?.workflowCompletedAt
  const currentNoticeKey = username ? noticeKey(username, completedAt) : null
  const showCompletionNotice = progress.isComplete && completionNoticeKey === currentNoticeKey

  useEffect(() => {
    let transitionTimer
    if (!username) {
      previous.current = { username: null, complete: false }
      return undefined
    }

    const sameAccount = previous.current.username === username
    if (sameAccount && !previous.current.complete && progress.isComplete) {
      const key = noticeKey(username, completedAt)
      if (!hasSeenNotice(key)) {
        transitionTimer = setTimeout(() => {
          previous.current = { username, complete: true }
          setCompletionNoticeKey(key)
        }, 0)
      }
      return () => clearTimeout(transitionTimer)
    }

    previous.current = { username, complete: progress.isComplete }
    return undefined
  }, [username, completedAt, progress.isComplete])

  useEffect(() => {
    if (!showCompletionNotice) return undefined
    const timer = setTimeout(() => {
      markNoticeSeen(currentNoticeKey)
      setCompletionNoticeKey(null)
    }, NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [showCompletionNotice, currentNoticeKey])

  if (!progress.visible && !showCompletionNotice) return null

  return (
    <>
      {progress.visible && (
        <div className="group relative flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-1 shadow-[0_3px_10px_-2px_rgb(24_24_27/0.4),0_1px_2px_rgb(24_24_27/0.2)] backdrop-blur-sm dark:border-white/15 dark:bg-[#202220] dark:shadow-[0_2px_10px_-2px_rgb(0_0_0/0.7)] sm:gap-2 sm:px-2.5">
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-white sm:text-[10px] sm:tracking-[0.1em]">
            <span className="sm:hidden">Flow</span>
            <span className="hidden sm:inline">Workflow</span>
          </span>
          <button
            type="button"
            aria-label={`Onboarding workflow progress: ${progress.completed} of ${progress.total} actions complete. Focus or hover for details.`}
            aria-describedby="main-onboarding-progress-details"
            className={`flex h-5 w-[68px] items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:w-[84px] ${
              contrast ? 'focus-visible:ring-white' : 'dark:focus-visible:ring-sky-400'
            }`}
          >
            <span className="relative block h-[5px] w-full overflow-hidden rounded-full bg-white shadow-inner shadow-black/20">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-sky-500 shadow-[0_0_6px_rgb(14_165_233/0.55)] transition-[width] duration-500 ease-out dark:bg-sky-400"
                style={{ width: `${progress.fraction * 100}%` }}
              />
            </span>
          </button>
          <span aria-hidden="true" className="min-w-[19px] text-right text-[9px] font-medium tabular-nums text-white/80">
            {progress.completed}/{progress.total}
          </span>
          <div
            id="main-onboarding-progress-details"
            role="tooltip"
            className="pointer-events-none invisible absolute right-0 top-full z-[80] mt-2 w-64 rounded-xl border border-white/10 bg-[#181a18] p-3 text-white opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
              Your trading workflow
            </p>
            <ol className="space-y-2">
              {progress.stages.map((stage) => {
                const current = stage.id === progress.currentStage
                const stageDone = stage.requiredActions.filter((action) => action.completed).length
                const stageCount = stage.requiredActions.length
                const nextActionId = stage.requiredActions.find((action) => !action.completed)?.id
                return (
                  <li key={stage.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold tracking-[0.12em]">{stage.label}</span>
                      <span className={`text-[9px] ${stage.completed ? 'text-sky-300' : current ? 'text-white' : 'text-white/40'}`}>
                        {stage.completed ? 'Complete' : stageDone ? `${stageDone}/${stageCount} done` : current ? 'In progress' : 'Upcoming'}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-1">
                      {stage.requiredActions.map((action) => (
                        <li key={action.id} className={`flex items-center gap-2 text-[10px] ${action.completed ? 'text-sky-200' : 'text-white/60'}`}>
                          <span
                            aria-hidden="true"
                            className={`grid h-3 w-3 shrink-0 place-items-center rounded-full border text-[8px] leading-none ${
                              action.completed
                                ? 'border-sky-400 bg-sky-400 text-zinc-950'
                                : current && action.id === nextActionId
                                  ? 'border-white/60 text-white'
                                  : 'border-white/25 text-transparent'
                            }`}
                          >
                            {action.completed ? '✓' : ''}
                          </span>
                          <span>{action.label}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}
      {showCompletionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="onboarding-completion-toast fixed right-3 top-20 z-[85] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-emerald-200 bg-white p-4 text-zinc-900 shadow-[0_16px_44px_-14px_rgb(24_24_27/0.32),0_3px_10px_-4px_rgb(24_24_27/0.18)] dark:border-emerald-400/20 dark:bg-panel dark:text-zinc-100 dark:shadow-[0_18px_48px_-16px_rgb(0_0_0/0.8)] sm:right-5"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                Workflow complete
              </p>
              <p className="mt-1 text-[13px] leading-5 text-zinc-700 dark:text-zinc-300">
                You completed Plan, Journal, and Feedback. Great work building a consistent trading routine.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                markNoticeSeen(currentNoticeKey)
                setCompletionNoticeKey(null)
              }}
              aria-label="Dismiss workflow completion message"
              className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-lg leading-none text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default MainOnboardingProgress
