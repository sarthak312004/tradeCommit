import { useId } from 'react'
import { SceneHeader } from '../LoopScene'
import { loopGhost } from '../loopStyles'
import { useSandbox } from './sandboxState'
import { DemoBadge, SectionLabel, StageRail, card, field } from './sandboxUi'

const filled = (value) => String(value ?? '').trim().length > 0

/** Scene 2. A sample planner the user can actually edit. Edits live in sandbox state only. */
export default function PlannerScene({ scene }) {
  const { state, dispatch } = useSandbox()
  const { plan } = state
  const uid = useId()
  const id = (name) => `${uid}-${name}`
  const edit = (name) => (event) => dispatch({ type: 'edit-plan', field: name, value: event.target.value })

  const checks = [filled(plan.setupName), filled(plan.entry), filled(plan.stopLoss), plan.risk > 0, filled(plan.notes)]
  const done = checks.filter(Boolean).length
  const ready = done === checks.length

  return (
    <div>
      <StageRail current="planner" />
      <SceneHeader scene={scene} />

      <blockquote className="mt-4 rounded-lg border-l-2 border-cyan-300/70 bg-cyan-400/[0.05] px-4 py-2.5 text-[13px] leading-6 text-cyan-50">
        Before entering a trade, write down what you expect to happen. After the trade, compare what you planned with what actually happened.
      </blockquote>

      <section className={`${card} mt-4 p-4 sm:p-5`} aria-label="Sample planner">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Sample planner · try editing it</SectionLabel>
          <DemoBadge>Sample · not saved</DemoBadge>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={id('setup')} className="mb-1 block text-xs font-medium text-zinc-300">Setup name</label>
            <input id={id('setup')} className={field} value={plan.setupName} onChange={edit('setupName')} maxLength={60} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={id('entry')} className="mb-1 block text-xs font-medium text-zinc-300">Entry conditions</label>
            <textarea id={id('entry')} className={`${field} resize-none leading-5`} rows={4} value={plan.entry} onChange={edit('entry')} maxLength={400} />
          </div>
          <div>
            <label htmlFor={id('stop')} className="mb-1 block text-xs font-medium text-zinc-300">Stop loss</label>
            <input id={id('stop')} className={field} value={plan.stopLoss} onChange={edit('stopLoss')} maxLength={80} />
          </div>
          <div>
            <label htmlFor={id('risk')} className="mb-1 flex justify-between text-xs font-medium text-zinc-300">
              <span>Risk</span>
              <output htmlFor={id('risk')} className="tabular-nums text-cyan-200">{Number(plan.risk).toFixed(1)}% of account</output>
            </label>
            <input id={id('risk')} type="range" min="0.25" max="3" step="0.25" value={plan.risk} onChange={(e) => dispatch({ type: 'edit-plan', field: 'risk', value: Number(e.target.value) })} className="mt-2 h-5 w-full cursor-pointer accent-cyan-400" />
            <p className="mt-1 text-[11px] text-zinc-500">Arrow keys adjust the slider.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={id('notes')} className="mb-1 block text-xs font-medium text-zinc-300">Notes</label>
            <textarea id={id('notes')} className={`${field} resize-none leading-5`} rows={2} value={plan.notes} onChange={edit('notes')} maxLength={300} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[10rem] flex-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>{ready ? 'Plan complete: ready to compare against' : 'Complete every field'}</span>
              <span className="tabular-nums">{done}/{checks.length}</span>
            </div>
            <div role="progressbar" aria-label="Plan completeness" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done} className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(done / checks.length) * 100}%` }} />
            </div>
          </div>
          {state.planTouched && <button type="button" onClick={() => dispatch({ type: 'reset-plan' })} className={`${loopGhost} !h-8`}>Reset sample</button>}
        </div>
      </section>
    </div>
  )
}
