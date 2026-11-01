import { focus, loopGhost, loopPrimary, loopSecondary } from './loopStyles'

/** Segmented progress: one segment per scene. Each is a button, so any scene can be reached from the keyboard. */
export function ProgressIndicator({ scenes, index, onGo }) {
  return (
    <nav aria-label="Trading Loop progress">
      <p className="mb-1 flex items-baseline justify-between text-[11px] text-zinc-400">
        <span className="font-medium uppercase tracking-[0.16em]">{scenes[index].label}</span>
        <span className="tabular-nums">{index + 1} / {scenes.length}</span>
      </p>
      <ol className="flex gap-1.5">
        {scenes.map((scene, i) => (
          <li key={scene.id} className="flex-1">
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Step ${i + 1} of ${scenes.length}: ${scene.label}`}
              aria-current={i === index ? 'step' : undefined}
              className={`group flex h-5 w-full cursor-pointer items-center rounded-sm ${focus}`}
            >
              <span className={`block h-1 w-full rounded-full transition-colors duration-300 motion-reduce:transition-none ${i === index ? 'bg-cyan-300' : i < index ? 'bg-cyan-500/55' : 'bg-white/15 group-hover:bg-white/25'}`} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Back · Next, plus a quiet Skip. `nextRef` lets the dialog keep keyboard focus on Next between scenes. */
export function NavControls({ isFirst, isLast, nextLabel, onBack, onNext, onSkip, nextRef }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      {isLast ? <span /> : <button type="button" onClick={onSkip} className={loopGhost}>Skip intro</button>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} disabled={isFirst} className={loopSecondary}>Back</button>
        <button type="button" ref={nextRef} onClick={onNext} className={loopPrimary}>
          {nextLabel}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}
