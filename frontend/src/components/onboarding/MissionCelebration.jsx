import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useGuidance } from '../../hooks/useGuidance'
import { useProfile } from '../../hooks/useProfile'
import { GUIDES } from '../../utils/guidance'
import { CheckIcon } from '../../utils/Icons.jsx'
import {
  finishMission,
  getMissionStatus,
  isMissionClosed,
  isMissionTrackerEnabled,
  subscribeMission,
} from '../../utils/missionTracker'
import { controlPrimary } from '../common/controlStyles'
import LoopIcon from '../tradingLoop/LoopIcon'
import { useModalA11y } from '../tradingLoop/useModalA11y'
import './missionProgress.css'

const DONE = [
  'A journal for your trades',
  'A planner for what you expect',
  'Planner connected to the journal',
  'Your first trade logged',
  'AI mentor feedback received',
]
const REQUEST_DELAY_MS = 500

export default function MissionCelebration() {
  const { profile } = useProfile()
  const username = profile?.username
  const enabled = isMissionTrackerEnabled()
  const status = useSyncExternalStore(subscribeMission, () => (username ? getMissionStatus(username) : null), () => null)
  const closed = useSyncExternalStore(subscribeMission, () => (username ? isMissionClosed(username) : true), () => true)
  const { activeId, request, release } = useGuidance()
  const waiting = enabled && Boolean(username) && status === 'complete' && !closed

  useEffect(() => {
    if (!waiting || activeId) return undefined
    const timer = setTimeout(() => request(GUIDES.MISSION_COMPLETE, { trigger: 'auto' }), REQUEST_DELAY_MS)
    return () => clearTimeout(timer)
  }, [waiting, activeId, request])

  useEffect(() => () => release(GUIDES.MISSION_COMPLETE), [release])

  if (!waiting || activeId !== GUIDES.MISSION_COMPLETE) return null
  return (
    <CompleteDialog
      onClose={() => {
        finishMission(username)
        release(GUIDES.MISSION_COMPLETE)
      }}
    />
  )
}

function CompleteDialog({ onClose }) {
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  useModalA11y(panelRef)

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true })
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose only calls stable functions
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-guide-surface=""
        aria-labelledby="mission-done-title"
        aria-describedby="mission-done-body"
        className="relative w-full max-w-md animate-[fadeIn_.2s_ease-out] overflow-hidden rounded-t-2xl border border-zinc-200 bg-white text-left text-zinc-900 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.5)] motion-reduce:animate-none sm:rounded-2xl dark:border-white/[0.12] dark:bg-panel-hi dark:text-zinc-100"
      >
        <div aria-hidden="true" className="flex gap-[3px] px-6 pt-5">
          {DONE.map((label) => <span key={label} className="mission-seg-on h-[5px] flex-1 rounded-full" />)}
        </div>

        <div className="px-6 pb-2 pt-6 text-center">
          <span className="mission-done-badge relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-sky-700/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
            <LoopIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-800 dark:text-sky-300">Setup complete · 5 of 5</p>
          <h2 id="mission-done-title" className="mt-1.5 text-xl font-semibold tracking-[-0.03em]">Your Trading Loop is running</h2>
          <p id="mission-done-body" className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            Plan before you trade, log what you did, and bring the mentor&apos;s findings back into your strategy. You don&apos;t need this guide any more.
          </p>
        </div>

        <ul className="mx-6 mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.10]">
          {DONE.map((label) => (
            <li key={label} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-zinc-800 dark:text-zinc-200">
              <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-sky-700 text-white dark:bg-sky-400 dark:text-zinc-950">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <div className="px-6 pb-6 pt-5">
          <button ref={buttonRef} type="button" onClick={onClose} className={`${controlPrimary} !h-10 w-full !text-sm`}>
            Continue to TradeCommit
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
