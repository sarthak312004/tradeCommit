import { useEffect, useState, useSyncExternalStore } from 'react'
import { useGuidance } from '../../hooks/useGuidance'
import { useProfile } from '../../hooks/useProfile'
import { GUIDES } from '../../utils/guidance'
import {
  OPEN_TRADING_LOOP_EVENT,
  clearLoopProgress,
  getLoopProgress,
  getLoopStatus,
  isTradingLoopEnabled,
  setLoopProgress,
  setLoopStatus,
  subscribeLoopStatus,
} from '../../utils/tradingLoop'
import LoopIcon from './LoopIcon'
import TradingLoopDialog from './TradingLoopDialog'
import { SCENES } from './scenes'

const START_DELAY_MS = 600 // let the workspace paint first

// A loop that was opened by itself must not open again by itself in this tab, even if storage refused to remember it.
const autoStarted = new Set()

const validSceneId = (id) => (SCENES.some((scene) => scene.id === id) ? id : SCENES[0].id)

/**
 * The Trading Loop's side of the guidance controller. Mounted once by Home. It never decides on its own whether it may be on
 * screen: it ASKS the controller (useGuidance) and renders only while the controller says it owns the screen.
 *
 *  - Asks by itself only when ALL hold: the rollout switch is on and this account was queued by onboarding (status 'pending').
 *    The controller also holds the request back while a form is open and refuses it while another guide is active.
 *    Every existing account has no status, so nothing is ever requested for them.
 *  - Close (X / Esc) snoozes: progress is kept and a small "Resume" pill appears instead of re-opening by itself.
 *  - Skip and Finish mark it done.
 *  - openTradingLoop() (profile menu) replays it from the start without touching the stored status;
 *    openTradingLoop({ resume: true }) (MissionTracker) continues a pending/snoozed onboarding.
 *  - The Playbook is reached through the loop's own header button: the loop pauses, the Playbook opens, the loop resumes.
 */
export default function TradingLoopExperience({ onComplete }) {
  const { profile } = useProfile()
  const username = profile?.username
  const enabled = isTradingLoopEnabled()
  const status = useSyncExternalStore(subscribeLoopStatus, () => getLoopStatus(username), () => null)
  const { activeId, activeTrigger, activeMeta, activeSeq, pausedId, suspended, request, release, handoff } = useGuidance()
  const [lastScene, setLastScene] = useState({ seq: 0, id: null }) // survives a pause (playbook, form) so the loop comes back where it was

  const isActive = activeId === GUIDES.LOOP
  const persist = isActive && activeMeta?.mode === 'onboarding'

  // ask by itself, once, for a freshly onboarded account
  useEffect(() => {
    if (!enabled || !username || activeId || pausedId || status !== 'pending' || autoStarted.has(username)) return undefined
    const timer = setTimeout(() => {
      request(GUIDES.LOOP, { trigger: 'auto', meta: { mode: 'onboarding', startId: validSceneId(getLoopProgress(username)) } })
    }, START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [enabled, username, activeId, pausedId, status, request])

  // granted by itself: never again by itself in this tab
  useEffect(() => {
    if (isActive && activeTrigger === 'auto' && username) autoStarted.add(username)
  }, [isActive, activeTrigger, username])

  // replay (profile menu) / continue (MissionTracker)
  useEffect(() => {
    if (!enabled) return undefined
    const open = (event) => {
      const current = getLoopStatus(username)
      const resume = event.detail?.resume === true && (current === 'pending' || current === 'snoozed')
      request(GUIDES.LOOP, {
        trigger: 'user',
        meta: resume
          ? { mode: 'onboarding', startId: validSceneId(getLoopProgress(username)) }
          : { mode: 'replay', startId: SCENES[0].id },
      })
    }
    window.addEventListener(OPEN_TRADING_LOOP_EVENT, open)
    return () => window.removeEventListener(OPEN_TRADING_LOOP_EVENT, open)
  }, [enabled, username, request])

  const finish = (andContinue) => {
    if (persist) {
      setLoopStatus(username, 'done')
      clearLoopProgress(username)
    }
    release(GUIDES.LOOP)
    if (persist && andContinue) onComplete?.()
  }

  const close = () => {
    if (persist) setLoopStatus(username, 'snoozed') // progress stays, so Resume continues where it left off
    release(GUIDES.LOOP)
  }

  if (isActive) {
    if (suspended) return null // a real form is open: step aside (state kept), come back when it closes
    const startId = lastScene.seq === activeSeq && lastScene.id ? lastScene.id : validSceneId(activeMeta?.startId)
    return (
      <TradingLoopDialog
        key={activeSeq}
        initialSceneId={startId}
        mode={activeMeta?.mode ?? 'onboarding'}
        onSceneChange={(id) => {
          setLastScene({ seq: activeSeq, id })
          if (persist) setLoopProgress(username, id)
        }}
        onComplete={() => finish(true)}
        onSkip={() => finish(false)}
        onClose={close}
        onOpenPlaybook={() => handoff(GUIDES.LOOP, GUIDES.PLAYBOOK, { startId })}
      />
    )
  }

  if (enabled && username && status === 'snoozed' && !activeId && !pausedId) {
    const resumeId = validSceneId(getLoopProgress(username))
    const position = SCENES.findIndex((scene) => scene.id === resumeId) + 1
    return (
      <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center rounded-full border border-cyan-400/30 bg-[#0a1018]/95 text-xs text-zinc-200 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => request(GUIDES.LOOP, { trigger: 'user', meta: { mode: 'onboarding', startId: resumeId } })}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-l-full pl-3.5 pr-2.5 font-medium hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <LoopIcon className="h-3.5 w-3.5 text-cyan-300" />
          Resume The Trading Loop
          <span className="tabular-nums text-zinc-400">{position}/{SCENES.length}</span>
        </button>
        <button
          type="button"
          aria-label="Dismiss The Trading Loop"
          onClick={() => {
            setLoopStatus(username, 'done')
            clearLoopProgress(username)
          }}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-r-full border-l border-white/10 text-zinc-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    )
  }

  return null
}
