import { useEffect, useState } from 'react'

// 'none'      the step has no target (centred card)
// 'searching' just started looking
// 'waiting'   not on screen yet (data still loading); the page stays usable while we keep looking
// 'found'     `rect` is the element's box in viewport coordinates
// 'missing'   gave up: the tour skips this step
const WAIT_NOTICE_MS = 600
const GIVE_UP_MS = 8000 // slow networks: data-backed targets can take several seconds
const LOSS_GRACE_MS = 1500 // the element re-mounting (a journal being created, a list refreshing) is not a reason to react
export const TARGET_HIGHLIGHT_PADDING = 5

const readRect = (element) => {
  const rect = element.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  if (window.getComputedStyle(element).visibility === 'hidden') return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

export const isFullyVisible = (element, rect) => {
  const bounds = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  }

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor)
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const ancestorRect = ancestor.getBoundingClientRect()
      const left = ancestorRect.left + ancestor.clientLeft
      const top = ancestorRect.top + ancestor.clientTop
      if (style.overflowX !== 'visible') {
        bounds.left = Math.max(bounds.left, left)
        bounds.right = Math.min(bounds.right, left + ancestor.clientWidth)
      }
      if (style.overflowY !== 'visible') {
        bounds.top = Math.max(bounds.top, top)
        bounds.bottom = Math.min(bounds.bottom, top + ancestor.clientHeight)
      }
    }
  }

  return rect.left >= bounds.left
    && rect.top >= bounds.top
    && rect.left + rect.width <= bounds.right
    && rect.top + rect.height <= bounds.bottom
}

// A selector can match several elements (desktop and mobile variants of one control): take the first one that is on screen.
// When the Flywheel Demo stage is mounted, prefer targets inside `[data-demo-stage]` over background app elements.
export const findVisibleTarget = (selector) => {
  const demoStage = document.querySelector('[data-demo-stage]')
  const roots = demoStage ? [demoStage, document] : [document]
  for (const root of roots) {
    for (const element of root.querySelectorAll(selector)) {
      const rect = readRect(element)
      if (rect) return { element, rect, isFullyVisible: isFullyVisible(element, rect) }
    }
  }
  return null
}

const sameRect = (a, b) =>
  a === b || (a && b && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5)

export const isOffscreen = (rect) => rect.top < 0 || rect.top + rect.height > window.innerHeight || rect.left < 0 || rect.left + rect.width > window.innerWidth

/**
 * Follows the element matching `selector` frame by frame, so the highlight stays on it while the sidebar slides,
 * the window resizes or lazy content pushes things around. `key` changes with every step.
 */
export function useTargetRect(selector, key) {
  const [state, setState] = useState({ key: null, rect: null, status: 'none', isFullyVisible: false })

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
      setState((prev) => (
        prev.key === key
        && prev.status === next.status
        && sameRect(prev.rect, next.rect)
        && prev.isFullyVisible === next.isFullyVisible
          ? prev
          : { key, ...next }
      ))

    const tick = () => {
      if (cancelled) return
      const match = findVisibleTarget(selector)
      const element = match?.element
      const rect = match?.rect ?? null

      if (rect) {
        hasFound = true
        lostSince = null
        if (!scrolled) {
          scrolled = true
          if (isOffscreen(rect)) element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
        }
        publish({ rect, status: 'found', isFullyVisible: match.isFullyVisible })
      } else if (hasFound) {
        // Gone after we had it. A brief re-mount keeps the last known position (no flashing); a real removal gives up.
        lostSince ??= performance.now()
        if (performance.now() - lostSince >= LOSS_GRACE_MS) publish({ rect: null, status: 'missing', isFullyVisible: false })
      } else {
        const waited = performance.now() - startedAt
        publish({ rect: null, status: waited > GIVE_UP_MS ? 'missing' : waited > WAIT_NOTICE_MS ? 'waiting' : 'searching', isFullyVisible: false })
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [selector, key])

  if (!selector) return { rect: null, status: 'none', isFullyVisible: false }
  return state.key === key ? state : { rect: state.rect, status: 'searching', isFullyVisible: false }
}
