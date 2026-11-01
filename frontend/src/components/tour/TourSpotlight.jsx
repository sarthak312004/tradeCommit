import { useLayoutEffect, useRef } from 'react'

const GLIDE_MS = 240
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The dimmed page with a rounded "hole" around the target and a soft sky ring.
 * Between steps the hole glides from the old spot to the new one (transform only, 240 ms). On the first step, or when
 * coming from a centred card, it fades in. With "reduce motion" on, it just appears. Steps with `action` get a
 * breathing outer ring (opacity only). The 4 click-blockers in ProductTour stay as they are.
 */
function TourSpotlight({ spot, stepId, blur = false, pulse = false }) {
  const ref = useRef(null)
  const lastRef = useRef(undefined) // undefined: first run | null: last run had no spot | object: where the spot was

  useLayoutEffect(() => {
    const element = ref.current
    const before = lastRef.current
    lastRef.current = spot ? { stepId, left: spot.left, top: spot.top } : null
    if (!element || typeof element.animate !== 'function' || prefersReducedMotion()) return

    if (spot && before && before.stepId !== stepId) {
      element.animate(
        [{ transform: `translate(${before.left - spot.left}px, ${before.top - spot.top}px)` }, { transform: 'translate(0, 0)' }],
        { duration: GLIDE_MS, easing: EASE }
      )
    } else if (before === undefined || before === null || (!spot && before)) {
      element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: GLIDE_MS, easing: 'ease-out' })
    }
  }, [spot, stepId])

  if (!spot) {
    // blurred only behind the centred welcome / closing cards. While a target is being looked up it is a plain dim,
    // so the screen never blurs and un-blurs by itself.
    return <div ref={ref} aria-hidden="true" className={`pointer-events-none fixed inset-0 z-[90] bg-black/45 ${blur ? 'backdrop-blur-[2px]' : ''}`} />
  }

  return (
    // the huge shadow is the dimmed page; the box itself is the "hole" around the element
    <div
      ref={ref}
      aria-hidden="true"
      style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height, boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.5)' }}
      className="pointer-events-none fixed z-[90] rounded-lg"
    >
      {/* the ring lives on child elements: the inline shadow above would replace a ring class on the hole itself */}
      <span
        aria-hidden="true"
        className={`absolute -inset-1 rounded-xl ring-4 ${pulse ? 'animate-pulse ring-sky-500/40 motion-reduce:animate-none dark:ring-sky-400/40' : 'ring-sky-500/15 dark:ring-sky-400/15'}`}
      />
      <span aria-hidden="true" className="absolute inset-0 rounded-lg ring-2 ring-sky-500/70 dark:ring-sky-400/70" />
    </div>
  )
}

export default TourSpotlight
