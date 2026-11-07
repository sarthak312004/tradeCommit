import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DEMO_FLYWHEEL_STEPS } from '../../utils/demoFlywheel'
import { SERIF } from '../auth/authStyles'
import { findVisibleTarget, isOffscreen, TARGET_HIGHLIGHT_PADDING } from '../onboardingGuide/useTargetRect'
import { DEMO_STEPS } from './demoSteps'
import '../onboardingGuide/onboardingGuide.css'

/** Thin glowing outline around the highlighted element. No dimming, no click-blocking: the workspace stays fully visible. */
export function DemoHighlight({ selector }) {
  const outlineRef = useRef(null)

  useEffect(() => {
    const outline = outlineRef.current
    if (!outline) return undefined
    outline.style.visibility = 'hidden'
    if (!selector) return undefined

    let frame = 0
    let cancelled = false
    let scrolled = false
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const trackTarget = () => {
      if (cancelled) return
      const match = findVisibleTarget(selector)
      if (match) {
        const { element, rect } = match
        if (!scrolled) {
          scrolled = true
          if (isOffscreen(rect)) {
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
          }
        }
        outline.style.transform = `translate3d(${rect.left - TARGET_HIGHLIGHT_PADDING}px, ${rect.top - TARGET_HIGHLIGHT_PADDING}px, 0)`
        outline.style.width = `${rect.width + TARGET_HIGHLIGHT_PADDING * 2}px`
        outline.style.height = `${rect.height + TARGET_HIGHLIGHT_PADDING * 2}px`
        outline.style.visibility = match.isFullyVisible ? 'visible' : 'hidden'
      } else {
        outline.style.visibility = 'hidden'
      }
      frame = requestAnimationFrame(trackTarget)
    }

    frame = requestAnimationFrame(trackTarget)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      outline.style.visibility = 'hidden'
    }
  }, [selector])

  return createPortal(
    <div className="guide-root" data-guide-surface>
      <div
        ref={outlineRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[95] rounded-lg border border-sky-600 shadow-[0_0_0_1px_rgb(2_132_199/0.25),0_0_12px_rgb(2_132_199/0.5)] dark:border-sky-400 dark:shadow-[0_0_0_1px_rgb(56_189_248/0.3),0_0_14px_rgb(56_189_248/0.55)]"
        style={{
          width: TARGET_HIGHLIGHT_PADDING * 2,
          height: TARGET_HIGHLIGHT_PADDING * 2,
          transform: `translate3d(-${TARGET_HIGHLIGHT_PADDING}px, -${TARGET_HIGHLIGHT_PADDING}px, 0)`,
          visibility: 'hidden',
        }}
      />
    </div>,
    document.body
  )
}

const btnGhost = 'h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:text-zinc-300 dark:hover:bg-white/[0.07]'

/**
 * The explanation lives in its own column (bottom sheet on phones) next to the workspace, never on top of it,
 * so whatever the step opened stays completely visible.
 */
export default function DemoGuidePanel({ stepId, step, isOpenState, isMobile, canGoBack, onPrimary, onBack, onSkip, onSecondary, onJump }) {
  const titleId = useId()
  const index = DEMO_FLYWHEEL_STEPS.indexOf(stepId)
  const title = isOpenState && step.openTitle ? step.openTitle : step.title
  const now = isOpenState && step.openNow ? step.openNow : step.now
  const body = isOpenState && step.openBody ? step.openBody : step.body
  const next = isOpenState && step.openNext ? step.openNext : step.next
  const note = isOpenState && step.openNote ? step.openNote : step.note
  const primary = isOpenState && step.openPrimaryLabel ? step.openPrimaryLabel : step.primaryLabel

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      data-guide-card
      className={`relative z-[60] flex shrink-0 flex-col bg-gradient-to-b from-white to-[#f9f6f0] text-zinc-900 dark:from-[#242424] dark:to-[#1b1b1b] dark:text-zinc-100 ${
        isMobile
          ? 'max-h-[46vh] border-t border-zinc-900/10 shadow-[0_-10px_30px_-18px_rgb(0_0_0/0.4)] dark:border-white/[0.12]'
          : 'w-[360px] border-l border-zinc-900/10 dark:border-white/[0.12]'
      }`}
    >
      <div className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          <span>Flywheel demo</span>
          <span>Step {index + 1} of {DEMO_FLYWHEEL_STEPS.length}</span>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {DEMO_FLYWHEEL_STEPS.map((id, position) => (
            <span key={id} className={`h-[2px] flex-1 rounded-full transition-colors duration-300 ${position <= index ? 'bg-zinc-900/70 dark:bg-zinc-100/70' : 'bg-zinc-900/10 dark:bg-white/10'}`} />
          ))}
        </div>

        <h2 id={titleId} className={`${SERIF} mt-4 text-[22px] font-medium leading-[1.2] tracking-[-0.015em] text-zinc-900 dark:text-zinc-50`}>
          {title}
        </h2>

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">On screen now</p>
        <p className="mt-1 text-[13px] leading-[1.55] text-zinc-800 dark:text-zinc-200">{now}</p>

        <p className="mt-3 text-[13px] leading-[1.6] text-zinc-600 dark:text-zinc-400">{body}</p>

        <div className="mt-3 rounded-lg border border-zinc-900/10 bg-zinc-900/[0.03] px-3 py-2 dark:border-white/[0.10] dark:bg-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Next</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{next}</p>
        </div>

        {note && <p className="mt-3 border-l border-zinc-900/15 pl-3 text-xs leading-relaxed text-zinc-500 dark:border-white/15">{note}</p>}

        {!isMobile && (
          <ol className="mt-4 space-y-0.5" aria-label="Walkthrough steps">
            {DEMO_FLYWHEEL_STEPS.map((id, position) => {
              const done = position < index
              const current = position === index
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onJump(id)}
                    aria-current={current ? 'step' : undefined}
                    className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 ${
                      current ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${
                      done ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400' : current ? 'bg-sky-600 text-white dark:bg-sky-400 dark:text-zinc-900' : 'bg-zinc-900/[0.07] dark:bg-white/10'
                    }`}>
                      {done ? '✓' : position + 1}
                    </span>
                    {DEMO_STEPS[id].label}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-900/10 px-5 py-3 dark:border-white/[0.10]">
        <button type="button" onClick={onSkip} className="-ml-1 rounded-md px-1 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:hover:text-zinc-200">
          Skip guide
        </button>
        <div className="flex items-center gap-2">
          {canGoBack && <button type="button" onClick={onBack} className={btnGhost}>Back</button>}
          {step.secondaryLabel && onSecondary && (
            <button type="button" onClick={onSecondary} className="h-8 rounded-lg border border-zinc-300/80 px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-900/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.07]">
              {step.secondaryLabel}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={onPrimary}
            className="h-8 whitespace-nowrap rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-[#1f1f1f]"
          >
            {primary}
          </button>
        </div>
      </div>
    </section>
  )
}
