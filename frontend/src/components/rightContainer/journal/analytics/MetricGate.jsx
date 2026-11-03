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
 */

const BAR_WIDTHS = ['w-3/4', 'w-full', 'w-2/3']

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  )
}

const labelsFor = (ids) => {
  const labels = ids.map(metricLabel)
  return labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}

/** A locked section: blurred decoration behind an upgrade prompt. `ids` are the metrics it stands for. */
export function LockedBlock({ ids, compact = false, className = '' }) {
  const names = labelsFor(ids)
  const upgrade = (
    <button
      type="button"
      onClick={() => requestUpgrade(ids[0])}
      className="cursor-pointer rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
    >
      Upgrade to unlock
    </button>
  )

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-zinc-300 px-4 py-3 dark:border-white/[0.14] ${className}`}>
        <p className="flex min-w-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <LockIcon />
          <span className="min-w-0">{names} {ids.length === 1 ? 'is' : 'are'} not in your plan</span>
        </p>
        {upgrade}
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.14] ${className}`}>
      <div aria-hidden="true" className="pointer-events-none select-none space-y-3 p-5 opacity-60 blur-sm">
        {BAR_WIDTHS.map((width, index) => (
          <div key={index} className={`h-4 rounded bg-zinc-300 dark:bg-white/[0.14] ${width}`} />
        ))}
        <div className="h-16 rounded-lg bg-zinc-200 dark:bg-white/[0.08]" />
      </div>
      <div className="absolute inset-0 grid place-items-center bg-white/40 p-4 text-center dark:bg-black/20">
        <div className="max-w-xs">
          <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            <LockIcon />
            {names}
          </p>
          <p className="mb-3 mt-1 text-xs text-zinc-600 dark:text-zinc-300">Not included in your current plan.</p>
          {upgrade}
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
  return canViewMetric(id, entitlements) ? children : <LockedBlock ids={[id]} compact={inline} className={className} />
}

export default MetricGate
