// Shared control tokens. Every pill, tab group, filter and button in the header/action bars uses these,
// so height (h-8), radius (rounded-lg), padding (px-3), type (text-xs / medium) and focus ring never drift.
//
// Contrast (WCAG 2.2, computed against the real theme surfaces):
//   light text on white  zinc-800 14.9:1 | zinc-700 10.4:1 | zinc-600 7.7:1 (AAA)
//   light text on canvas zinc-700  7.7:1 | zinc-600  5.7:1 (AA)      <- never use zinc-500 or lighter on canvas/sidebar
//   dark text on panel   zinc-300 11.3:1 | zinc-400  6.5:1 (AA)      <- never use zinc-500 or darker for text
//   primary action       white on sky-700 5.9:1 | zinc-950 on sky-400 9.6:1

export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-panel'

const controlBase = `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs font-medium leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

/** Default pill: Context, date filter (idle), Today ... */
export const controlNeutral = `${controlBase} border-zinc-300 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:shadow-none dark:hover:bg-panel-hi`

/** A filter that is currently narrowing the data. */
export const controlActive = `${controlBase} border-sky-700/40 bg-sky-700/10 text-sky-900 hover:bg-sky-700/15 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/15`

/** Primary call to action: + Add trade */
export const controlPrimary = `${controlBase} border-transparent bg-sky-700 text-white shadow-sm hover:bg-sky-800 dark:bg-sky-400 dark:text-zinc-950 dark:hover:bg-sky-300`

/** Segmented group (Trades | Analysis, < Today >). Same h-8 / rounded-lg as the pills above. */
export const segmentedGroup =
  'inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-sm dark:border-white/[0.14] dark:bg-panel dark:shadow-none'

export const segmentedItem = (active) =>
  `inline-flex cursor-pointer items-center justify-center gap-1.5 px-3 text-xs font-medium leading-none transition-colors focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-sky-600 dark:focus-visible:ring-sky-400 ${
    active
      ? 'bg-zinc-900 text-white dark:bg-white/[0.14] dark:text-zinc-50'
      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-50'
  }`

/** Small status chip: Closed / Open / Long / Short / P&L / R. h-6, never wraps, never overlaps. */
export const badgeBase =
  'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium leading-none tabular-nums'

export const badgeTone = {
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-300',
  open: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  negative: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
}

export const dotTone = {
  neutral: 'bg-zinc-500 dark:bg-zinc-400',
  open: 'bg-amber-500 dark:bg-amber-300',
  positive: 'bg-emerald-600 dark:bg-emerald-300',
  negative: 'bg-rose-600 dark:bg-rose-300',
}
