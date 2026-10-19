import { useContext } from 'react'
import { journalContext, plannerContext } from '../../context/Context'
import { CalendarIcon, CheckIcon, FileIcon, PlusIcon } from '../../utils/Icons.jsx'

const panel =
  'rounded-xl border border-zinc-300 bg-white p-6 shadow-sm md:p-8 dark:border-white/[0.14] dark:bg-panel dark:shadow-none'

const bigPrimary =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-panel'

const bigSecondary =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:border-white/[0.16] dark:bg-white/[0.04] dark:text-zinc-100 dark:shadow-none dark:hover:bg-white/[0.08]'

/** "1 of 3 done" strip: create a journal, log a trade, plan a session. Shown while the account is still new. */
function ProgressChecklist({ hasJournal, hasTrade, hasPlanner }) {
  const steps = [
    { label: 'Create a journal', done: hasJournal },
    { label: 'Log your first trade', done: hasTrade },
    { label: 'Plan a session', done: hasPlanner, optional: true },
  ]
  const doneCount = steps.filter((step) => step.done).length

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-white/[0.10]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Getting started</p>
        <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{doneCount} of {steps.length} done</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        aria-label="Getting started progress"
        className="mb-4 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.10]"
      >
        <div className="h-full rounded-full bg-sky-600 transition-[width] duration-500 dark:bg-sky-400" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                step.done ? 'border-sky-600 bg-sky-600 text-white dark:border-sky-400 dark:bg-sky-400 dark:text-zinc-900' : 'border-zinc-400 dark:border-white/[0.24]'
              }`}
            >
              {step.done && <CheckIcon className="h-2.5 w-2.5" />}
            </span>
            <span className={step.done ? 'text-zinc-500 line-through dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}>
              {step.label}
              {step.optional && !step.done && <span className="ml-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">optional</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Shown on the journals page while there is no journal to show. The big buttons open the sidebar's own create
 * forms (same form as the "+"), and each button disappears as soon as that thing exists.
 */
export function EmptyWorkspace({ onCreate }) {
  const { journals, isLoading: journalsLoading } = useContext(journalContext)
  const { planners, isLoading: plannersLoading } = useContext(plannerContext)

  // avoid flashing "create your first journal" at someone whose journals are still on their way
  if (journalsLoading || plannersLoading) {
    return <section aria-busy="true" className="h-56 animate-pulse rounded-xl border border-zinc-300 bg-white/60 dark:border-white/[0.10] dark:bg-white/[0.03]" />
  }

  // a journal exists but is still being saved (it gets selected the moment the server answers)
  if (journals.length > 0) {
    return (
      <section className={`${panel} text-center`}>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Setting up your journal…</p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">This only takes a moment.</p>
      </section>
    )
  }

  const hasPlanner = planners.length > 0

  return (
    <section className={panel}>
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
          <FileIcon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">Start your trading journal</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          A journal holds the trades of one account or strategy. Create one, log a trade, and your stats and AI mentor review start working for you.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => onCreate('journals')} data-tour="empty-create-journal" className={bigPrimary}>
            <PlusIcon className="h-4 w-4" />
            Create your first journal
          </button>
          {!hasPlanner && (
            <button type="button" onClick={() => onCreate('planners')} data-tour="empty-create-planner" className={bigSecondary}>
              <CalendarIcon className="h-4 w-4" />
              Create a trade planner
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Takes about 10 seconds: just a name and a currency.</p>
      </div>

      <div className="mx-auto max-w-md">
        <ProgressChecklist hasJournal={false} hasTrade={false} hasPlanner={hasPlanner} />
      </div>
    </section>
  )
}

/**
 * Shown inside a journal that has no trades yet (Trades and Analysis tabs). One obvious next step: log a trade.
 * The planner button appears only while the user has no planner.
 */
export function FirstTradeCard({ journalName, onAddTrade, onOpenContext, onCreate }) {
  const { planners } = useContext(plannerContext)
  const hasPlanner = planners.length > 0

  return (
    <section className={panel}>
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">
          <PlusIcon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-50">Log your first trade</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {journalName} is ready. Add the asset, direction, entry and exit, and a note on why you took it. Even an old trade works: you will see your first stats right away.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => onAddTrade()} data-tour="empty-add-trade" className={bigPrimary}>
            <PlusIcon className="h-4 w-4" />
            Add your first trade
          </button>
          {!hasPlanner && (
            <button type="button" onClick={() => onCreate('planners')} className={bigSecondary}>
              <CalendarIcon className="h-4 w-4" />
              Create a trade planner
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
          Want the AI mentor to judge trades against your rules?{' '}
          <button type="button" onClick={onOpenContext} className="cursor-pointer font-medium text-sky-800 underline-offset-2 hover:underline dark:text-sky-300">
            Write your strategy first
          </button>
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <ProgressChecklist hasJournal hasTrade={false} hasPlanner={hasPlanner} />
      </div>
    </section>
  )
}

/** Slim nudge above the (always visible) calendar while the journal has no trades. */
export function CalendarNudge() {
  return (
    <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
      Click any day to log your first trade. Past trades count too.
    </p>
  )
}
