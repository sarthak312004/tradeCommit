import { useEffect, useState } from 'react'
import { SceneHeader } from '../LoopScene'
import { loopSecondary } from '../loopStyles'
import { useReducedMotion } from '../useReducedMotion'
import { COMPARISON } from './demoData'
import { useSandbox } from './sandboxState'
import { DemoBadge, StageRail } from './sandboxUi'

const STEP_MS = 950

const Mark = ({ match }) => (
  <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${match ? 'border-emerald-300/60 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/60 bg-amber-300/10 text-amber-200'}`}>
    {match ? '✓' : '≠'}
  </span>
)

/** Scene 3. Two connected panels; the comparison plays row by row, and can be replayed. */
export default function CompareScene({ scene }) {
  const reduced = useReducedMotion()
  const { state } = useSandbox()
  const total = COMPARISON.length
  const [shown, setShown] = useState(() => (reduced ? total : 0))
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (reduced) return undefined
    const timer = setInterval(() => {
      setShown((count) => {
        if (count >= total) {
          clearInterval(timer)
          return count
        }
        return count + 1
      })
    }, STEP_MS)
    return () => clearInterval(timer)
  }, [run, reduced, total])

  const replay = () => {
    setShown(reduced ? total : 0)
    setRun((n) => n + 1)
  }
  const mismatches = COMPARISON.filter((row, i) => i < shown && !row.match).length

  return (
    <div>
      <StageRail current="journal" />
      <SceneHeader scene={scene} />

      <div className="mt-5 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-[1fr_2.25rem_1fr]" role="table" aria-label="Planned versus actual execution (demo)">
        <div role="row" className="contents">
          <div role="columnheader" className="rounded-t-lg border border-cyan-300/30 bg-cyan-400/[0.06] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Planned</div>
          <div aria-hidden="true" className="hidden sm:block" />
          <div role="columnheader" className="rounded-t-lg border border-white/15 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">Actual execution</div>
        </div>

        {COMPARISON.map((row, i) => {
          const on = i < shown
          return (
            <div key={row.id} role="row" className="contents">
              <div role="cell" className={`rounded-lg border px-3.5 py-3 text-sm text-zinc-100 transition-[opacity,border-color] duration-500 motion-reduce:transition-none ${on ? 'border-cyan-300/30 bg-cyan-400/[0.04] opacity-100' : 'border-white/10 opacity-30'}`}>
                {row.planned}
              </div>
              <div role="cell" className="flex items-center justify-center py-0.5 sm:py-0">
                <div className={`flex items-center gap-2 transition-opacity duration-500 motion-reduce:transition-none sm:flex-col sm:gap-0 ${on ? 'opacity-100' : 'opacity-0'}`}>
                  <span aria-hidden="true" className="h-px w-5 bg-white/25 sm:h-2 sm:w-px" />
                  <Mark match={row.match} />
                  <span aria-hidden="true" className="h-px w-5 bg-white/25 sm:h-2 sm:w-px" />
                  <span className="sr-only">{row.match ? 'matches' : 'differs'}</span>
                </div>
              </div>
              <div role="cell" className={`rounded-lg border px-3.5 py-3 text-sm transition-[opacity,border-color,color] duration-500 motion-reduce:transition-none ${on ? (row.match ? 'border-emerald-300/30 bg-emerald-400/[0.04] text-zinc-100 opacity-100' : 'border-amber-300/40 bg-amber-300/[0.05] text-amber-50 opacity-100') : 'border-white/10 text-zinc-400 opacity-30'}`}>
                {row.actual}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-zinc-400">
          {shown < total ? 'Comparing…' : `${mismatches} of ${total} items differ from the plan.`}
          {state.planTouched && ' Your sample planner edits are not used here; this trade is a fixed example.'}
        </p>
        <div className="flex items-center gap-2">
          <DemoBadge />
          <button type="button" onClick={replay} className={`${loopSecondary} !h-8 !px-3 text-xs`}>Replay</button>
        </div>
      </div>

      <p className="tl-rise mt-4 rounded-lg border border-white/[0.09] bg-white/[0.025] px-4 py-3 text-[13px] leading-6 text-zinc-300" style={{ '--d': '0.2s' }}>
        The planner records what you intended. The journal records what you actually did. Connecting them gives your AI mentor the context to evaluate execution against your plan.
      </p>
    </div>
  )
}
