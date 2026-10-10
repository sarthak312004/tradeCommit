import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { controlNeutral, controlPrimary, focusRing } from '../common/controlStyles'
import { LightbulbIcon } from './tourIcons'

const GAP = 14 // space between the highlight and the card
const MARGIN = 12 // minimum space between the card and the window edge
const CARD_WIDTH = 320
const CENTER_WIDTH = 380

const OPPOSITE = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' }

// which side of the highlight the card goes on: the preferred one if it fits, then the others
function placeCard(rect, preferred, size, viewport) {
  const clampX = (x) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, viewport.w - size.w - MARGIN))
  const clampY = (y) => Math.min(Math.max(y, MARGIN), Math.max(MARGIN, viewport.h - size.h - MARGIN))
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const attempt = {
    right: () => ({ x: rect.left + rect.width + GAP, y: clampY(centerY - size.h / 2), fits: rect.left + rect.width + GAP + size.w <= viewport.w - MARGIN }),
    left: () => ({ x: rect.left - GAP - size.w, y: clampY(centerY - size.h / 2), fits: rect.left - GAP - size.w >= MARGIN }),
    bottom: () => ({ x: clampX(centerX - size.w / 2), y: rect.top + rect.height + GAP, fits: rect.top + rect.height + GAP + size.h <= viewport.h - MARGIN }),
    top: () => ({ x: clampX(centerX - size.w / 2), y: rect.top - GAP - size.h, fits: rect.top - GAP - size.h >= MARGIN }),
  }

  const order = [preferred, OPPOSITE[preferred], 'bottom', 'top', 'right', 'left'].filter((side, index, all) => side && all.indexOf(side) === index)
  for (const side of order) {
    const spot = attempt[side]()
    if (spot.fits) return { side, x: spot.x, y: spot.y, centerX, centerY }
  }
  // nothing fits (a very large highlight): sit in the middle of the window
  return { side: null, x: clampX((viewport.w - size.w) / 2), y: clampY((viewport.h - size.h) / 2), centerX, centerY }
}

const fill = (text, name) => (name ? text.replaceAll('{name}', name) : text.replaceAll(', {name}', '').replaceAll('{name}', ''))

/**
 * One hint card. Sits next to the highlighted element (with a small arrow pointing at it), or in the middle of the
 * window for steps without a target. Same surface, type and buttons as the app's other dialogs.
 */
function TourCard({ step, index, total, rect, name, onNext, onBack, onSkip }) {
  const cardRef = useRef(null)
  const nextRef = useRef(null)
  const [size, setSize] = useState({ w: step.target ? CARD_WIDTH : CENTER_WIDTH, h: 220 })
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [hasSettled, setHasSettled] = useState(false)

  const isFirst = index === 0
  const isLast = index === total - 1
  const isCentered = !rect
  const width = isCentered ? CENTER_WIDTH : CARD_WIDTH

  useEffect(() => {
    const handleResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // measure the real card height (text length differs per step), and again if it ever changes
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return undefined
    const measure = () => {
      const { width: w, height: h } = card.getBoundingClientRect()
      setSize((prev) => (Math.abs(prev.w - w) < 1 && Math.abs(prev.h - h) < 1 ? prev : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [step.id])

  // after the first paint the card may glide from step to step; before it, it must not fly in from the corner
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Enter / Space then moves to the next step
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [step.id])

  const placement = rect ? placeCard(rect, step.placement ?? 'bottom', { w: width, h: size.h }, viewport) : null
  const x = placement ? placement.x : Math.max(MARGIN, (viewport.w - width) / 2)
  const y = placement ? placement.y : Math.max(MARGIN, (viewport.h - size.h) / 2)

  let arrow = null
  if (placement?.side) {
    const along = (center, start, length) => Math.min(Math.max(center - start, 18), length - 18) - 5
    const arrowBase = 'absolute h-2.5 w-2.5 rotate-45 border-zinc-300 bg-white dark:border-white/[0.13] dark:bg-panel-hi'
    const byRight = { left: -6, top: along(placement.centerY, y, size.h) }
    const byLeft = { right: -6, top: along(placement.centerY, y, size.h) }
    const below = { top: -6, left: along(placement.centerX, x, width) }
    const above = { bottom: -6, left: along(placement.centerX, x, width) }
    const arrowStyle = { right: byRight, left: byLeft, bottom: below, top: above }[placement.side]
    const arrowBorder = { right: 'border-b border-l', left: 'border-r border-t', bottom: 'border-l border-t', top: 'border-b border-r' }[placement.side]
    arrow = <span aria-hidden="true" className={`${arrowBase} ${arrowBorder}`} style={arrowStyle} />
  }

  const primaryLabel = step.primary ?? (isLast ? 'Finish' : 'Next')

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabIndex={-1}
      style={{ left: x, top: y, width }}
      className={`fixed z-[91] max-w-[calc(100vw-24px)] animate-[fadeIn_.2s_ease-out] rounded-xl border border-zinc-300 bg-white p-4 text-left shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] outline-none dark:border-white/[0.13] dark:bg-panel-hi ${
        hasSettled ? 'transition-[left,top] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none' : ''
      }`}
    >
      {arrow}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
          Step {index + 1} of {total}
        </p>
        <div aria-hidden="true" className="flex items-center gap-1">
          {Array.from({ length: total }, (_, dot) => (
            <span key={dot} className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-4 bg-zinc-800 dark:bg-zinc-200' : dot < index ? 'w-1.5 bg-zinc-500 dark:bg-zinc-400' : 'w-1.5 bg-zinc-300 dark:bg-white/20'}`} />
          ))}
        </div>
      </div>

      {isFirst && isCentered && <img src="/favicon.svg" alt="" className="mt-3 h-9 w-9" />}

      <h2 id="tour-title" className="mt-2.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {fill(step.title, name)}
      </h2>
      <p id="tour-body" className="mt-1.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
        {fill(step.body, name)}
      </p>

      {step.checklist && (
        <ol className="mt-3 space-y-2">
          {step.checklist.map((item, itemIndex) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] leading-snug text-zinc-800 dark:text-zinc-200">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">{itemIndex + 1}</span>
              <span className="pt-px">{item}</span>
            </li>
          ))}
        </ol>
      )}

      {step.tip && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-zinc-100 px-2.5 py-2 text-xs leading-snug text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
          <LightbulbIcon className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{step.tip}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-white/[0.10]">
        {isLast ? (
          <span />
        ) : (
          <button type="button" onClick={onSkip} className={`cursor-pointer rounded px-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${focusRing}`}>
            Skip tour
          </button>
        )}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button type="button" onClick={onBack} className={controlNeutral}>
              Back
            </button>
          )}
          <button ref={nextRef} type="button" onClick={onNext} className={controlPrimary}>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TourCard
