import { useRef, useState } from 'react'
import { useFocusTimer } from '../../../hooks/useFocusTimer'
import { MAX_MINUTES, MIN_MINUTES, PRESET_MINUTES, formatClock, parseMinutes } from '../../../utils/focusTimer'

const COLLAPSED_KEY = 'tradecommit.focusTimer.collapsed.v1'
const POSITION_KEY = 'tradecommit.focusTimer.position.v1'
const WIDE_SCREEN = 1500 // wide enough to leave the editor column untouched on the left

// Progress colour follows the Deep Mode tint chosen in Focus settings.
const BAR_COLOR = { sage: 'bg-emerald-500/70', ocean: 'bg-sky-500/70', amber: 'bg-amber-500/70' }

const timerStyles = `
.focus-timer-in { animation: focus-timer-in .45s ease both; }
.focus-timer-done { animation: focus-timer-done 2.4s ease-in-out 2; }
@keyframes focus-timer-in { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: none; } }
@keyframes focus-timer-done { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 0 5px rgba(16,185,129,.10); } }
@media (prefers-reduced-motion: reduce) { .focus-timer-in, .focus-timer-done { animation: none !important; } }
`

const PHONE_SCREEN = 768 // below Tailwind's md: always start as the small pill so it never covers the plan

const readCollapsed = () => {
  if (window.innerWidth < PHONE_SCREEN) return true
  try {
    const saved = window.localStorage.getItem(COLLAPSED_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch { /* storage unavailable */ }
  return window.innerWidth < WIDE_SCREEN
}

const readPosition = () => {
  try {
    const saved = window.localStorage.getItem(POSITION_KEY)
    if (!saved) return null
    const position = JSON.parse(saved)
    if (Number.isFinite(position.left) && Number.isFinite(position.top)) return position
  } catch { /* storage unavailable or invalid */ }
  return null
}

const surface = 'border border-stone-200/80 bg-[#fbfaf7]/90 text-stone-700 shadow-[0_10px_34px_rgba(73,81,67,0.07)] backdrop-blur-md dark:border-white/[0.08] dark:bg-[#171a17]/90 dark:text-stone-200 dark:shadow-black/30'
const quietButton = 'inline-flex h-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 disabled:pointer-events-none disabled:opacity-40'
const ghost = `${quietButton} border-stone-200/90 text-stone-600 hover:bg-stone-200/50 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/[0.07]`
const solid = `${quietButton} border-stone-700 bg-stone-800 text-stone-50 hover:bg-stone-700 dark:border-stone-200/80 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white`

function ClockIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
    </svg>
  )
}

function ChevronIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

/**
 * Compact, collapsible focus timer for Deep Planning Mode. It floats on the left edge of the drawer (outside the
 * <form>, so Enter / buttons here can never submit the plan) and never takes layout space from the editor.
 * All timing lives in useFocusTimer; this component is presentation only.
 *
 * @param {'sage'|'ocean'|'amber'} [theme]  Deep Mode tint, used for the progress bar
 */
function FocusTimerPanel({ theme = 'sage', placement = 'planner' }) {
  const timer = useFocusTimer()
  const { status, selectedMinutes, remainingMs, progress } = timer
  const [collapsed, setCollapsed] = useState(() => placement === 'header' || readCollapsed())
  const [position, setPosition] = useState(() => readPosition() ?? { left: 12, top: 80 })
  const dragRef = useRef(null)
  const didDragRef = useRef(false)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState('')

  const startDrag = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('button,input') && !collapsed) return
    const panel = event.currentTarget.closest('[data-focus-timer]')
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    }
    didDragRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) < 4) return
    didDragRef.current = true
    const nextPosition = {
      left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, drag.left + deltaX)),
      top: Math.max(8, Math.min(window.innerHeight - drag.height - 8, drag.top + deltaY)),
    }
    setPosition(nextPosition)
    try { window.localStorage.setItem(POSITION_KEY, JSON.stringify(nextPosition)) } catch { /* storage unavailable */ }
  }

  const endDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  // only an explicit toggle is remembered, so opening on a phone never overwrites the desktop preference
  const toggleCollapsed = (next) => {
    setCollapsed(next)
    try { window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0') } catch { /* storage unavailable */ }
  }

  const isIdle = status === 'idle'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'
  const isDone = status === 'completed'
  const isLive = isRunning || isPaused
  const isPreset = PRESET_MINUTES.includes(selectedMinutes)
  const clock = formatClock(isDone ? 0 : remainingMs)
  const barColor = BAR_COLOR[theme] ?? BAR_COLOR.sage
  const statusLabel = isRunning ? `In session · ${selectedMinutes} min` : isPaused ? `Paused · ${selectedMinutes} min` : isDone ? 'Session complete' : 'Ready'

  const startCustom = () => {
    const minutes = parseMinutes(customValue)
    if (minutes === null) {
      setCustomError(`Enter ${MIN_MINUTES}–${MAX_MINUTES} minutes`)
      return
    }
    setCustomError('')
    setCustomValue('')
    timer.start(minutes)
  }

  const onCustomKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      startCustom()
    } else if (event.key === 'Escape' && customValue !== '') {
      event.preventDefault() // clear the field instead of closing the whole plan
      setCustomValue('')
      setCustomError('')
    }
  }

  const wrapperClass = placement === 'header' ? 'relative' : 'fixed left-3 top-20 z-[65]'
  const panelClass = placement === 'header'
    ? 'absolute right-0 top-[calc(100%+8px)] z-[70]'
    : 'fixed left-3 top-20 z-[65]'
  const positionStyle = position
    ? { position: 'fixed', left: `${position.left}px`, top: `${position.top}px`, zIndex: 70 }
    : undefined

  if (collapsed) {
    return (
      <div className={position ? 'fixed z-[70]' : wrapperClass} style={positionStyle} data-focus-timer>
        <style>{timerStyles}</style>
        <button
          type="button"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={() => {
            if (didDragRef.current) {
              didDragRef.current = false
              return
            }
            toggleCollapsed(false)
          }}
          aria-expanded="false"
          aria-label={`Open focus timer. ${statusLabel}${isLive ? `, ${clock} left` : ''}`}
          title="Focus timer"
          className={`focus-timer-in ${surface} ${isDone ? 'focus-timer-done' : ''} inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 dark:hover:bg-[#1d211d] ${placement === 'floating' || position ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
        >
          <ClockIcon />
          {isLive && <span className={`font-medium tabular-nums ${isPaused ? 'opacity-60' : ''}`}>{clock}</span>}
          {isDone && <span className="font-medium text-emerald-700 dark:text-emerald-400">Done</span>}
          {isIdle && <span className="text-stone-500 dark:text-stone-400">Focus</span>}
        </button>
      </div>
    )
  }

  return (
    <aside className={panelClass} style={positionStyle} aria-label="Focus timer" data-focus-timer>
      <style>{timerStyles}</style>
      <div className={`focus-timer-in ${surface} ${isDone ? 'focus-timer-done' : ''} w-[min(13.5rem,calc(100vw-1.5rem))] rounded-2xl p-3`}>
        <div
          className="flex cursor-grab touch-none items-center justify-between active:cursor-grabbing"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
            <ClockIcon className="h-3 w-3" /> Focus timer
          </p>
          <button
            type="button"
            onClick={() => toggleCollapsed(true)}
            aria-label="Collapse focus timer"
            aria-expanded="true"
            title="Collapse"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 dark:hover:bg-white/[0.07] dark:hover:text-stone-100"
          >
            <ChevronIcon />
          </button>
        </div>

        <div className="mt-2.5">
          <p
            role="timer"
            aria-label={`${clock} remaining`}
            className={`text-[2rem] font-light leading-none tracking-tight tabular-nums text-stone-800 transition-opacity dark:text-stone-100 ${isPaused ? 'opacity-55' : ''}`}
          >
            {clock}
          </p>
          <div
            className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-stone-200/80 dark:bg-white/[0.08]"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className={`h-full rounded-full transition-[width] duration-700 ease-linear ${barColor}`} style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'deep-focus-breathe bg-emerald-500' : isDone ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-600'}`} />
            {statusLabel}
          </p>
        </div>

        {isDone && (
          <div role="status" className="mt-2.5 rounded-lg bg-emerald-500/[0.08] px-2.5 py-2 text-[12px] leading-5 text-emerald-800 dark:text-emerald-300">
            Nicely done. Your {selectedMinutes}-minute session is complete. You're still in Deep Mode.
          </div>
        )}

        <div className="mt-3 flex items-center gap-1.5">
          {isIdle && <button type="button" onClick={() => timer.start(selectedMinutes)} className={`${solid} flex-1`}>Start</button>}
          {isRunning && <button type="button" onClick={timer.pause} className={`${solid} flex-1`}>Pause</button>}
          {isPaused && <button type="button" onClick={timer.resume} className={`${solid} flex-1`}>Resume</button>}
          {isDone && <button type="button" onClick={() => timer.start(selectedMinutes)} className={`${solid} flex-1`}>Again</button>}
          <button type="button" onClick={timer.reset} disabled={isIdle} className={`${ghost} px-3`}>{isDone ? 'Dismiss' : 'Reset'}</button>
        </div>

        <div className="mt-3 border-t border-stone-200/70 pt-3 dark:border-white/[0.07]">
          <div role="group" aria-label="Session length in minutes" className="grid grid-cols-5 gap-1">
            {PRESET_MINUTES.map((minutes) => {
              const active = selectedMinutes === minutes
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => timer.selectMinutes(minutes)}
                  disabled={isLive}
                  aria-pressed={active}
                  title={`${minutes} minutes`}
                  className={`h-7 rounded-md text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 ${active ? 'bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900' : 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-white/[0.07]'} ${isLive && !active ? 'opacity-40' : ''} ${isLive ? 'cursor-default' : ''}`}
                >
                  {minutes}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-center text-[10px] text-stone-400 dark:text-stone-500">minutes{!isPreset && !isDone ? ` · custom ${selectedMinutes}` : ''}</p>

          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={customValue}
              onChange={(event) => {
                setCustomValue(event.target.value.replace(/\D/g, '').slice(0, 3))
                setCustomError('')
              }}
              onKeyDown={onCustomKeyDown}
              disabled={isLive}
              aria-label="Custom session length in minutes"
              aria-invalid={Boolean(customError)}
              placeholder="Custom min"
              className="h-8 min-w-0 flex-1 rounded-lg border border-stone-200/90 bg-transparent px-2.5 text-[12px] tabular-nums text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 disabled:opacity-40 dark:border-white/10 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-white/30"
            />
            <button type="button" onClick={startCustom} disabled={isLive || customValue === ''} className={`${ghost} px-2.5`}>Start</button>
          </div>
          {customError && <p role="alert" className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{customError}</p>}
        </div>
      </div>
    </aside>
  )
}

export default FocusTimerPanel
