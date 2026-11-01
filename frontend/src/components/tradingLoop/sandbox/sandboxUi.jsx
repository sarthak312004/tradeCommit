import { STAGES } from '../stages'
import { DEMO_LABEL } from './demoData'

export const field = 'w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors hover:border-white/20 focus:border-cyan-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40'
export const card = 'rounded-xl border border-white/[0.09] bg-white/[0.025]'

/** Small "you are here" rail for the four stages. */
export function StageRail({ current }) {
  const at = STAGES.findIndex((stage) => stage.id === current)
  return (
    <ol aria-label="Stages" className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-medium">
      {STAGES.map((stage, i) => (
        <li key={stage.id} aria-current={i === at ? 'step' : undefined} className={`flex items-center gap-1.5 ${i === at ? 'text-cyan-200' : i < at ? 'text-zinc-300' : 'text-zinc-500'}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${i === at ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : i < at ? 'bg-cyan-500/60' : 'bg-white/20'}`} />
          {stage.name}
          {i < STAGES.length - 1 && <span aria-hidden="true" className="ml-0.5 text-zinc-600">/</span>}
        </li>
      ))}
    </ol>
  )
}

export function DemoBadge({ children = DEMO_LABEL, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 ${className}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      {children}
    </span>
  )
}

export function SectionLabel({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{children}</p>
}
