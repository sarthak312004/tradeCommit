import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLocation } from 'react-router'
import { guidanceReducer, initialGuidanceState, isSuspended } from '../utils/guidance'
import { isTradingLoopEnabled } from '../utils/tradingLoop'
import { GuidanceContext } from './guidanceContext'

const SETTLE_MS = 40 // requests made in the same moment are collected, then ONE is started
// Our own surfaces are marked; every other aria-modal element (forms, drawers, dialogs) counts as "the app is busy".
const FOREIGN_MODAL = '[aria-modal="true"]:not([data-tour-card]):not([data-guide-surface])'
const isVisibleForeignModal = (element) => (
  !element.closest('[hidden], [aria-hidden="true"], [inert]')
  && window.getComputedStyle(element).display !== 'none'
)

/**
 * Mounted once by Home. Owns which guide (Trading Loop, Playbook, legacy tour) is on screen. Guides ask with
 * request(id), render only while `activeId === id`, and give control back with release(id).
 */
export default function GuidanceProvider({ children }) {
  const { pathname } = useLocation()
  const [state, dispatch] = useReducer(guidanceReducer, initialGuidanceState)
  const routeRef = useRef(pathname)

  useEffect(() => {
    routeRef.current = pathname
    dispatch({ type: 'navigate', route: pathname })
  }, [pathname])

  // is a real form/dialog open? (debounced; our own guide surfaces are excluded)
  useEffect(() => {
    let timer
    const check = () => {
      const open = [...document.querySelectorAll(FOREIGN_MODAL)].some(isVisibleForeignModal)
      dispatch({ type: 'modal', open })
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(check, SETTLE_MS)
    }
    check()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'aria-hidden', 'hidden', 'inert'],
    })
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  // start exactly one waiting request, once nothing is active and no form is open
  useEffect(() => {
    if (state.active || state.modalOpen || state.pending.length === 0) return undefined
    const timer = setTimeout(() => dispatch({ type: 'resolve' }), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [state.active, state.modalOpen, state.pending])

  const request = useCallback((id, { trigger = 'auto', meta = null } = {}) => {
    dispatch({ type: 'request', id, trigger, meta, route: routeRef.current, loopEnabled: isTradingLoopEnabled() })
  }, [])
  const release = useCallback((id) => dispatch({ type: 'release', id, route: routeRef.current }), [])
  const handoff = useCallback((from, to, fromMeta) => dispatch({ type: 'handoff', from, to, fromMeta }), [])

  const value = useMemo(() => ({
    activeId: state.active?.id ?? null,
    activeTrigger: state.active?.trigger ?? null,
    activeMeta: state.active?.meta ?? null,
    activeSeq: state.active?.seq ?? 0,
    pausedId: state.paused?.id ?? null,
    suspended: isSuspended(state),
    modalOpen: state.modalOpen,
    request,
    release,
    handoff,
  }), [state, request, release, handoff])

  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>
}
