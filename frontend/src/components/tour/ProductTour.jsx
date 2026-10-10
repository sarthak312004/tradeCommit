import { useContext, useEffect, useEffectEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { journalContext } from '../../context/Context'
import { useProfile } from '../../hooks/useProfile'
import { TOUR_REPLAY_EVENT, getTourStatus, hasTourEnded, markTourEnded, setTourStatus } from '../../utils/productTour'
import TourCard from './TourCard'
import { TOURS, buildSteps } from './tourSteps'
import { useTargetRect } from './useTargetRect'

const START_DELAY_MS = 700 // let the page settle before the first card appears
const SPOT_PADDING = 6

const isPlannerPath = (pathname) => pathname.startsWith('/planner/')
const pageOf = (tourId) => (tourId === 'planner' ? 'planner' : 'journals')

function TourSession({ tourId, hasJournal, username, name, isSidebarOpen, setIsSidebarOpen, onEnd }) {
  const [steps] = useState(() => buildSteps(tourId, hasJournal))
  const [nav, setNav] = useState({ index: 0, direction: 1 })
  const step = steps[nav.index]
  const { rect, status } = useTargetRect(step.target, `${tourId}:${step.id}`)

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
  }, [step.sidebar, isSidebarOpen, setIsSidebarOpen])

  const end = (completed) => {
    const covered = new Set([tourId])
    // a replay that ran straight on into the journal steps covers that tour too
    if (tourId === 'main' && steps.some((item) => TOURS.journal.includes(item))) covered.add('journal')
    // skipping the first tour dismisses the others as well; finishing it leaves them waiting for their moment
    if (!completed && tourId === 'main') ['journal', 'planner'].forEach((id) => covered.add(id))

    covered.forEach((id) => {
      setTourStatus(username, id, 'done')
      markTourEnded(username, id)
    })
    onEnd()
  }

  const goNext = () => {
    if (nav.index >= steps.length - 1) end(true)
    else setNav({ index: nav.index + 1, direction: 1 })
  }
  const goBack = () => {
    if (nav.index > 0) setNav({ index: nav.index - 1, direction: -1 })
  }

  // a step whose target never showed up is skipped, in the direction of travel
  useEffect(() => {
    if (status !== 'missing') return
    if (nav.direction < 0) setNav((current) => ({ index: Math.max(0, current.index - 1), direction: -1 }))
    else if (nav.index >= steps.length - 1) end(true)
    else setNav((current) => ({ index: current.index + 1, direction: 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts only to this step giving up
  }, [status])

  const handleKey = useEffectEvent((event) => {
    if (event.key === 'Escape') end(false)
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
  if (status === 'waiting' || status === 'missing') return null

  const spot = rect && {
    left: rect.left - SPOT_PADDING,
    top: rect.top - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  }

  return createPortal(
    <>
      {/* swallows clicks, so the page behind cannot change while a hint is open */}
      <div aria-hidden="true" className="fixed inset-0 z-[89]" />

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
          onSkip={() => end(false)}
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
 *   main     first visit: sidebar, feedback, and what to do first
 *   journal  the first time a journal is on screen (a new account has none until it creates one)
 *   planner  the first time a planner is opened
 */
function ProductTour({ isSidebarOpen, setIsSidebarOpen }) {
  const { pathname } = useLocation()
  const { profile } = useProfile()
  const { selectedJournal } = useContext(journalContext)
  const [activeTour, setActiveTour] = useState(null)

  const username = profile?.username
  const name = profile?.fullname?.trim().split(/\s+/)[0] ?? ''
  const onPlanner = isPlannerPath(pathname)
  // a journal still being created (temporary id) does not count: wait until it is real, so nothing re-mounts under the tour
  const journalId = selectedJournal && !String(selectedJournal.id).startsWith('pending-') ? selectedJournal.id : null

  // start by itself when a tour is waiting for this page. Order: main first, then journal / planner.
  useEffect(() => {
    if (!username || activeTour) return undefined

    const waiting = (tourId) => getTourStatus(username, tourId) === 'pending' && !hasTourEnded(username, tourId)
    let candidate = null
    if (onPlanner) candidate = waiting('planner') && !waiting('main') ? 'planner' : null
    else if (waiting('main')) candidate = 'main'
    else if (waiting('journal') && journalId) candidate = 'journal'
    if (!candidate) return undefined

    const timer = setTimeout(() => setActiveTour(candidate), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [username, onPlanner, journalId, activeTour])

  // "Take the product tour" in the profile menu: the planner page replays its walkthrough, everything else the main tour
  useEffect(() => {
    const replay = () => setActiveTour(onPlanner ? 'planner' : 'main')
    window.addEventListener(TOUR_REPLAY_EVENT, replay)
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, replay)
  }, [onPlanner])

  // a tour belongs to the page it started on
  if (!username || !activeTour || pageOf(activeTour) !== (onPlanner ? 'planner' : 'journals')) return null

  return (
    <TourSession
      key={activeTour}
      tourId={activeTour}
      hasJournal={Boolean(journalId)}
      username={username}
      name={name}
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
      onEnd={() => setActiveTour(null)}
    />
  )
}

export default ProductTour
