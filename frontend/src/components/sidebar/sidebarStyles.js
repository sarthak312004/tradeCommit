// Class strings and motion helpers shared by every piece of the sidebar.

export const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]"

export const FADE_BASE =
  "transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none"

export const fade = (visible) =>
  visible
    ? "visible translate-x-0 opacity-100 delay-100"
    : "invisible -translate-x-2 opacity-0"

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"

export const ghostBtn = `cursor-pointer text-zinc-600 transition-colors hover:bg-black/[0.07] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${focusRing}`

export const fieldCls =
  "w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"

export const labelCls = "mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300"

export const primaryBtn = `cursor-pointer rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`

/* ---- create form styles ----------------------------------------------- */

export const createFormPanel =
  "w-[260px] shrink-0 border-y border-zinc-300 bg-white/60 px-3 py-3 dark:border-white/[0.10] dark:bg-white/[0.015]"

export const createFormTitle =
  "mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400"

export const createFieldLabel =
  "mb-1.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-300"

export const createTextField =
  "h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-500 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"

export const createFormActions =
  "mt-3 flex items-center justify-end gap-2 border-t border-zinc-300 pt-3 dark:border-white/[0.10]"

export const createCancelButton = `h-8 cursor-pointer rounded-md px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[0.05] hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${focusRing}`

export const createSubmitButton = `h-8 cursor-pointer rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`
