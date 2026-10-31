import { useContext, useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { journalContext, plannerContext } from '../../context/Context'
import { useProfile } from '../../hooks/useProfile'
import { TOUR_REPLAY_EVENT, clearTourProgress, getTourProgress, getTourStatus, hasTourEnded, markTourEnded, setTourActive, setTourProgress, setTourStatus } from '../../utils/productTour'
import TourCard from './TourCard'
import { TOURS, buildSteps } from './tourSteps'
import { useTargetRect } from './useTargetRect'

const START_DELAY_MS = 700 // let the page settle before the first card appears
const SPOT_PADDING = 6

const isPlannerPath = (pathname) => pathname.startsWith('/planner/')
const pageOf = (tourId) => (tourId === 'planner' ? 'planner' : 'journals')

function TourSession({ tourId, hasJournal, username, name, resumeId, isSidebarOpen, setIsSidebarOpen, autoCloseSidebar, onEnd }) {
  const [steps] = useState(() => buildSteps(tourId, hasJournal))
  // a refresh or a trip to another page resumes at the step the tour was on
  const [nav, setNav] = useState(() => ({ index: Math.max(0, resumeId ? steps.findIndex((item) => item.id === resumeId) : 0), direction: 1 }))
  const [suspended, setSuspended] = useState(false)
  const shownRef = useRef(false) // at least one card has been on screen
  const reachedRef = useRef(nav.index) // furthest step shown
  const step = steps[nav.index]
  const { rect, status } = useTargetRect(step.target, `${tourId}:${step.id}`)

  useEffect(() => {
    setTourProgress(username, tourId, step.id)
  }, [username, tourId, step.id])

  useEffect(() => {
    if (status !== 'found' && status !== 'none') return
    shownRef.current = true
    reachedRef.current = Math.max(reachedRef.current, nav.index)
  }, [status, nav.index])

  // another dialog or form opened (e.g. the highlighted button was clicked): step aside until it closes
  useEffect(() => {
    const check = () => setSuspended(Boolean(document.querySelector('[aria-modal="true"]:not([data-tour-card])')))
    check()
    const timer = setInterval(check, 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setTourActive(username, tourId, true)
    return () => setTourActive(username, tourId, false)
  }, [username, tourId])

  // hand focus back to wherever it was when the tour ends
  useEffect(() => {
    const opener = document.activeElement
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [])

  // steps that point into the sidebar need it open
  useEffect(() => {
    if (step.sidebar && !isSidebarOpen) setIsSidebarOpen(true)
    // on phones the sidebar is a menu on top of the page: put it away for steps that point at the page itself
    else if (autoCloseSidebar && !step.sidebar && isSidebarOpen) setIsSidebarOpen(false)
  }, [step.sidebar, isSidebarOpen, setIsSidebarOpen, autoCloseSidebar])

  // Skip, finish and replay only touch the tours that actually ran in this session; every other tour keeps its status.
  // persist=false: no step could be shown at all (targets never appeared), so the tour stays pending for a later visit.
  const end = (persist = true) => {
    if (!persist) {
      markTourEnded(username, tourId)
      onEnd({ persist: false })
      return
    }
    const covered = new Set([tourId])
    // a main tour that ran on into the journal steps covers that tour only if those steps were reached
    const firstJournalStep = tourId === 'main' ? steps.findIndex((item) => TOURS.journal.includes(item)) : -1
    if (firstJournalStep >= 0 && reachedRef.current >= firstJournalStep) covered.add('journal')

    covered.forEach((id) => {
      setTourStatus(username, id, 'done')
      clearTourProgress(username, id)
      markTourEnded(username, id)
    })
    onEnd({ persist: true })
  }

  const goNext = () => {
    if (nav.index >= steps.length - 1) end()
    else setNav({ index: nav.index + 1, direction: 1 })
  }
  const goBack = () => {
    if (nav.index > 0) setNav({ index: nav.index - 1, direction: -1 })
  }

  // a step whose target never showed up is skipped, in the direction of travel
  useEffect(() => {
    if (status !== 'missing') return
    if (nav.direction < 0 && nav.index > 0) setNav((current) => ({ index: current.index - 1, direction: -1 }))
    else if (nav.index >= steps.length - 1) end(shownRef.current)
    else setNav((current) => ({ index: current.index + 1, direction: 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to this step giving up
  }, [status])

  const handleKey = useEffectEvent((event) => {
    if (suspended || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target
    if (target instanceof HTMLElement) {
      // never steal keys from text fields, or arrows from other controls (tabs, menus) on the page
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key !== 'Escape' && target !== document.body && !target.closest('[data-tour-card]')) return
    }
    if (event.key === 'Escape') end()
    else if (event.key === 'ArrowRight') goNext()
    else if (event.key === 'ArrowLeft') goBack()
    else return
    event.preventDefault()
  })
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // the page is still loading what this step points at: leave it usable, keep looking
  if (suspended || status === 'waiting' || status === 'missing' || (step.sidebar && !isSidebarOpen)) return null

  const spot = rect && {
    left: rect.left - SPOT_PADDING,
    top: rect.top - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  }

  return createPortal(
    <>
      {/* swallows clicks, so the page behind cannot change while a hint is open; the highlighted element stays clickable */}
      {spot ? (
        <>
          <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[89]" style={{ height: Math.max(0, spot.top) }} />
          <div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-[89]" style={{ top: Math.max(0, spot.top) + spot.height }} />
          <div aria-hidden="true" className="fixed left-0 z-[89]" style={{ top: Math.max(0, spot.top), height: spot.height, width: Math.max(0, spot.left) }} />
          <div aria-hidden="true" className="fixed right-0 z-[89]" style={{ top: Math.max(0, spot.top), height: spot.height, left: spot.left + spot.width }} />
        </>
      ) : (
        <div aria-hidden="true" className="fixed inset-0 z-[89]" />
      )}

      {spot ? (
        // the huge shadow is the dimmed page; the box itself is the "hole" around the element
        <div
          aria-hidden="true"
          style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height, boxShadow: '0 0 0 9999px rgba(9, 9, 11, 0.5)' }}
          className="pointer-events-none fixed z-[90] rounded-lg ring-2 ring-sky-500/70 transition-[left,top,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:ring-sky-400/70"
        />
      ) : (
        // blurred only behind the centred welcome / closing cards. While a target is being looked up it is a plain dim,
        // so the screen never blurs and un-blurs by itself.
        <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-[90] bg-black/45 ${status === 'none' ? 'backdrop-blur-[2px]' : ''}`} />
      )}

      {status !== 'searching' && (
        <TourCard
          key={step.id}
          step={step}
          index={nav.index}
          total={steps.length}
          rect={spot}
          name={name}
          onNext={goNext}
          onBack={goBack}
          onSkip={() => end()}
        />
      )}
    </>,
    document.body
  )
}

/**
 * First-run guide. Starts by itself, once per tour, for an account that has just finished onboarding (the pages set the
 * flags), and again whenever "Take the product tour" is chosen in the profile menu. Rendered by Home so the sidebar and
 * every page are already on screen behind it.
 *
 *   main     first visit: welcome, create one focused journal, and start logging
 *   journal  the first time a journal is on screen (a new account has none until it creates one)
 *   planner  the first time a planner is opened
 */
function ProductTour({ isSidebarOpen, setIsSidebarOpen, autoCloseSidebar = false, onTourEnd }) {
  const { pathname } = useLocation()
  const { profile } = useProfile()
  const { selectedJournal, isLoading: journalsLoading } = useContext(journalContext)
  const plannersLoading = useContext(plannerContext)?.isLoading
  const [activeTour, setActiveTour] = useState(null)

  const username = profile?.username
  const name = profile?.fullname?.trim().split(/\s+/)[0] ?? ''
  const onPlanner = isPlannerPath(pathname)
  // a journal still being created (temporary id) does not count: wait until it is real, so nothing re-mounts under the tour
  const journalId = selectedJournal && !String(selectedJournal.id).startsWith('pending-') ? selectedJournal.id : null

  // start by itself when a tour is waiting for this page. Order: main first, then journal / planner.
  useEffect(() => {
    // wait until journals and planners have loaded, so a returning user is not shown "create your first journal"
    if (!username || activeTour || journalsLoading || plannersLoading) return undefined

    const waiting = (tourId) => getTourStatus(username, tourId) === 'pending' && !hasTourEnded(username, tourId)
    let candidate = null
    if (onPlanner) candidate = waiting('planner') ? 'planner' : null
    else if (waiting('main')) candidate = 'main'
    else if (waiting('journal') && journalId) candidate = 'journal'
    if (!candidate) return undefined

    let timer
    const attempt = () => {
      // never open on top of another dialog or form (e.g. a plan form restored after a refresh): try again shortly
      if (document.querySelector('[aria-modal="true"]')) {
        timer = setTimeout(attempt, 1000)
        return
      }
      setTourActive(username, candidate, true)
      setActiveTour(candidate)
    }
    timer = setTimeout(attempt, START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [username, onPlanner, journalId, activeTour, journalsLoading, plannersLoading])

  // "Take the product tour" in the profile menu: the planner page replays its walkthrough, everything else the main tour
  useEffect(() => {
    const replay = () => {
      if (!username) return
      const tourId = onPlanner ? 'planner' : 'main'
      clearTourProgress(username, tourId) // a replay always starts from the first step
      setTourActive(username, tourId, true)
      setActiveTour(tourId)
    }
    window.addEventListener(TOUR_REPLAY_EVENT, replay)
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, replay)
  }, [onPlanner, username])

  // a tour belongs to the page it started on; leaving that page puts it away (its step is remembered) so the page you
  // arrive on can offer its own tour
  const onTourPage = Boolean(activeTour) && pageOf(activeTour) === (onPlanner ? 'planner' : 'journals')
  useEffect(() => {
    if (activeTour && !onTourPage) setActiveTour(null)
  }, [activeTour, onTourPage])

  if (!username || !activeTour || !onTourPage) return null

  return (
    <TourSession
      key={activeTour}
      tourId={activeTour}
      hasJournal={Boolean(journalId)}
      username={username}
      name={name}
      resumeId={getTourProgress(username, activeTour)}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      autoCloseSidebar={autoCloseSidebar}
      onEnd={({ persist = true } = {}) => {
        const endedTour = activeTour
        setActiveTour(null)
        // after the first-run tour, hand the user to the next action (Home opens the "new journal" form)
        if (endedTour === 'main' && persist) onTourEnd?.()
      }}
    />
  )
}

export default ProductTour
