import { SceneHeader } from '../LoopScene'
import { RULES, SETUPS } from './demoData'
import { useSandbox } from './sandboxState'
import { SectionLabel, StageRail, card } from './sandboxUi'

/** Scene 1. Pick a setup and see what a strategy contains: entry conditions, risk, rules. All local and illustrative. */
export default function StrategyScene({ scene }) {
  const { state, dispatch } = useSandbox()
  const setup = SETUPS.find((item) => item.id === state.setupId) ?? SETUPS[0]
  const followed = RULES.filter((rule) => state.ruleChecks[rule.id]).length

  return (
    <div>
      <StageRail current="strategy" />
      <SceneHeader scene={scene} />

      <div className="mt-5">
        <SectionLabel>1 · Choose a setup to explore</SectionLabel>
        <div role="group" aria-label="Setups" className="mt-2 grid gap-2 sm:grid-cols-2">
          {SETUPS.map((item) => {
            const on = item.id === setup.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: 'pick-setup', id: item.id })}
                className={`cursor-pointer rounded-xl border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${on ? 'border-cyan-300/60 bg-cyan-400/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
              >
                <span className="block text-sm font-semibold text-zinc-100">{item.name}</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-400">{item.blurb}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div key={setup.id} className="tl-rise mt-4 grid gap-3 sm:grid-cols-2">
        <section className={`${card} p-4`} aria-label="Entry conditions">
          <SectionLabel>Entry conditions</SectionLabel>
          <ol className="mt-2 space-y-1.5 text-[13px] leading-5 text-zinc-300">
            {setup.entry.map((line, i) => (
              <li key={line} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 text-[10px] text-cyan-200">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
        </section>
        <section className={`${card} p-4`} aria-label="Risk parameters">
          <SectionLabel>Risk parameters</SectionLabel>
          <dl className="mt-2 space-y-1.5 text-[13px] leading-5">
            <div className="flex justify-between gap-3"><dt className="text-zinc-400">Risk per trade</dt><dd className="font-semibold text-cyan-200">{setup.risk}%</dd></div>
            <div className="flex justify-between gap-3"><dt className="shrink-0 text-zinc-400">Stop loss</dt><dd className="text-right text-zinc-200">{setup.stop}</dd></div>
          </dl>
        </section>
      </div>

      <section className={`${card} mt-3 p-4`} aria-label="Trading rules">
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>2 · Trading rules: tick the ones you would commit to</SectionLabel>
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{followed}/{RULES.length}</span>
        </div>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {RULES.map((rule) => {
            const on = !!state.ruleChecks[rule.id]
            return (
              <li key={rule.id}>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-[13px] leading-5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-300 ${on ? 'border-cyan-300/45 bg-cyan-400/[0.06] text-zinc-100' : 'border-white/10 text-zinc-300 hover:border-white/20'}`}>
                  <input type="checkbox" checked={on} onChange={() => dispatch({ type: 'toggle-rule', id: rule.id })} className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400" />
                  {rule.text}
                </label>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-400">A strategy gives every trade context. Without it, a trade is only a win or a loss. With it, you can ask whether you followed your own rules. {scene.note}</p>
      </section>
    </div>
  )
}
