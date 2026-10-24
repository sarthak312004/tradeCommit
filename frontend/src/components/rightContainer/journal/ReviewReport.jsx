import { useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../../utils/Icons.jsx'
import { formatDateKey, formatMoney } from '../../../utils/tradeAnalytics'
import { SERIF } from '../../auth/authStyles'
import { stepEnter } from '../../feedback/formParts'
import { focusRing } from '../../common/controlStyles'
import { distinctNextActions } from '../../../utils/reviewActions'
import { Clamp, Collapsible, PERIOD_WORDS, PLAN_STATUS, Pill, RULE_STATUS, TradeChips, WeekStats, listBox } from './reviewParts'

const COMMITMENT = {
  kept: { label: 'Kept', tone: 'positive' },
  partly_kept: { label: 'Partly kept', tone: 'warning' },
  not_kept: { label: 'Not kept', tone: 'negative' },
  cannot_tell: { label: "Can't tell from the logs", tone: 'neutral' }
}

const CONFIDENCE = {
  early: { label: 'Early read', tone: 'warning' },
  building: { label: 'Building', tone: 'neutral' },
  solid: { label: 'Solid sample', tone: 'positive' }
}

const LOOP = [
  { id: 'plan', label: 'Plan' },
  { id: 'execute', label: 'Execute' },
  { id: 'record', label: 'Record' },
  { id: 'review', label: 'Review' }
]

/**
 * One AI mentor review, written to be read top to bottom with no tabs:
 *   1. the headline, a short summary and the period's numbers (no score and no verdict on the strategy)
 *   2. what to do next, as a checklist (the part people act on)
 *   3. what went well / what to fix, side by side
 *   4. the rules, problems first (rules that were followed stay folded away)
 *   5. where you lost money and time: leaks measured by the app from the logs, with how to stop each one
 *   6. a fold for plan vs execution, then the mentor's note
 * With a `flywheel` block (new reviews) the anti-edge section "Close the loop" comes right after the header. Reviews
 * saved before it existed have no such block and render exactly as before. Reviews saved before leak reports existed
 * have no `leakReport` and simply skip that section.
 */

const eyebrow = 'text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400'

/**
 * The anti-edge part of the review, written to close the loop between the planner, the journal and the strategy:
 *   where the loop is weakest, whether last review's commitment was kept, what is costing edge (ranked by cost),
 *   how far the numbers can be trusted, and the ONE change to carry into the next plan.
 * Reviews saved before this existed have no `flywheel` and simply skip it.
 */
function LoopStrip({ stage, detail }) {
  return (
    <div>
      <ol className="flex items-center gap-1.5" aria-label="Your trading loop">
        {LOOP.map((step, index) => {
          const weak = step.id === stage
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg border px-2 text-xs font-medium ${weak ? 'border-amber-400/70 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200' : 'border-zinc-200 text-zinc-600 dark:border-white/[0.1] dark:text-zinc-400'}`}
                aria-current={weak ? 'step' : undefined}
              >
                {step.label}
              </span>
              {index < LOOP.length - 1 && <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">›</span>}
            </li>
          )
        })}
      </ol>
      {detail && (
        <p className="mt-2.5 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Weakest link: {LOOP.find((step) => step.id === stage)?.label ?? 'Review'}.</span> {detail}
        </p>
      )}
    </div>
  )
}

function Flywheel({ flywheel }) {
  const { lastCommitment, leaks, edgeSignal, weakestLink, carryForward } = flywheel
  const commitment = COMMITMENT[lastCommitment?.status]
  const confidence = CONFIDENCE[edgeSignal?.confidence] ?? CONFIDENCE.early

  return (
    <section aria-label="Close the loop" className="space-y-7">
      <h3 className={eyebrow}>Close the loop</h3>

      <LoopStrip stage={weakestLink?.stage} detail={weakestLink?.detail} />

      {commitment && (
        <div className="rounded-xl border border-zinc-200 px-5 py-4 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What your last review asked for</h4>
            <Pill tone={commitment.tone}>{commitment.label}</Pill>
          </div>
          {lastCommitment.evidence && <Clamp className="mt-2 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{lastCommitment.evidence}</Clamp>}
        </div>
      )}

      <div>
        <h4 className={`${eyebrow} mb-4 flex items-center gap-2`}>
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-rose-500 dark:bg-rose-400" />
          Where your edge leaks
        </h4>
        {leaks.length > 0 ? (
          <ul className="space-y-5">
            {leaks.map((leak) => (
              <li key={leak.title} className="border-l-2 border-rose-500/50 pl-4 dark:border-rose-400/40">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">{leak.title}</p>
                  {leak.cost && <span className="text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400">{leak.cost}</span>}
                </div>
                {leak.detail && <Clamp className="mt-1 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{leak.detail}</Clamp>}
                <TradeChips trades={leak.trades} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">No repeatable leak stands out in these logs. That is a read of this sample, not a clean bill of health.</p>
        )}
      </div>

      {edgeSignal?.detail && (
        <div className="rounded-lg bg-zinc-100 px-4 py-3.5 dark:bg-white/[0.05]">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={eyebrow}>What the numbers can and can’t tell you</h4>
            <Pill tone={confidence.tone}>{confidence.label}</Pill>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{edgeSignal.detail}</p>
        </div>
      )}

      {carryForward?.rule && (
        <div className="rounded-xl border border-[#d6a88f]/70 bg-[#fbf6f1] px-5 py-4 dark:border-[#e08a68]/30 dark:bg-[#e08a68]/[0.07]">
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#a24d2e] dark:text-[#e08a68]">Carry this into your next plan</h4>
          <p className="mt-2 text-[15px] font-medium leading-7 text-zinc-900 dark:text-zinc-50">{carryForward.rule}</p>
          <dl className="mt-3 space-y-2.5 text-[13px] leading-6">
            {carryForward.planLine && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Write in your plan before you trade</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{carryForward.planLine}</dd>
              </div>
            )}
            {carryForward.checkpoint && (
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Your next review will check</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{carryForward.checkpoint}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}

/** The actions, as a checklist. Ticking is only a reading aid and is not saved. */
function NextSteps({ actions, title }) {
  const [done, setDone] = useState(() => new Set())
  const toggle = (index) =>
    setDone((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className={eyebrow}>{title}</h3>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{done.size} of {actions.length} done</span>
      </div>
      <ul className={listBox}>
        {actions.map((action, index) => {
          const checked = done.has(index)
          return (
            <li key={action}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(index)}
                className={`flex w-full cursor-pointer items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}
              >
                <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${checked ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950' : 'border-zinc-400 dark:border-zinc-500'}`}>
                  {checked && <CheckIcon className="h-3.5 w-3.5" />}
                </span>
                <span className={`text-sm leading-6 ${checked ? 'text-zinc-500 line-through dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>{action}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NoticedColumn({ title, items, accent, dot }) {
  if (!items.length) return null
  return (
    <div className="min-w-0">
      <h3 className={`${eyebrow} mb-4 flex items-center gap-2`}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </h3>
      <ul className="space-y-5">
        {items.map((item) => (
          <li key={item.title} className={`border-l-2 pl-4 ${accent}`}>
            <p className="text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">{item.title}</p>
            {item.detail && <Clamp className="mt-1 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{item.detail}</Clamp>}
            <TradeChips trades={item.trades} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RuleRow({ check, open }) {
  const status = RULE_STATUS[check.status] ?? RULE_STATUS.unclear
  return (
    <Collapsible
      defaultOpen={open}
      hasBody={Boolean(check.evidence) || Boolean(check.trades?.length)}
      header={
        <span className="flex items-start gap-3">
          <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
          <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {check.rule} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">{status.label}</span>
          </span>
        </span>
      }
    >
      <div className="pl-5">
        {check.evidence && <p className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{check.evidence}</p>}
        <TradeChips trades={check.trades} />
      </div>
    </Collapsible>
  )
}

/** Rules that need attention come first and open; the ones that were followed stay folded until asked for. */
function Rules({ review }) {
  const [showFollowed, setShowFollowed] = useState(false)
  const checks = review.ruleChecks
  if (!checks.length) return null

  const kind = (check) => (RULE_STATUS[check.status] ? check.status : 'unclear')
  const counts = { followed: 0, broken: 0, unclear: 0 }
  for (const check of checks) counts[kind(check)] += 1
  const attention = checks.filter((check) => kind(check) !== 'followed').sort((a, b) => (kind(a) === 'broken' ? 0 : 1) - (kind(b) === 'broken' ? 0 : 1))
  const followed = checks.filter((check) => kind(check) === 'followed')

  const summary = [
    counts.followed && `${counts.followed} followed`,
    counts.broken && `${counts.broken} broken`,
    counts.unclear && `${counts.unclear} can't tell`
  ].filter(Boolean).join(' · ')

  return (
    <section aria-label="Your rules">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className={eyebrow}>Your rules</h3>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">{summary}</span>
      </div>
      {review.discipline?.explanation && <Clamp className="mb-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.discipline.explanation}</Clamp>}

      {attention.length > 0 && (
        <ul className={listBox}>
          {attention.map((check, index) => (
            <li key={`${check.rule}-${index}`}>
              <RuleRow check={check} open={kind(check) === 'broken'} />
            </li>
          ))}
        </ul>
      )}

      {followed.length > 0 && (
        <div className={attention.length ? 'mt-3' : ''}>
          <button
            type="button"
            aria-expanded={showFollowed}
            onClick={() => setShowFollowed((value) => !value)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded text-xs font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300 ${focusRing}`}
          >
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showFollowed ? 'rotate-180' : ''}`} />
            {showFollowed ? 'Hide' : 'Show'} {followed.length} followed {followed.length === 1 ? 'rule' : 'rules'}
          </button>
          {showFollowed && (
            <ul className={`${listBox} mt-3 ${stepEnter}`}>
              {followed.map((check, index) => (
                <li key={`${check.rule}-${index}`}>
                  <RuleRow check={check} open={false} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/** A closed-by-default section for detail most readers only want sometimes. */
function Fold({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.08]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}
      >
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</span>
        {badge}
        <ChevronDownIcon className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className={`space-y-5 border-t border-zinc-200 px-5 py-5 dark:border-white/[0.08] ${stepEnter}`}>{children}</div>}
    </section>
  )
}

const KIND = {
  money: { label: 'Money', tone: 'negative' },
  time: { label: 'Time', tone: 'warning' },
  both: { label: 'Money and time', tone: 'negative' }
}

function LeakRow({ leak, currency }) {
  const kind = KIND[leak.kind] ?? KIND.money
  return (
    <li className="border-l-2 border-rose-500/50 pl-4 dark:border-rose-400/40">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">{leak.title}</p>
        <span className="flex shrink-0 items-center gap-2">
          <Pill tone={kind.tone}>{kind.label}</Pill>
          {Number.isFinite(leak.amount) && <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatMoney(leak.amount, { currency, signed: true })}</span>}
        </span>
      </div>
      {leak.detail && <Clamp className="mt-1 text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{leak.detail}</Clamp>}
      {leak.fix && (
        <p className="mt-2 text-[13px] leading-6 text-zinc-800 dark:text-zinc-200">
          <span className="font-medium">How to stop it: </span>
          {leak.fix}
        </p>
      )}
      <TradeChips trades={leak.trades} />
    </li>
  )
}

/**
 * Where money and time went, measured by the app from the trade logs (not written by the AI, so the same trades always
 * show the same list). Replaces the old strategy verdict: it points at behaviour to fix, not at the strategy.
 */
function LeaksSection({ report, currency }) {
  const items = report.items ?? []
  const count = items.length
  return (
    <Fold title="Where you lost money and time" badge={count > 0 ? <Pill tone="negative">{count} found</Pill> : null} defaultOpen>
      {report.tooFewTrades ? (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Fewer than 3 closed trades here, which is too few to measure a pattern. Close and log more trades and this list will fill in.</p>
      ) : count > 0 ? (
        <>
          <p className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
            Each amount is what those exact trades netted in your logs. It shows where the money went, not proof of cause, and amounts can overlap, so do not add them up.
            {report.confidence === 'early' ? ' With under 30 closed trades, read these as early signals.' : ''}
          </p>
          <ul className="space-y-6">
            {items.map((leak) => (
              <LeakRow key={leak.id || leak.title} leak={leak} currency={currency} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">No money or time leak showed up in these trades. That is a read of this sample, not a clean bill of health.</p>
      )}
      {report.orderChecksSkipped && (
        <p className="rounded-lg bg-zinc-100 px-4 py-3 text-[13px] leading-6 text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-400">
          Checks that depend on the order of trades (re-entries, trades after a loss, busy days) were skipped because many trades share one date. Real trade dates would let the review check them.
        </p>
      )}
    </Fold>
  )
}

function PlanFold({ review }) {
  const plan = review.planAlignment
  const days = plan.days ?? []
  const asPlanned = days.filter((day) => day.status === 'executed_as_planned').length
  return (
    <Fold title="Plan vs execution" badge={days.length ? <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{asPlanned} of {days.length} {days.length === 1 ? 'day' : 'days'} as planned</span> : null}>
      {plan.summary && <Clamp className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{plan.summary}</Clamp>}
      {days.length > 0 && (
        <ul className={listBox}>
          {days.map((day, index) => {
            const status = PLAN_STATUS[day.status] ?? PLAN_STATUS.plan_not_taken
            return (
              <li key={`${day.date}-${index}`}>
                <Collapsible
                  hasBody={Boolean(day.detail) || Boolean(day.trades?.length)}
                  header={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{formatDateKey(day.date)}</span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </span>
                  }
                >
                  {day.detail && <p className="text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">{day.detail}</p>}
                  <TradeChips trades={day.trades} />
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
    </Fold>
  )
}

/** `stats` ({ trades, closed, netPnl, winRate, expectancyR, rewardRisk }) is the period's numbers; when given they sit under the summary. */
export function Review({ review, period = 'week', stats = null, currency }) {
  const words = PERIOD_WORDS[period] ?? PERIOD_WORDS.week
  const hasPlan = Boolean(review.planAlignment && (review.planAlignment.summary || review.planAlignment.days?.length))
  const hasNoticed = review.strengths.length > 0 || review.issues.length > 0
  const flywheel = review.flywheel ?? null
  const nextActions = distinctNextActions(review)

  return (
    <article className="space-y-9">
      <header className="space-y-5">
        <h2 className={`${SERIF} text-[26px] font-medium leading-[1.15] tracking-[-0.025em] text-zinc-900 dark:text-zinc-50`}>{review.headline}</h2>
        <Clamp className="text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">{review.summary}</Clamp>
        {stats && <WeekStats week={stats} currency={currency} />}
      </header>

      {flywheel && <Flywheel flywheel={flywheel} />}

      {nextActions.length > 0 && <NextSteps actions={nextActions} title={words.next} />}

      {hasNoticed && (
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
          <NoticedColumn title={flywheel ? 'What the logs support' : 'Went well'} items={review.strengths} accent="border-emerald-500/50 dark:border-emerald-400/40" dot="bg-emerald-500 dark:bg-emerald-400" />
          <NoticedColumn title={flywheel ? 'Also worth fixing' : 'Work on'} items={review.issues} accent="border-rose-500/50 dark:border-rose-400/40" dot="bg-rose-500 dark:bg-rose-400" />
        </div>
      )}

      <Rules review={review} />

      <div className="space-y-3">
        {review.leakReport && <LeaksSection report={review.leakReport} currency={currency} />}
        {hasPlan && <PlanFold review={review} />}
      </div>

      {review.mentorNote && (
        <p className={`${SERIF} border-l-2 border-zinc-300 py-0.5 pl-5 text-[17px] italic leading-8 text-zinc-700 dark:border-white/20 dark:text-zinc-300`}>{review.mentorNote}</p>
      )}
    </article>
  )
}

export default Review
