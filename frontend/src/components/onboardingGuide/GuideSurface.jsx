import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SERIF } from '../auth/authStyles'
import { GUIDE_STAGE, GUIDE_STEP_ORDER } from '../../utils/onboardingGuide'
import { buildConnectorPath, computeGuideLayout } from '../../utils/guideLayout'
import { GUIDE_STAGES } from './guideSteps'
import './onboardingGuide.css'

const SPOT_PADDING = 6
const SPOT_RADIUS = 8
const CARD_WIDTH = 344
const COMPACT_BREAKPOINT = 640

const readViewport = () => ({ width: window.innerWidth, height: window.innerHeight })

const roundedRectPath = ({ left, top, width, height }, radius) => [
  `M ${left + radius} ${top}`,
  `H ${left + width - radius}`,
  `A ${radius} ${radius} 0 0 1 ${left + width} ${top + radius}`,
  `V ${top + height - radius}`,
  `A ${radius} ${radius} 0 0 1 ${left + width - radius} ${top + height}`,
  `H ${left + radius}`,
  `A ${radius} ${radius} 0 0 1 ${left} ${top + height - radius}`,
  `V ${top + radius}`,
  `A ${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
  'Z',
].join(' ')

function useViewport() {
  const [viewport, setViewport] = useState(readViewport)
  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return viewport
}

function StageRail({ stage, label, progress = [] }) {
  return (
    <ol className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em]" aria-label={label}>
      {GUIDE_STAGES.map((item, index) => {
        const active = item.id === stage
        const completed = progress.find((entry) => entry.id === item.id)?.completed
        return (
          <li key={item.id} className="flex items-center gap-1.5" aria-current={active ? 'step' : undefined}>
            {index > 0 && <span aria-hidden="true" className="h-px w-3 bg-zinc-900/15 dark:bg-white/15" />}
            <span className={`flex items-center gap-1.5 transition-colors ${active ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
              {completed
                ? <span aria-hidden="true" className="text-[9px] text-emerald-600 dark:text-emerald-400">✓</span>
                : active && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-sky-600 shadow-[0_0_6px_rgb(2_132_199/0.7)] dark:bg-sky-400 dark:shadow-[0_0_6px_rgb(56_189_248/0.8)]" />}
              {item.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Segments({ index, steps }) {
  return (
    <div className="mt-3 flex gap-1" aria-hidden="true">
      {steps.map((id, position) => (
        <span key={id} className={`h-[2px] flex-1 rounded-full transition-colors duration-300 ${position <= index ? 'bg-zinc-900/70 dark:bg-zinc-100/70' : 'bg-zinc-900/10 dark:bg-white/10'}`} />
      ))}
    </div>
  )
}

/**
 * The dimmed interface with a "hole" around the target, a thin glowing connector, and the card.
 * One surface for every step: only its props change, so the experience reads as one continuous walkthrough.
 *
 *   rect         target box in viewport coordinates, or null (centred card)
 *   interactive  the highlighted element stays clickable
 */
export default function GuideSurface({
  stepId,
  step,
  rect,
  interactive,
  waiting,
  canGoBack,
  onPrimary,
  primaryDisabled = false,
  onBack,
  onSkip,
  progressSteps = GUIDE_STEP_ORDER,
  progressIndex = GUIDE_STEP_ORDER.indexOf(stepId),
  stageLabel = 'Where you are in the loop',
  stageOverride,
  stageProgress,
  error,
  showStepCounter = false,
  secondaryLabel = null,
  onSecondary = null,
}) {
  const viewport = useViewport()
  const compact = viewport.width < COMPACT_BREAKPOINT
  const cardRef = useRef(null)
  const primaryRef = useRef(null)
  const [cardSize, setCardSize] = useState({ width: CARD_WIDTH, height: 0 })
  const titleId = useId()
  const bodyId = useId()

  const stage = stageOverride ?? stageOf(stepId)
  const index = progressIndex
  const cardWidth = compact ? Math.min(viewport.width - 32, 400) : CARD_WIDTH

  // measure the real card, so the connector meets its edge exactly
  useLayoutEffect(() => {
    const element = cardRef.current
    if (!element) return undefined
    const measure = () => setCardSize({ width: element.offsetWidth, height: element.offsetHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [stepId, waiting, cardWidth])

  const spot = rect && {
    left: rect.left - SPOT_PADDING,
    top: rect.top - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  }

  const layout = useMemo(
    () => computeGuideLayout({ target: spot, card: { width: cardSize.width || cardWidth, height: cardSize.height }, viewport, placement: step.placement, compact }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `spot` is derived from rect; depend on its numbers
    [rect?.left, rect?.top, rect?.width, rect?.height, cardSize.width, cardSize.height, viewport.width, viewport.height, step.placement, compact, cardWidth]
  )
  const path = buildConnectorPath(layout.from, layout.to, layout.axis)
  const dimPath = [
    `M 0 0 H ${viewport.width} V ${viewport.height} H 0 Z`,
    spot ? roundedRectPath(spot, SPOT_RADIUS) : '',
  ].filter(Boolean).join(' ')
  const measured = cardSize.height > 0

  // keyboard users land on the main button, except where the real UI behind the step needs the focus (the journal form)
  useEffect(() => {
    if (step.keepFocus) return
    primaryRef.current?.focus({ preventScroll: true })
  }, [stepId, step.keepFocus])

  const blockers = spot && interactive ? (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[89]" style={{ height: Math.max(0, spot.top) }} />
      <div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-[89]" style={{ top: Math.max(0, spot.top) + spot.height }} />
      <div aria-hidden="true" className="fixed left-0 z-[89]" style={{ top: Math.max(0, spot.top), height: spot.height, width: Math.max(0, spot.left) }} />
      <div aria-hidden="true" className="fixed right-0 z-[89]" style={{ top: Math.max(0, spot.top), height: spot.height, left: spot.left + spot.width }} />
    </>
  ) : (
    // swallows clicks so the page behind cannot change while a step is open
    <div aria-hidden="true" className="fixed inset-0 z-[89]" />
  )

  return createPortal(
    <div className="guide-root" data-guide-surface>
      {blockers}

      <svg
        aria-hidden="true"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        className="guide-dim pointer-events-none fixed inset-0 z-[90]"
      >
        <path d={dimPath} fillRule="evenodd" />
        {spot && <path d={roundedRectPath(spot, SPOT_RADIUS)} className="guide-ring" />}
      </svg>

      {/* thin connector between the card and the real component */}
      {path && measured && (
        <svg key={stepId} aria-hidden="true" width={viewport.width} height={viewport.height} className="pointer-events-none fixed left-0 top-0 z-[91]">
          <path d={path} pathLength="1" className="guide-line" />
          <circle cx={layout.from.x} cy={layout.from.y} r="2" className="guide-end-from guide-end" />
          <circle cx={layout.to.x} cy={layout.to.y} r="3" className="guide-end" />
          <circle cx={layout.to.x} cy={layout.to.y} r="3" className="guide-ping" />
        </svg>
      )}

      <div
        className="fixed z-[92]"
        style={{ left: layout.x, top: layout.y, width: cardWidth, visibility: measured ? 'visible' : 'hidden' }}
      >
        <div
          ref={cardRef}
          key={stepId}
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          data-guide-card
          className="guide-card-in rounded-2xl border border-zinc-900/10 bg-gradient-to-b from-white to-[#f9f6f0] p-5 shadow-[0_18px_44px_-18px_rgb(28_25_23/0.38),0_2px_6px_-2px_rgb(28_25_23/0.1)] dark:border-white/[0.12] dark:from-[#242424] dark:to-[#1b1b1b] dark:shadow-[0_22px_50px_-18px_rgb(0_0_0/0.85)]"
        >
          {showStepCounter ? (
            <div className="flex items-center justify-between gap-2">
              <StageRail stage={stage} label={stageLabel} progress={stageProgress} />
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Step {index + 1} of {progressSteps.length}
              </span>
            </div>
          ) : (
            <StageRail stage={stage} label={stageLabel} progress={stageProgress} />
          )}
          <Segments index={index} steps={progressSteps} />

          <h2 id={titleId} className={`${SERIF} mt-4 text-[22px] font-medium leading-[1.2] tracking-[-0.015em] text-zinc-900 dark:text-zinc-50`}>
            {step.title}
          </h2>
          <p id={bodyId} className="mt-2 text-[13px] leading-[1.6] text-zinc-600 dark:text-zinc-400">
            {step.body}
          </p>
          {step.note && <p className="mt-3 border-l border-zinc-900/15 pl-3 text-xs leading-relaxed text-zinc-500 dark:border-white/15 dark:text-zinc-500">{step.note}</p>}
          {error && <p role="alert" className="mt-3 text-xs leading-relaxed text-rose-700 dark:text-rose-300">{error}</p>}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="-ml-1 rounded-md px-1 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:text-zinc-500 dark:hover:text-zinc-200"
            >
              Skip guide
            </button>

            <div className="flex items-center gap-2">
              {waiting && (
                <span role="status" className="mr-1 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span aria-hidden="true" className="guide-pulse-dot h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                  {step.waiting}
                </span>
              )}
              {canGoBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:text-zinc-300 dark:hover:bg-white/[0.07]"
                >
                  Back
                </button>
              )}
              {secondaryLabel && onSecondary && (
                <button
                  type="button"
                  onClick={onSecondary}
                  className="h-8 rounded-lg border border-zinc-300/80 px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-900/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                >
                  {secondaryLabel}
                </button>
              )}
              <button
                ref={primaryRef}
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                className="h-8 rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-[#1f1f1f]"
              >
                {step.primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function stageOf(stepId) {
  return GUIDE_STAGE[stepId] ?? 'plan'
}
