import { useCallback, useLayoutEffect, useRef } from 'react'

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const OFFSCREEN = 'translateX(calc(100% + 2rem))'

/**
 * Slide-in / slide-out for the right-hand drawers, driven by the Web Animations API instead of React state.
 *
 * Why: the old version rendered the drawer, waited two animation frames, then called setState to start the slide.
 * That cost two frames of pure waiting, and the extra render of the whole form landed on the exact frame the
 * transition began, so the drawer appeared and then "jumped" into motion. Here the animation starts in a layout
 * effect, before the first paint, and only touches transform and opacity, so it runs on the compositor and keeps
 * moving smoothly even while the main thread is busy building the form.
 *
 * @param {object} overlayRef  the dimmed full-screen wrapper (fades)
 * @param {object} panelRef    the drawer panel (slides)
 * @param {number} duration    ms; 0 turns the motion off
 * @returns {{ slideOut: () => void }}  call slideOut() when closing, then unmount after `duration` ms
 */
export function useDrawerMotion({ overlayRef, panelRef, duration }) {
  const durationRef = useRef(duration)

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay?.animate || !panel?.animate || !durationRef.current) return undefined
    const timing = { duration: durationRef.current, easing: EASE, fill: 'backwards' }
    const animations = [
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], timing),
      panel.animate([{ transform: OFFSCREEN }, { transform: 'translateX(0)' }], timing)
    ]
    return () => animations.forEach((animation) => animation.cancel())
  }, [overlayRef, panelRef])

  const slideOut = useCallback(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay?.animate || !panel?.animate || !durationRef.current) return
    const timing = { duration: durationRef.current, easing: EASE, fill: 'forwards' }
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], timing)
    panel.animate([{ transform: 'translateX(0)' }, { transform: OFFSCREEN }], timing)
  }, [overlayRef, panelRef])

  return { slideOut }
}
