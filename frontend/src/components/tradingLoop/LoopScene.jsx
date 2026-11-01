import { SERIF } from '../auth/authStyles'

/**
 * Reusable scene pieces. A scene is: eyebrow → title → body, then optional points and note.
 * `direction` (1 forward, -1 back) picks the slide-in side; the caller re-keys the scene per id so it re-plays.
 */
export function Scene({ direction = 1, children }) {
  return <div className={direction >= 0 ? 'tl-scene-fwd' : 'tl-scene-back'}>{children}</div>
}

export function SceneHeader({ scene, hero = false }) {
  const lines = Array.isArray(scene.title) ? scene.title : [scene.title]
  return (
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{scene.eyebrow}</p>
      <h2 className={`${SERIF} mt-3 font-medium tracking-[-0.02em] text-zinc-50 ${hero ? 'text-[1.75rem] leading-[1.15] sm:text-[2.4rem] sm:leading-[1.1]' : 'text-2xl leading-tight sm:text-[1.9rem]'}`}>
        {lines.map((line, i) => (
          <span key={line} className={`block ${hero && i > 0 ? 'text-cyan-200' : ''}`}>
            {line}
            {i < lines.length - 1 && ' '}
          </span>
        ))}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-[15px] sm:leading-7">{scene.body}</p>
    </header>
  )
}

export function ScenePoints({ points = [], note }) {
  if (points.length === 0 && !note) return null
  return (
    <div className="mt-5">
      <ul className="grid gap-2.5 sm:grid-cols-3">
        {points.map((point, i) => (
          <li
            key={point}
            className="tl-rise flex gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3.5 py-3 text-[13px] leading-5 text-zinc-300"
            style={{ '--d': `${0.12 + i * 0.07}s` }}
          >
            <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-zinc-400">{note}</p>}
    </div>
  )
}
