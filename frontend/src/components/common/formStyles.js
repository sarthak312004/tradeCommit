// Class strings for the Notion-style forms (TradeForm, PlanForm, JournalContextDialog).
// Contrast: labels zinc-600/zinc-400 (AA+), values zinc-900/zinc-50 (AAA), placeholders zinc-500/zinc-400 (AA),
// focus indicators are solid sky (>= 3:1 on white and on the dark panel).

import { focusRing } from './controlStyles'

export const iconButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 dark:focus-visible:ring-sky-400'

// inline-editable value: reads like text, reveals a field on hover, and shows a solid ring on focus
export const inputClass =
  'h-8 w-full rounded-md bg-transparent px-2 text-sm font-medium text-zinc-900 outline-none transition-colors placeholder:font-normal placeholder:text-zinc-500 hover:bg-zinc-100 focus:bg-white focus:ring-2 focus:ring-sky-600 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06] dark:focus:ring-sky-400'

export const numberInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`

export const dateInputClass = `${inputClass} [color-scheme:light] dark:[color-scheme:dark]`

/* ---- footer: ghost (Cancel) vs primary (Save) -------------------------- */
const footerBase = `inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-[13px] font-medium transition-colors disabled:cursor-default ${focusRing}`

export const ghostFooterButton = `${footerBase} text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50`

export const primaryFooterButton = `${footerBase} min-w-[116px] bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white`

export const footerClass =
  'flex shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-panel'

/* ---- rich-text toolbar -------------------------------------------------- */
export const toolbarClass =
  'sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-white/[0.04]'

const toolbarItem = `inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md text-zinc-700 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50 ${focusRing}`

export const toolbarIconButton = (active = false) =>
  `${toolbarItem} w-8 ${active ? 'bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:hover:text-zinc-900' : ''}`

export const toolbarTextButton = (active = false) =>
  `${toolbarItem} px-2.5 text-xs font-medium ${active ? 'bg-rose-600/10 text-rose-800 hover:bg-rose-600/15 dark:bg-rose-400/15 dark:text-rose-200' : ''}`

export const toolbarSelect =
  'h-8 cursor-pointer rounded-md border-0 bg-transparent px-2 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-zinc-300 dark:[color-scheme:dark] dark:hover:bg-white/10 dark:focus-visible:ring-sky-400'

export const toolbarDivider = 'mx-1 h-5 w-px shrink-0 bg-zinc-300 dark:bg-zinc-700'

/* ---- editable area + attached screenshots ------------------------------- */
export const editorClass = [
  'min-h-[420px] py-4 text-[15px] leading-7 text-zinc-900 outline-none dark:text-zinc-100',
  'empty:before:pointer-events-none empty:before:text-zinc-500 empty:before:content-[attr(data-placeholder)] dark:empty:before:text-zinc-400',
  '[&_h2]:mb-1 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-9',
  '[&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-8',
  '[&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-[3px] [&_blockquote]:border-zinc-400 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-700 dark:[&_blockquote]:border-zinc-500 dark:[&_blockquote]:text-zinc-300',
  // screenshots: never wider than the column, rounded + hairline border + soft elevation, keep their aspect ratio
  '[&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-zinc-200 [&_img]:bg-zinc-50 [&_img]:shadow-[0_1px_2px_rgb(24_24_27/0.08),0_8px_20px_-8px_rgb(24_24_27/0.25)]',
  'dark:[&_img]:border-zinc-700 dark:[&_img]:bg-white/[0.03] dark:[&_img]:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.6)]'
].join(' ')
