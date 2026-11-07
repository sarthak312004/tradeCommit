import { canViewMetric, metricLabel } from '../../../../config/analyticsAccess'
import { requestUpgrade } from '../../../../utils/upgradePrompt'
import { useAnalyticsAccess } from './accessContext'

/**
 * The single place the dashboard asks "may this user see this metric?".
 * Sections wrap themselves in <MetricGate id="...">; the answer is the server's entitlements.metricAccess (see
 * config/analyticsAccess.js), which TradeAnalysis shares through a context.
 *
 *  - while the profile loads: a skeleton, never a flash of locked or unlocked content;
 *  - allowed: the children;
 *  - locked: a blurred placeholder with an upgrade prompt (the real numbers are never rendered);
 *  - plan could not be checked: a small notice with Retry, never a crash or a blank gap.
 *
 * `variant="inline"` draws the locked and loading states as one compact row (used for the filters bar).
 * `variant="chart"` draws a seamless blurred underwater drawdown chart preview below the equity curve.
 */

const DEFAULT_PREVIEW_GROUPS = [
  {
    title: 'Performance',
    rows: [
      ['Profit factor', 'gross profit / gross loss', '2.18', 'text-emerald-600 dark:text-emerald-400'],
      ['Expectancy', 'average per closed trade', '+$164.20', 'text-emerald-600 dark:text-emerald-400'],
      ['Average win', null, '$390.00', 'text-emerald-600 dark:text-emerald-400'],
      ['Average loss', null, '-$185.00', 'text-rose-500 dark:text-rose-400'],
      ['Average R', 'per trade with a stop loss', '+1.42R', 'text-emerald-600 dark:text-emerald-400'],
      ['Best trade', null, '+$840.00', 'text-emerald-600 dark:text-emerald-400'],
      ['Worst trade', null, '-$290.00', 'text-rose-500 dark:text-rose-400']
    ]
  },
  {
    title: 'Risk and consistency',
    rows: [
      ['Max drawdown', 'peak to trough', '-$610.00', 'text-rose-500 dark:text-rose-400'],
      ['Recovery factor', 'net P&L / max drawdown', '3.45', 'text-emerald-600 dark:text-emerald-400'],
      ['Longest win streak', null, '6', 'text-zinc-900 dark:text-zinc-100'],
      ['Longest losing streak', null, '2', 'text-zinc-900 dark:text-zinc-100'],
      ['Current streak', null, '3 won', 'text-emerald-600 dark:text-emerald-400'],
      ['Risk consistency', 'risk varies 14% around average', 'Consistent', 'text-emerald-600 dark:text-emerald-400']
    ]
  },
  {
    title: 'Long vs short',
    rows: [
      ['Long', '18 trades, 67% win', '+$1,890.00', 'text-emerald-600 dark:text-emerald-400'],
      ['Short', '11 trades, 55% win', '+$560.00', 'text-emerald-600 dark:text-emerald-400']
    ]
  }
]

const DEFAULT_PREVIEW_MONTHS = [
  { label: 'Nov 2026', width: 82, trades: '14 trades, 64% win', pnl: '+$1,420.00', positive: true },
  { label: 'Oct 2026', width: 58, trades: '11 trades, 55% win', pnl: '+$980.00', positive: true },
  { label: 'Sep 2026', width: 24, trades: '8 trades, 38% win', pnl: '-$390.00', positive: false },
  { label: 'Aug 2026', width: 68, trades: '12 trades, 58% win', pnl: '+$1,150.00', positive: true }
]

function LockIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className={className}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

const labelsFor = (ids) => {
  const labels = ids.map(metricLabel)
  return labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}

/** Native-themed blurred preview matching Performance, Risk & consistency, Long vs short, and Monthly P&L. */
export function NativeAnalyticsPreview() {
  return (
    <div>
      <div className="grid gap-x-12 gap-y-6 p-5 sm:p-6 md:grid-cols-2">
        {DEFAULT_PREVIEW_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">{group.title}</h3>
            <dl className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
              {group.rows.map(([label, note, value, tone]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-zinc-600 dark:text-zinc-300">
                    {label}
                    {note && <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">{note}</span>}
                  </dt>
                  <dd className={`font-medium tabular-nums ${tone}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-300 p-5 sm:p-6 dark:border-white/[0.12]">
        <h3 className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Monthly P&amp;L</h3>
        <ul className="divide-y divide-zinc-300 dark:divide-white/[0.09]">
          {DEFAULT_PREVIEW_MONTHS.map((month) => (
            <li key={month.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 py-2.5 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">{month.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]">
                <span
                  className={`block h-full rounded-full ${month.positive ? 'bg-emerald-500/70 dark:bg-emerald-400/60' : 'bg-rose-500/70 dark:bg-rose-400/60'}`}
                  style={{ width: `${month.width}%` }}
                />
              </span>
              <span className="flex items-baseline gap-3 text-right">
                <span className="hidden text-xs text-zinc-600 sm:inline dark:text-zinc-400">{month.trades}</span>
                <span className={`min-w-[5.5rem] font-medium tabular-nums ${month.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {month.pnl}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Seamless blurred underwater drawdown chart shown right below the equity curve when locked. */
export function LockedDrawdownPreview({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 px-1 text-[11px] text-zinc-600 dark:text-zinc-400">
        <span>Drawdown from equity peak</span>
          <span aria-hidden="true" className="inline-flex animate-pulse items-center gap-1.5">
            <span className="h-2 w-14 rounded-full bg-zinc-200 dark:bg-white/[0.1]" />
            <span className="h-2 w-10 rounded-full bg-zinc-200 dark:bg-white/[0.1]" />
          </span>
      </div>
      <div className="relative h-24 overflow-hidden rounded-lg bg-zinc-50 dark:bg-white/[0.03]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none px-3 py-2">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <path d="M0,25 H100 M0,50 H100 M0,75 H100" fill="none" className="stroke-zinc-200/70 dark:stroke-white/[0.06]" />
              <path
                d="M0,22 C12,18 18,34 30,30 S48,42 60,46 S82,60 100,55"
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="animate-pulse stroke-zinc-200 dark:stroke-white/[0.1]"
              />
            </svg>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/35 dark:bg-panel/35">
          <button
            type="button"
            onClick={() => requestUpgrade('drawdownChart')}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300/90 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur-md transition hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[0.12] dark:bg-panel/90 dark:text-zinc-200 dark:hover:border-white/25 dark:hover:text-white"
          >
            <LockIcon className="text-zinc-500 dark:text-zinc-400" />
            <span>Drawdown chart · Pro</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A locked section: native blurred analytics preview behind a seamless, theme-matched paywall card.
 */
export function LockedBlock({
  ids = [],
  compact = false,
  title = 'Unlock full performance & risk analytics',
  subtitle = 'Everything below is included in Pro — deep performance ratios, risk & streak consistency, directional splits, and monthly P&L.',
  highlights,
  children,
  className = ''
}) {
  const names = labelsFor(ids)
  const featureId = ids[0] ?? 'analytics'

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 dark:border-white/[0.14] ${className}`}>
        <p className="flex min-w-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <LockIcon />
          <span className="min-w-0">{names} {ids.length === 1 ? 'is' : 'are'} not in your plan</span>
        </p>
        <button
          type="button"
          onClick={() => requestUpgrade(featureId)}
          className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Upgrade to Pro
        </button>
      </div>
    )
  }

  const featureTags =
    Array.isArray(highlights) && highlights.length > 0
      ? highlights
      : [...new Set(ids.map(metricLabel))].slice(0, 8)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none select-none opacity-55 blur-[5px]"
      >
        {children ?? <NativeAnalyticsPreview />}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/40 p-5 backdrop-blur-[2px] sm:p-8 dark:bg-panel/45">
        <div className="tc-surface w-full max-w-lg rounded-xl border border-zinc-300 bg-white/95 p-5 shadow-card backdrop-blur-md sm:p-6 dark:border-white/[0.12] dark:bg-panel/95 dark:shadow-none">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <LockIcon className="text-zinc-500 dark:text-zinc-400" />
            <span>Pro Analytics</span>
          </div>

          <h4 className="mt-2 text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-100">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>

          {featureTags.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {featureTags.map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-zinc-200 bg-zinc-100/80 px-2 py-0.5 text-[11px] text-zinc-700 dark:border-white/[0.09] dark:bg-white/[0.05] dark:text-zinc-300"
                >
                  {item}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3.5 dark:border-white/[0.09]">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Unlocks Overview details, Breakdown, Distribution &amp; Compare
            </span>
            <button
              type="button"
              onClick={() => requestUpgrade(featureId)}
              className="cursor-pointer rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Placeholder shown while the profile (and with it the entitlements) loads. */
export function GateSkeleton({ inline = false, className = '' }) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" className="sr-only">Loading…</span>
      <div aria-hidden="true" className={`animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.05] ${inline ? 'h-9' : 'h-28'}`} />
    </div>
  )
}

/** Shown instead of metrics when the plan could not be read; asking again is the only sensible action. */
export function PlanCheckNotice({ className = '' }) {
  const { retry } = useAnalyticsAccess()
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 dark:border-white/[0.14] ${className}`}>
      <p className="text-xs text-zinc-600 dark:text-zinc-300">We could not check which analytics your plan includes.</p>
      <button
        type="button"
        onClick={retry}
        className="cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300"
      >
        Try again
      </button>
    </div>
  )
}

function MetricGate({ id, variant = 'section', className = '', children }) {
  const { status, entitlements } = useAnalyticsAccess()
  const inline = variant === 'inline'

  if (status === 'loading') return <GateSkeleton inline={inline} className={className} />
  if (status === 'error') return <PlanCheckNotice className={className} />
  if (canViewMetric(id, entitlements)) return children
  if (variant === 'chart') return <LockedDrawdownPreview className={className} />
  return <LockedBlock ids={[id]} compact={inline} className={className} />
}

export default MetricGate
