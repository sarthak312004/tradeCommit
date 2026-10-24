import { focusRing } from '../../../common/controlStyles'

// Trade-type tags. Intraday is the app's sky accent, delivery a calm neutral, unclassified a dashed outline,
// so the three read apart at a glance without adding new colours to the theme.
export const KIND_META = {
  intraday: {
    label: 'Intraday',
    chip: 'bg-sky-500/[0.12] text-sky-800 hover:bg-sky-500/[0.18] dark:bg-sky-400/15 dark:text-sky-200 dark:hover:bg-sky-400/25',
    dot: 'bg-sky-600 dark:bg-sky-300'
  },
  delivery: {
    label: 'Delivery',
    chip: 'bg-zinc-900/[0.07] text-zinc-800 hover:bg-zinc-900/[0.11] dark:bg-white/[0.10] dark:text-zinc-200 dark:hover:bg-white/[0.16]',
    dot: 'bg-zinc-700 dark:bg-zinc-300'
  },
  unknown: {
    label: 'Unclassified',
    chip: 'border border-dashed border-zinc-400 text-zinc-600 hover:bg-zinc-100 dark:border-white/25 dark:text-zinc-400 dark:hover:bg-white/[0.06]',
    dot: 'bg-transparent ring-1 ring-inset ring-zinc-400 dark:ring-zinc-500'
  }
}

export const KIND_ORDER = ['intraday', 'delivery', 'unknown']

// Shared by each trade row and the review header so their columns remain aligned.
export const rowGrid = '1.25rem minmax(0,1.5fr) minmax(0,1.3fr) 5.5rem 7rem'

export const sideChip = {
  long: 'bg-emerald-500/[0.14] text-emerald-800 dark:text-emerald-300',
  short: 'bg-rose-500/[0.14] text-rose-800 dark:text-rose-300'
}

export const toneText = {
  positive: 'text-emerald-700 dark:text-emerald-400',
  negative: 'text-rose-700 dark:text-rose-400',
  neutral: 'text-zinc-600 dark:text-zinc-400'
}

const selectBase = `cursor-pointer rounded-lg border border-zinc-300 bg-white text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:shadow-none dark:[color-scheme:dark] dark:hover:bg-panel-hi ${focusRing}`

/** Native select (never clipped by the scrolling list, works with a keyboard and on phones). */
export const selectClass = `h-8 max-w-full px-2.5 text-xs font-medium ${selectBase}`

export const checkboxClass = 'h-4 w-4 shrink-0 cursor-pointer accent-zinc-800 dark:accent-zinc-200'

export const primaryButton =
  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'

export const textLink =
  'cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300'
