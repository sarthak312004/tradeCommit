// Button and focus tokens for The Trading Loop (dark surface).
export const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b11]'
export const base = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focus}`
export const loopPrimary = `${base} bg-cyan-400 px-5 font-semibold text-zinc-950 hover:bg-cyan-300`
export const loopSecondary = `${base} border border-white/15 bg-white/[0.04] px-4 font-medium text-zinc-200 hover:bg-white/[0.08]`
export const loopGhost = `${base} rounded-md px-2 font-medium text-zinc-400 hover:text-zinc-100`
