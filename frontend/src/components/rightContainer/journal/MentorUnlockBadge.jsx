import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MentorMark from './MentorMark'
import './mentorProgress.css'

/**
 * A quiet, one-time confirmation that the mentor is ready, using the orb's bloom as its activated mark.
 */
function MentorUnlockBadge({ target = 5, onOpenMentor, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const primary = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    primary.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onDismiss])

  if (!visible) return null

  return createPortal(
    <div
      className="mu-backdrop fixed inset-0 z-50 flex items-center justify-end bg-zinc-950/15 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onDismiss()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mentor-unlock-title"
        aria-describedby="mentor-unlock-description"
        className="mu-card relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgb(24_24_27/0.32)] dark:border-white/[0.12] dark:bg-panel dark:shadow-[0_20px_60px_-24px_rgb(0_0_0/0.75)] sm:mr-2"
      >
        <div className="flex items-start gap-4">
          <div className="mu-mark-wrap relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#e8ddd4] bg-[#faf7f3] text-[#c4623f] dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-[#e08a68]">
            <span aria-hidden="true" className="mu-mark-halo absolute inset-0 rounded-full" />
            <MentorMark className="mu-mark relative h-6 w-6" />
          </div>

          <div className="min-w-0 pt-0.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
              Mentor unlocked
            </p>
            <h2 id="mentor-unlock-title" className="mt-1 text-base font-semibold tracking-[-0.025em] text-zinc-900 dark:text-zinc-100">
              Your mentor is ready
            </h2>
          </div>
        </div>

        <p id="mentor-unlock-description" className="mt-4 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          You’ve logged {target} trades. Your mentor can now review them against your strategy.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 cursor-pointer rounded-lg px-3 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
          >
            Later
          </button>
          <button
            ref={primary}
            type="button"
            onClick={onOpenMentor}
            className="h-9 cursor-pointer rounded-lg bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-[#1a1a1a]"
          >
            Open mentor
          </button>
        </div>
      </section>
    </div>,
    document.body
  )
}

export default MentorUnlockBadge
