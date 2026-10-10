import { useEffect, useState } from 'react'

// 'none'      the step has no target (centred card)
// 'searching' just started looking
// 'waiting'   not on screen yet (data still loading); the page stays usable while we keep looking
// 'found'     `rect` is the element's box in viewport coordinates
// 'missing'   gave up: the tour skips this step
const WAIT_NOTICE_MS = 600
const GIVE_UP_MS = 4000
const LOSS_GRACE_MS = 1500 // the element re-mounting (a journal being created, a list refreshing) is not a reason to react

const readRect = (element) => {
  const rect = element.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  if (window.getComputedStyle(element).visibility === 'hidden') return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

const sameRect = (a, b) =>
  a === b || (a && b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5)

const isOffscreen = (rect) => rect.top < 0 || rect.top + rect.height > window.innerHeight || rect.left < 0 || rect.left + rect.width > window.innerWidth

/**
 * Follows the element matching `selector` frame by frame, so the highlight stays on it while the sidebar slides,
 * the window resizes or lazy content pushes things around. `key` changes with every step.
 */
export function useTargetRect(selector, key) {
  const [state, setState] = useState({ key: null, rect: null, status: 'none' })

  useEffect(() => {
    if (!selector) return undefined

    const startedAt = performance.now()
    let frame = 0
    let cancelled = false
    let scrolled = false
    let lostSince = null // set while an element we already found is missing for a moment
    let hasFound = false
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const publish = (next) =>
      setState((prev) => (prev.key === key && prev.status === next.status && sameRect(prev.rect, next.rect) ? prev : { key, ...next }))

    const tick = () => {
      if (cancelled) return
      const element = document.querySelector(selector)
      const rect = element ? readRect(element) : null

      if (rect) {
        hasFound = true
        lostSince = null
        if (!scrolled) {
          scrolled = true
          if (isOffscreen(rect)) element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
        }
        publish({ rect, status: 'found' })
      } else if (hasFound) {
        // Gone after we had it. A brief re-mount keeps the last known position (no flashing); a real removal gives up.
        lostSince ??= performance.now()
        if (performance.now() - lostSince >= LOSS_GRACE_MS) publish({ rect: null, status: 'missing' })
      } else {
        const waited = performance.now() - startedAt
        publish({ rect: null, status: waited > GIVE_UP_MS ? 'missing' : waited > WAIT_NOTICE_MS ? 'waiting' : 'searching' })
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [selector, key])

  if (!selector) return { rect: null, status: 'none' }
  return state.key === key ? state : { rect: null, status: 'searching' }
}
