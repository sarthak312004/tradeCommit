import { useState } from 'react'
import { SceneHeader } from '../LoopScene'
import { DEMO_NOTE, MENTOR_FINDINGS } from './demoData'
import { useSandbox } from './sandboxState'
import { DemoBadge, StageRail, card } from './sandboxUi'

/** Scene 4. Illustrative feedback only. Every piece is labelled DEMO DATA, and no AI request is made. */
export default function MentorScene({ scene }) {
  const { state, dispatch } = useSandbox()
  const [open, setOpen] = useState(MENTOR_FINDINGS[0].id)

  return (
    <div>
      <StageRail current="mentor" />
      <SceneHeader scene={scene} />

      <section className={`${card} mt-5 overflow-hidden`} aria-label="Demo mentor feedback">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-amber-300/[0.04] px-4 py-2.5">
          <DemoBadge />
          <p className="text-[11px] leading-4 text-amber-100/90">{DEMO_NOTE}</p>
        </div>

        <ul>
          {MENTOR_FINDINGS.map((item, i) => {
            const isOpen = open === item.id
            const adopted = state.adopted.includes(item.id)
            const good = item.tone === 'good'
            const panelId = `tl-finding-${item.id}`
            return (
              <li key={item.id} className={`tl-rise ${i > 0 ? 'border-t border-white/[0.07]' : ''}`} style={{ '--d': `${0.08 + i * 0.1}s` }}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300"
                  >
                    <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${good ? 'border-emerald-300/50 text-emerald-200' : 'border-amber-300/50 text-amber-200'}`}>{good ? '✓' : '!'}</span>
                    <span className="flex-1 text-sm font-semibold text-zinc-100">{item.title}</span>
                    <span aria-hidden="true" className={`text-zinc-500 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                </h3>
                {isOpen && (
                  <div id={panelId} className="px-4 pb-4 pl-[3.25rem] text-[13px] leading-6 text-zinc-300">
                    <p>{item.summary}</p>
                    <p className="mt-2 rounded-md bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400">{item.evidence}</p>
                    {!good && (
                      <div className="mt-3">
                        <p className="text-zinc-200">{item.suggestion}</p>
                        <button
                          type="button"
                          aria-pressed={adopted}
                          onClick={() => dispatch({ type: 'toggle-adopt', id: item.id })}
                          className={`mt-2 inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${adopted ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-zinc-200 hover:bg-white/[0.06]'}`}
                        >
                          {adopted ? '✓ Added to the sample strategy' : 'Add as a rule to the sample strategy'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-3 text-xs text-zinc-400">{scene.note}</p>
    </div>
  )
}
