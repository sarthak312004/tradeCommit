import LoopDiagram from '../LoopDiagram'
import { SceneHeader } from '../LoopScene'
import { loopSecondary } from '../loopStyles'
import { MENTOR_FINDINGS, RULES } from './demoData'
import { useSandbox } from './sandboxState'
import { DemoBadge, SectionLabel, card } from './sandboxUi'

/** Scene 5. The loop closes: what the (demo) mentor found goes back into the sample strategy. */
export default function ImprovementScene({ scene, goBack }) {
  const { state } = useSandbox()
  const added = MENTOR_FINDINGS.filter((item) => state.adopted.includes(item.id))
  const baseRules = RULES.filter((rule) => state.ruleChecks[rule.id])

  return (
    <div>
      <SceneHeader scene={scene} />
      <div className="mt-5"><LoopDiagram mode="loop" /></div>

      <section className={`${card} mt-4 p-4`} aria-label="Sample strategy, improved">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Sample strategy · version 2</SectionLabel>
          <DemoBadge />
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-5">
          {baseRules.map((rule) => (
            <li key={rule.id} className="flex gap-2.5 text-zinc-300"><span aria-hidden="true" className="text-zinc-500">•</span>{rule.text}</li>
          ))}
          {added.map((item) => (
            <li key={item.id} className="tl-rise flex items-start gap-2.5 rounded-md border border-cyan-300/35 bg-cyan-400/[0.07] px-2.5 py-1.5 text-cyan-50">
              <span aria-hidden="true" className="text-cyan-300">+</span>
              <span>{item.rule}<span className="ml-2 text-[11px] text-cyan-200/80">new, from mentor feedback</span></span>
            </li>
          ))}
        </ul>
        {added.length === 0 && (
          <p className="mt-2 text-xs text-zinc-400">
            Nothing added yet. In the AI Mentor step you can turn a finding into a rule and watch it land here.{' '}
            <button type="button" onClick={goBack} className={`${loopSecondary} !h-7 !px-2.5 align-middle text-xs`}>Go back</button>
          </p>
        )}
      </section>

      <p className="mt-4 text-[13px] leading-6 text-zinc-300">The goal is continuous improvement, not simply recording profits and losses. Each pass through the loop makes the next plan sharper.</p>
    </div>
  )
}
