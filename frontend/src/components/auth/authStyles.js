// Class strings shared by the auth screens. Same tokens as the rest of the app:
// warm canvas + zinc neutrals in light mode, #191919 / #202020 in dark mode, zinc-900 (light) / zinc-100 (dark) primary button.

export const SERIF = "font-['Newsreader',Georgia,'Times_New_Roman',serif]"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"

export const inputCls =
  "h-10 w-full rounded-md border border-zinc-300/80 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-zinc-50 dark:border-white/10 dark:bg-[#202020] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:read-only:bg-[#1c1c1c]"

export const labelCls = "mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300"

export const hintCls = "mt-1.5 text-xs text-zinc-500 dark:text-zinc-400"

export const submitCls = `mt-2 flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`

export const linkBtnCls = `cursor-pointer rounded text-[13px] font-medium text-zinc-900 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-zinc-100 dark:disabled:text-zinc-500 ${focusRing}`

export const mutedCls = "text-zinc-500 dark:text-zinc-400"

// small uppercase label, same style as the page labels in the app's top bar
export const eyebrowCls = "mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500"

export const headingCls = `${SERIF} text-[28px] font-medium leading-tight tracking-[-0.01em] text-zinc-900 dark:text-zinc-50`

export const messageCls = (type) =>
  `mb-4 rounded-md border px-3 py-2.5 text-[13px] leading-snug ${
    type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
  }`

export const tabCls = (active) =>
  `-mb-px cursor-pointer border-b-2 pb-2.5 text-sm font-medium transition-colors ${focusRing} ${
    active
      ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`
