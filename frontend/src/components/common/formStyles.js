
// Class strings for the Notion-style forms (TradeForm, PlanForm, JournalContextDialog).
// TradeCommit UI: neutral focus states, subtle surfaces, polished light/dark themes.

// No focus rings anywhere in this file.
// Focused controls use neutral hover-style tints.
// The rich-text editor canvas stays transparent.

/* ---- icon buttons ------------------------------------------------------- */

export const iconButtonClass = [
  'inline-flex h-9 w-9 shrink-0 items-center justify-center',
  'rounded-xl border border-transparent',
  'text-zinc-500 transition-all duration-200 ease-out',
  'hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950',
  'focus:outline-none focus-visible:border-zinc-200 focus-visible:bg-zinc-100 focus-visible:text-zinc-950',
  'active:scale-95 active:bg-zinc-200/80',
  'disabled:pointer-events-none disabled:opacity-40',
  'dark:text-zinc-400',
  'dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
  'dark:focus-visible:border-zinc-700 dark:focus-visible:bg-zinc-800 dark:focus-visible:text-zinc-50',
  'dark:active:bg-zinc-700',
].join(' ')

/* ---- inline-editable inputs -------------------------------------------- */

export const inputClass = [
  'h-8 w-full rounded-lg bg-transparent px-2',
  'text-sm font-medium text-zinc-900',
  'outline-none transition-colors duration-150',
  'placeholder:font-normal placeholder:text-zinc-500',
  'hover:bg-zinc-100/80 focus:bg-zinc-100/80',
  'dark:text-zinc-50 dark:placeholder:text-zinc-400',
  'dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]',
].join(' ')

export const numberInputClass = [
  inputClass,
  '[appearance:textfield]',
  '[&::-webkit-inner-spin-button]:appearance-none',
  '[&::-webkit-outer-spin-button]:appearance-none',
].join(' ')

export const dateInputClass = [
  inputClass,
  '[color-scheme:light] dark:[color-scheme:dark]',
].join(' ')

/* ---- footer: ghost (Cancel) vs primary (Save) -------------------------- */

const footerBase = [
  'inline-flex h-9 items-center justify-center gap-2',
  'whitespace-nowrap rounded-lg px-4',
  'text-[13px] font-medium',
  'outline-none transition-all duration-200 ease-out',
  'active:scale-[0.98]',
  'focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ')

export const ghostFooterButton = [
  footerBase,
  'border border-transparent',
  'text-zinc-700 hover:border-zinc-200',
  'hover:bg-zinc-100 hover:text-zinc-950',
  'focus-visible:border-zinc-200 focus-visible:bg-zinc-100',
  'dark:text-zinc-300',
  'dark:hover:border-zinc-700',
  'dark:hover:bg-white/[0.08] dark:hover:text-zinc-50',
  'dark:focus-visible:border-zinc-700 dark:focus-visible:bg-white/[0.08]',
].join(' ')

export const primaryFooterButton = [
  footerBase,
  'min-w-[116px]',
  'bg-zinc-900 text-white shadow-sm',
  'hover:bg-zinc-700',
  'active:bg-zinc-800',
  'focus-visible:bg-zinc-800',
  'dark:bg-zinc-100 dark:text-zinc-950',
  'dark:hover:bg-white dark:active:bg-zinc-200',
  'dark:focus-visible:bg-zinc-200',
].join(' ')

export const footerClass = [
  'flex shrink-0 items-center gap-2',
  'border-t border-zinc-200',
  'bg-white/95 px-6 py-3',
  'dark:border-zinc-800',
  'dark:bg-panel',
].join(' ')

/* ---- rich-text toolbar -------------------------------------------------- */

export const toolbarClass = [
  'sticky top-0 z-10 flex flex-nowrap items-center gap-1 overflow-visible whitespace-nowrap [&>*]:shrink-0',
  'rounded-xl border border-zinc-200',
  'bg-zinc-50/95 p-1',
  'shadow-sm shadow-zinc-900/[0.02]',
  'dark:border-zinc-800',
  'dark:bg-white/[0.04]',
].join(' ')

const toolbarItem = [
  'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5',
  'rounded-lg border border-transparent',
  'text-zinc-600 transition-all duration-150 ease-out',
  'outline-none',
  'hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950',
  'focus-visible:border-zinc-200 focus-visible:bg-zinc-100 focus-visible:text-zinc-950',
  'active:scale-95',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
  'dark:text-zinc-300',
  'dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
  'dark:focus-visible:border-zinc-700 dark:focus-visible:bg-zinc-800 dark:focus-visible:text-zinc-50',
].join(' ')

// Icon buttons: selected state uses a subtle neutral tint.
export const toolbarIconButton = (active = false) =>
  [
    toolbarItem,
    'w-8',
    active
      ? [
          'border-zinc-200 bg-zinc-100 text-zinc-950',
          'hover:border-zinc-200 hover:bg-zinc-200/70',
          'dark:border-zinc-700 dark:bg-white/[0.10] dark:text-zinc-50',
          'dark:hover:border-zinc-700 dark:hover:bg-white/[0.14]',
        ].join(' ')
      : '',
  ].join(' ')

// Text-formatting controls: same subtle neutral selected state.
export const toolbarTextButton = (active = false) =>
  [
    toolbarItem,
    'px-2.5 text-xs font-medium',
    active
      ? [
          'border-zinc-200 bg-zinc-100 text-zinc-900',
          'hover:bg-zinc-200/70',
          'dark:border-zinc-700 dark:bg-white/[0.10] dark:text-zinc-50',
          'dark:hover:bg-white/[0.14]',
        ].join(' ')
      : '',
  ].join(' ')

export const toolbarSelect = [
  'h-8 cursor-pointer rounded-lg border border-transparent',
  'bg-transparent px-2 text-xs font-medium text-zinc-700',
  'outline-none transition-colors duration-150',
  'hover:border-zinc-200 hover:bg-zinc-100',
  'focus-visible:border-zinc-200 focus-visible:bg-zinc-100',
  'dark:text-zinc-300 dark:[color-scheme:dark]',
  'dark:hover:border-zinc-700 dark:hover:bg-zinc-800',
  'dark:focus-visible:border-zinc-700 dark:focus-visible:bg-zinc-800',
].join(' ')

export const toolbarDivider =
  'mx-1 h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700'

/* ---- editable area + attached screenshots ------------------------------- */

export const editorClass = [
  // Editor typography and transparent canvas
  'min-h-[420px] bg-transparent py-4',
  'text-[15px] leading-7 text-zinc-900',
  'outline-none focus:outline-none',
  'focus:bg-transparent',
  'selection:bg-zinc-200 selection:text-zinc-950',
  'dark:bg-transparent dark:text-zinc-100',
  'dark:focus:bg-transparent',
  'dark:selection:bg-white/20 dark:selection:text-white',

  // Placeholder
  'empty:before:pointer-events-none',
  'empty:before:text-zinc-500',
  'empty:before:content-[attr(data-placeholder)]',
  'dark:empty:before:text-zinc-400',

  // Headings
  '[&_h2]:mb-1 [&_h2]:mt-6',
  '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-9',
  '[&_h3]:mb-1 [&_h3]:mt-4',
  '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-8',
  '[&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold',

  // Lists
  '[&_ul]:list-disc [&_ul]:pl-6',
  '[&_ol]:list-decimal [&_ol]:pl-6',
  '[&_li]:pl-1',

  // Blockquotes
  '[&_blockquote]:my-3',
  '[&_blockquote]:rounded-r-lg',
  '[&_blockquote]:border-l-[3px]',
  '[&_blockquote]:border-zinc-300',
  '[&_blockquote]:bg-zinc-50',
  '[&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3',
  '[&_blockquote]:text-zinc-700',
  'dark:[&_blockquote]:border-zinc-600',
  'dark:[&_blockquote]:bg-white/[0.03]',
  'dark:[&_blockquote]:text-zinc-300',

  // Attached screenshots
  '[&_img]:my-4 [&_img]:block',
  '[&_img]:h-auto [&_img]:max-w-full',
  '[&_img]:rounded-xl',
  '[&_img]:border [&_img]:border-zinc-200',
  '[&_img]:bg-zinc-50',
  '[&_img]:shadow-[0_1px_2px_rgb(24_24_27/0.06),0_8px_20px_-8px_rgb(24_24_27/0.20)]',
  'dark:[&_img]:border-zinc-700',
  'dark:[&_img]:bg-white/[0.03]',
  'dark:[&_img]:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.55)]',
].join(' ')
