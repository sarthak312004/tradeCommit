import { CheckIcon } from '../../utils/Icons.jsx'
import { focusRing } from '../common/controlStyles'
import { DEMO_BLOCKS, DEMO_FEEDBACK, DEMO_PLAN, DEMO_RULES, DEMO_TRADES } from './tourDemoData'

// Read-only picture of the loop Strategy -> Plan -> Trade -> AI feedback. Static sample data, no requests.

const label = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400'
const text = 'text-[12px] leading-snug text-zinc-800 dark:text-zinc-200'
// the shared accent: the plan and the trade that follows it use the same chip
const chip = 'shrink-0 rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:bg-sky-400/10 dark:text-sky-300'

function BlockBody({ id }) {
  if (id === 'strategy') {
    return (
      <ul className="space-y-1">
        {DEMO_RULES.map((rule) => (
          <li key={rule} className={`flex items-start gap-2 ${text}`}>
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            {rule}
          </li>
        ))}
      </ul>
    )
  }

  if (id === 'plan') {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className={label}>{DEMO_PLAN.name} · {DEMO_PLAN.day}</p>
          <span className={chip}>Trade 2 follows this plan</span>
        </div>
        <p className={`mt-1.5 font-medium ${text}`}>{DEMO_PLAN.text}</p>
      </div>
    )
  }

  if (id === 'trades') {
    return (
      <ul className="space-y-1.5">
        {DEMO_TRADES.map((trade) => (
          <li key={trade.id} className={`flex items-center gap-2 border-l-2 pl-2 ${text} ${trade.plan ? 'border-sky-500 dark:border-sky-400' : 'border-transparent'}`}>
            <span className="font-semibold">Trade {trade.id}</span>
            <span className="text-zinc-600 dark:text-zinc-300">{trade.asset} · {trade.direction}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {trade.plan && <span className={chip}>{DEMO_PLAN.name}</span>}
              <span className={trade.status === 'Open' ? 'rounded border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:border-white/[0.18] dark:text-zinc-400' : 'text-[10px] text-zinc-600 dark:text-zinc-400'}>{trade.status}</span>
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <p className={`font-medium ${text}`}>{DEMO_FEEDBACK}</p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={chip}>{DEMO_PLAN.name}</span>
        <span aria-hidden="true" className="text-xs text-zinc-600 dark:text-zinc-400">↔</span>
        <span className={chip}>Trade 2</span>
      </p>
    </div>
  )
}

/** `active` is the block that is open. `onSelect(index)` opens another one. */
function TourDemo({ active, onSelect }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <p className={label}>The 4-part loop</p>
        <span className="shrink-0 rounded-full border border-dashed border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-white/[0.18] dark:text-zinc-400">Sample data</span>
      </div>

      <ol className="mt-2.5">
        {DEMO_BLOCKS.map((block, index) => {
          const isActive = index === active
          const isDone = index < active
          return (
            <li key={block.id}>
              {index > 0 && (
                <span aria-hidden="true" className={`ml-[22px] block h-2.5 w-0.5 rounded-full transition-colors motion-reduce:transition-none ${index <= active ? 'bg-sky-500 dark:bg-sky-400' : 'bg-zinc-300 dark:bg-white/[0.18]'}`} />
              )}
              <div
                className={`rounded-xl border transition-colors motion-reduce:transition-none ${
                  isActive ? 'border-sky-500/70 bg-sky-50 dark:border-sky-400/60 dark:bg-sky-400/10' : 'border-zinc-200 bg-zinc-50/80 dark:border-white/[0.10] dark:bg-white/[0.03]'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isActive}
                  onClick={() => onSelect(index)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ${focusRing}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      isActive || isDone ? 'bg-sky-600 text-white dark:bg-sky-400 dark:text-zinc-900' : 'bg-zinc-200 text-zinc-700 dark:bg-white/[0.10] dark:text-zinc-300'
                    }`}
                  >
                    {isDone ? <CheckIcon className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{block.name}</span>
                  {block.id === 'plan' && <span className={`ml-auto ${chip}`}>{DEMO_PLAN.name}</span>}
                </button>

                {isActive && (
                  <div className="space-y-2.5 px-3 pb-3 pl-[42px]">
                    <p className="text-[12px] leading-snug text-zinc-600 dark:text-zinc-300">{block.hint}</p>
                    <BlockBody id={block.id} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default TourDemo
