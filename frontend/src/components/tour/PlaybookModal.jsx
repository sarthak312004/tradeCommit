import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { journalContext, plannerContext } from '../../context/Context'
import { OPEN_PLAYBOOK_EVENT } from '../../utils/productTour'
import { CloseIcon } from '../../utils/Icons.jsx'
import { controlNeutral, controlPrimary, focusRing } from '../common/controlStyles'

// ---- Snapshots: small, static pictures of how the real screens look. They are illustrations, never the user's data.

const frame = 'rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/[0.10] dark:bg-white/[0.03]'
const label = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400'
const line = (w) => <span className="block h-1.5 rounded-full bg-zinc-300/80 dark:bg-white/[0.14]" style={{ width: w }} />

function ProblemSnapshot() {
  const risks = ['30%', '90%', '45%', '100%', '20%']
  return (
    <div className={frame}>
      <p className={label}>Five trades, no process</p>
      <ul className="mt-3 space-y-2.5">
        {risks.map((width, index) => (
          <li key={width} className="flex items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-300">
            <span className="w-12 shrink-0">Trade {index + 1}</span>
            <span className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-white/[0.08]">
              <span className="block h-2 rounded-full bg-rose-400/80" style={{ width }} />
            </span>
            <span className="shrink-0 rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-white/[0.18] dark:text-zinc-400">no reason</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Bar = risk taken. Same market, a different size and logic every time.</p>
    </div>
  )
}

function PlaybookSnapshot() {
  const rows = [
    ['Setup', 'The pattern you wait for', '70%'],
    ['Entry rule', 'What must be true to enter', '85%'],
    ['Stop', 'Where the idea is wrong', '45%'],
    ['Risk', 'Most you will lose on this trade', '55%'],
  ]
  return (
    <div className={frame}>
      <div className="flex items-center justify-between">
        <p className={label}>Plan · Monday</p>
        <span className="rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-400/10 dark:text-sky-300">Written before the session</span>
      </div>
      <dl className="mt-3 divide-y divide-zinc-200 dark:divide-white/[0.08]">
        {rows.map(([term, hint, width]) => (
          <div key={term} className="py-2.5">
            <dt className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">{term}</dt>
            <dd className="mt-1.5 space-y-1.5">
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>
              {line(width)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function CaptureSnapshot() {
  return (
    <div className={frame}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-white/[0.14] dark:bg-panel">Planner</span>
        <svg aria-hidden="true" viewBox="0 0 24 8" className="h-2 w-6 text-sky-600 dark:text-sky-400"><path d="M0 4h21M17 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-white/[0.14] dark:bg-panel">Journal</span>
        <span className="ml-auto text-[10px] text-zinc-500 dark:text-zinc-400">connected</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/[0.10] dark:bg-panel">
          <p className={label}>Planned</p>
          <div className="mt-2.5 space-y-2">{line('90%')}{line('70%')}{line('55%')}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/[0.10] dark:bg-panel">
          <p className={label}>Taken</p>
          <div className="mt-2.5 space-y-2">{line('80%')}{line('95%')}{line('40%')}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-zinc-600 dark:text-zinc-300">
        {['Asset', 'Entry', 'Exit', 'Stop', 'Why I took it'].map((field) => (
          <span key={field} className="rounded-full border border-zinc-300 px-2 py-0.5 dark:border-white/[0.16]">{field}</span>
        ))}
      </div>
    </div>
  )
}

function MentorSnapshot() {
  const sections = ['Did you follow your own rules?', 'Where execution drifted from the plan', 'One change for next week']
  return (
    <div className={frame}>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-5 w-5 rounded-full bg-gradient-to-br from-[#e08a68] to-[#c4623f]" />
        <p className={label}>Mentor review · format</p>
      </div>
      <ul className="mt-3 space-y-3">
        {sections.map((title, index) => (
          <li key={title} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/[0.10] dark:bg-panel">
            <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">{index + 1}. {title}</p>
            <div className="mt-2 space-y-1.5">{line('100%')}{line(index === 1 ? '60%' : '80%')}</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">Written from your strategy, plans and logged trades. Nothing is invented.</p>
    </div>
  )
}

function EdgeSnapshot() {
  const loop = ['Plan', 'Execute', 'Review', 'Adjust']
  const metrics = [['Win rate', '55%'], ['Drawdown', '35%'], ['Profit factor', '70%']]
  return (
    <div className={frame}>
      <ol className="flex items-center justify-between gap-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
        {loop.map((step, index) => (
          <li key={step} className="flex items-center gap-1">
            <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 dark:border-white/[0.14] dark:bg-panel">{step}</span>
            {index < loop.length - 1 && <span aria-hidden="true" className="text-sky-600 dark:text-sky-400">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-center text-[10px] text-zinc-500 dark:text-zinc-400">…and back to Plan</p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {metrics.map(([name, width]) => (
          <div key={name} className="rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-white/[0.10] dark:bg-panel">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{name}</p>
            <div className="mt-2.5 h-8 rounded bg-zinc-100 dark:bg-white/[0.05]">
              <span className="block h-full rounded bg-sky-500/70" style={{ width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const CHAPTERS = [
  {
    id: 'problem',
    title: 'The Problem',
    heading: 'Without a process, results are noise',
    body: 'Two trades with the same setup end up with different sizes, stops and exits depending on your mood that day. Win or lose, you cannot tell whether the decision itself was any good.',
    why: 'A profit from a bad process is luck you cannot repeat. A loss from a good one is just variance.',
    Snapshot: ProblemSnapshot,
    caption: 'Illustration of trades taken without a plan',
  },
  {
    id: 'playbook',
    title: 'Build Your Playbook',
    heading: 'Write the rules before the session',
    body: 'A planner holds dated plans: the setup you wait for, your entry rule, where the idea is wrong (the stop) and how much you risk. You decide in advance, while you are calm.',
    why: 'Rules written before a trade are the only ones you can fairly measure the trade against.',
    Snapshot: PlaybookSnapshot,
    caption: 'Illustration of a plan in the Trade Planner',
  },
  {
    id: 'reality',
    title: 'Capture Reality',
    heading: 'Log what actually happened',
    body: 'Connect a planner to a journal, then log each trade with entry, exit, stop and one sentence on why you took it. Your plan and your result now sit side by side.',
    why: 'The gap between what you planned and what you did is where most of your improvement is hiding.',
    Snapshot: CaptureSnapshot,
    caption: 'Illustration of a planner connected to a journal',
  },
  {
    id: 'mentor',
    title: 'AI Mentor',
    heading: 'Feedback on execution, not opinions',
    body: 'The mentor reads your written strategy, your plans and the trades you really logged, then checks whether you followed your own rules. It reviews only real entries, and it needs a few trades before the first review.',
    why: 'A neutral second reader spots the patterns you would otherwise explain away.',
    Snapshot: MentorSnapshot,
    caption: 'Illustration of the review format, not a real review',
  },
  {
    id: 'edge',
    title: 'Improve Your Edge',
    heading: 'Review, change one rule, repeat',
    body: 'Analysis turns your trades into win rate, drawdown and profit factor, and the mentor points out mistakes that keep coming back. Adjust one rule at a time, then measure again.',
    why: 'Small, measured changes compound. Big rewrites never tell you what actually worked.',
    Snapshot: EdgeSnapshot,
    caption: 'Illustration of the improvement loop and Analysis metrics',
  },
]

/**
 * THE TRADING PLAYBOOK: a short read-only walkthrough in a modal. It explains the workflow (plan → log → review →
 * improve) with snapshots of the real screens and why each step matters. It never highlights or blocks the app and
 * does not touch tour progress. Opened from the profile menu or the empty-journal screen.
 */
function PlaybookModal({ onCreate }) {
  const { journals = [] } = useContext(journalContext) ?? {}
  const { planners = [] } = useContext(plannerContext) ?? {}
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const dialogRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    const show = () => {
      openerRef.current = document.activeElement
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(OPEN_PLAYBOOK_EVENT, show)
    return () => window.removeEventListener(OPEN_PLAYBOOK_EVENT, show)
  }, [])

  const close = () => {
    setOpen(false)
    const opener = openerRef.current
    if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return undefined
    dialogRef.current?.focus({ preventScroll: true })
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      } else if (event.key === 'ArrowRight') setIndex((current) => Math.min(CHAPTERS.length - 1, current + 1))
      else if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1))
      else if (event.key === 'Tab') {
        const items = [...dialogRef.current.querySelectorAll('button:not([disabled])')]
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads a ref
  }, [open])

  if (!open) return null

  const chapter = CHAPTERS[index]
  const isLast = index === CHAPTERS.length - 1
  const Snapshot = chapter.Snapshot
  const hasPlanner = planners.length > 0
  const hasJournal = journals.length > 0

  // the last chapter offers the real first actions, through the sidebar's own create forms, only for what is missing
  const startWith = (section) => {
    close()
    onCreate?.(section)
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[4px] sm:items-center sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-title"
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-3xl animate-[fadeIn_.2s_ease-out] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white text-left shadow-[0_24px_80px_-20px_rgba(0,0,0,0.5)] outline-none motion-reduce:animate-none sm:rounded-2xl dark:border-white/[0.12] dark:bg-panel-hi"
      >
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-white/[0.10]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">The Trading Playbook</p>
          <button type="button" onClick={close} aria-label="Close the Trading Playbook" className={`grid h-8 w-8 cursor-pointer place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${focusRing}`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <nav aria-label="Playbook chapters" className="flex gap-1 px-5 pt-4">
          {CHAPTERS.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-current={itemIndex === index ? 'step' : undefined}
              aria-label={`Chapter ${itemIndex + 1}: ${item.title}`}
              className={`group flex-1 cursor-pointer rounded text-left ${focusRing}`}
            >
              <span className={`block h-1 rounded-full transition-colors duration-500 motion-reduce:transition-none ${itemIndex <= index ? 'bg-sky-600 dark:bg-sky-400' : 'bg-zinc-200 group-hover:bg-zinc-300 dark:bg-white/[0.12]'}`} />
              <span className={`mt-1.5 hidden truncate text-[10px] font-medium sm:block ${itemIndex === index ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>{item.title}</span>
            </button>
          ))}
        </nav>

        <div key={chapter.id} className="tc-pb-rise grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 py-6 sm:grid-cols-[1fr_1.1fr] sm:gap-8 sm:py-7">
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Chapter {index + 1} of {CHAPTERS.length} · {chapter.title}</p>
            <h2 id="playbook-title" className="mt-2 text-xl font-semibold leading-snug tracking-[-0.03em] text-zinc-900 sm:text-2xl dark:text-zinc-50">{chapter.heading}</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{chapter.body}</p>
            <p className="mt-4 border-l-2 border-sky-500/60 pl-3 text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold">Why it matters. </span>
              {chapter.why}
            </p>
          </div>
          <figure className="flex flex-col justify-center" aria-label={chapter.caption}>
            <div aria-hidden="true"><Snapshot /></div>
            <figcaption className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">{chapter.caption}</figcaption>
          </figure>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3.5 dark:border-white/[0.10]">
          <button type="button" onClick={close} className={`cursor-pointer rounded px-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${focusRing}`}>
            {isLast ? 'Close' : 'Skip'}
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className={controlNeutral}>Back</button>}
            {!isLast && <button type="button" onClick={() => setIndex(index + 1)} className={controlPrimary}>Next</button>}
            {isLast && !hasPlanner && <button type="button" onClick={() => startWith('planners')} className={hasJournal ? controlPrimary : controlNeutral}>Create a planner</button>}
            {isLast && !hasJournal && <button type="button" onClick={() => startWith('journals')} className={controlPrimary}>Create a journal</button>}
            {isLast && hasPlanner && hasJournal && <button type="button" onClick={close} className={controlPrimary}>Got it</button>}
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default PlaybookModal
