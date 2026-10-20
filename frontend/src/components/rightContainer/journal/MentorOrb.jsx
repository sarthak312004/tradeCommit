import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MentorMark from './MentorMark'
import './mentorProgress.css'

const NUDGE_KEY = 'tc-mentor-nudge-seen'

/** Five hairline segments that fill with clay as trades are logged; the newest one pops. */
function ProgressSegments({ count, target, justHit }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: target }, (_, index) => {
        const on = index < count
        const hit = justHit && index === count - 1
        return (
          <span
            key={index}
            className={`mp-seg h-[5px] w-[14px] rounded-full ${on ? `mp-seg-on ${index === count - 1 ? 'mp-sheen' : ''}` : 'bg-zinc-300/80 dark:bg-white/[0.12]'} ${hit ? 'mp-seg-hit' : ''}`}
          />
        )
      })}
    </span>
  )
}

/**
 * The way into the AI mentor: a quiet floating orb in the bottom-right corner of every journal tab.
 * While the first review is still locked, a small segmented progress bar extends from the orb to its left (n of 5
 * trades) and a short card explains what is coming and offers to log the next trade. Once unlocked, the bar
 * gives way to the familiar hover pill and a tiny badge pip on the orb.
 * Rendered in a portal so no ancestor (the page header uses backdrop-blur) can trap its `fixed` position.
 */
function MentorOrb({ onOpen, onWarm, progress = null, hasReadyReview = false, onLogTrade }) {
  const locked = Boolean(progress && !progress.completed)
  const count = progress?.count ?? 0
  const target = progress?.target ?? 5
  const remaining = Math.max(target - count, 0)

  const [pinned, setPinned] = useState(false)
  const [justHit, setJustHit] = useState(false)
  const previous = useRef(count)

  // the newest segment pops whenever a trade lands
  useEffect(() => {
    if (count > previous.current) {
      setJustHit(true)
      const timer = setTimeout(() => setJustHit(false), 800)
      previous.current = count
      return () => clearTimeout(timer)
    }
    previous.current = count
  }, [count])

  // one gentle, self-dismissing nudge per session while the mentor is still locked
  useEffect(() => {
    if (!locked) return undefined
    let seen = false
    try { seen = sessionStorage.getItem(NUDGE_KEY) === '1' } catch { /* storage unavailable */ }
    if (seen) return undefined
    const open = setTimeout(() => {
      setPinned(true)
      try { sessionStorage.setItem(NUDGE_KEY, '1') } catch { /* ignore */ }
    }, 2500)
    const close = setTimeout(() => setPinned(false), 9500)
    return () => { clearTimeout(open); clearTimeout(close) }
  }, [locked])

  const handleClick = () => {
    if (hasReadyReview) {
      onOpen()
      return
    }
    if (locked) setPinned((open) => !open)
    else onOpen()
  }

  const headline = count === 0 ? 'Unlock your AI mentor' : remaining === 1 ? 'One trade to go' : `${remaining} trades to go`
  const body = count === 0
    ? `Log your first ${target} trades and your mentor reviews them against your strategy.`
    : `Log ${remaining === 1 ? 'one more trade' : `${remaining} more trades`} and your first feedback is ready.`

  return createPortal(
    <div className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 md:bottom-7 md:right-7" data-tour="mentor-orb">
      {/* slow clay glow orbiting the disc; fades out while the pill is open */}
      <span aria-hidden="true" className="mentor-orb-halo pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-full transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0" />

      {locked && (
        <div
          className={`absolute bottom-full right-0 pb-3 transition-opacity duration-200 ${pinned ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}`}
        >
          <div role="status" className="mp-pop w-[17rem] rounded-2xl border border-[#e3dccf] bg-gradient-to-b from-white to-[#f9f6f0] p-4 shadow-[0_14px_34px_-12px_rgb(28_25_23/0.35)] dark:border-white/[0.14] dark:from-[#242424] dark:to-[#1b1b1b] dark:shadow-[0_14px_34px_-12px_rgb(0_0_0/0.8)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">{headline}</p>
              <span className="text-[11px] font-medium tabular-nums text-[#c4623f] dark:text-[#e08a68]">{count}/{target}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
            <div className="mt-3"><ProgressSegments count={count} target={target} justHit={false} /></div>
            {onLogTrade && (
              <button
                type="button"
                onClick={() => { setPinned(false); onLogTrade() }}
                className="mt-3 h-8 w-full cursor-pointer rounded-lg bg-zinc-900 text-xs font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4623f] dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.16]"
              >
                {count === 0 ? 'Log my first trade' : 'Log a trade'}
              </button>
            )}
            <p className="mt-2 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-500">Each different trade counts once. Edits and copies don’t add a point.</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        onPointerEnter={onWarm}
        onFocus={onWarm}
        aria-label={hasReadyReview ? 'Open mentor review, new feedback ready' : locked ? `Mentor review unlocks after ${target} trades, ${count} logged` : 'Open mentor review'}
        aria-expanded={locked ? pinned : undefined}
        title={hasReadyReview ? 'New mentor feedback is ready' : locked ? undefined : 'Mentor review: feedback on a week or any date range, checked against your strategy'}
        className="relative flex h-12 items-center overflow-hidden rounded-full border border-[#e3dccf] bg-gradient-to-b from-white to-[#f7f3ec] text-[#c4623f] shadow-[0_1px_2px_rgb(28_25_23/0.10),0_8px_20px_-6px_rgb(28_25_23/0.28)] transition-[box-shadow,border-color] duration-300 hover:border-[#d6a88f] hover:shadow-[0_2px_4px_rgb(28_25_23/0.12),0_14px_28px_-8px_rgb(196_98_63/0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4623f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#dfddd6] dark:border-white/[0.14] dark:from-[#242424] dark:to-[#1a1a1a] dark:text-[#e08a68] dark:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)] dark:hover:border-[#e08a68]/50 dark:focus-visible:ring-[#e08a68] dark:focus-visible:ring-offset-[#111111]"
      >
        {locked ? (
          <span className="flex items-center gap-2.5 pl-4 pr-1">
            <ProgressSegments count={count} target={target} justHit={justHit} />
            <span className="text-[11px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{count}/{target}</span>
          </span>
        ) : (
          <span className="max-w-0 whitespace-nowrap pl-0 text-[13px] font-medium tracking-[-0.01em] text-zinc-800 opacity-0 transition-[max-width,padding,opacity] duration-300 ease-out group-hover:max-w-[9rem] group-hover:pl-4 group-hover:opacity-100 group-focus-within:max-w-[9rem] group-focus-within:pl-4 group-focus-within:opacity-100 motion-reduce:transition-none dark:text-zinc-100">
            Mentor review
          </span>
        )}
        <span className="grid h-12 w-12 shrink-0 place-items-center">
          <MentorMark className="h-6 w-6 transition-transform duration-700 ease-out group-hover:rotate-[60deg] group-hover:scale-110 motion-reduce:transition-none" />
        </span>
      </button>

      {/* The "feedback is ready" dot is a sibling of the button, not a child: the button is overflow-hidden and
          rounded-full, so a dot inside it was cut off where the circle curves away at the top right corner.
          Placed on the disc's 45 degree rim point, so nothing can clip it. */}
      {hasReadyReview && (
        <span aria-hidden="true" className="pointer-events-none absolute right-[1px] top-[1px] z-10 h-3 w-3 rounded-full bg-[#c4623f] ring-2 ring-white dark:bg-[#e08a68] dark:ring-[#242424]" />
      )}
    </div>,
    document.body
  )
}

export default MentorOrb
