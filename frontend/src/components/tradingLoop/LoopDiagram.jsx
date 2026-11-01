import { useId } from 'react'
import { STAGES } from './stages'
import { useReducedMotion } from './useReducedMotion'

// Two geometries of the same picture: the wide one carries a second line of text per node, the narrow one fits a phone.
// Both are rendered and CSS shows the right one, so there is no layout flash and no resize logic.
const GEOMETRY = {
  wide: { w: 720, h: 215, xs: [90, 270, 450, 630], cy: 100, r: 30, nameY: 24, subY: 42, nameSize: 13, subSize: 11, drop: 85, iconScale: 1.2, showSub: true },
  narrow: { w: 340, h: 150, xs: [42, 127, 213, 298], cy: 64, r: 20, nameY: 24, subY: 0, nameSize: 11, subSize: 0, drop: 62, iconScale: 0.85, showSub: false },
}

// 24-unit-box icons, centred on 0,0
const ICONS = {
  strategy: <><circle r="8" /><circle r="3" /></>,
  planner: <><rect x="-8" y="-7" width="16" height="15" rx="2" /><path d="M-8 -2h16M-4 -9v3M4 -9v3" /></>,
  journal: <><path d="M-7 -8h11a3 3 0 0 1 3 3v13h-11a3 3 0 0 1-3-3z" /><path d="M-3 -3h6M-3 1h6" /></>,
  mentor: <path d="M0 -9l2.4 6.6L9 0l-6.6 2.4L0 9l-2.4-6.6L-9 0l6.6-2.4z" />,
}

const nodeState = (mode, focusIndex, index) => {
  if (mode === 'loop') return 'active'
  if (mode === 'stage') return index < focusIndex ? 'done' : index === focusIndex ? 'active' : 'idle'
  return 'ready'
}

const linkState = (mode, focusIndex, index) => {
  if (mode === 'loop') return 'lit'
  if (mode === 'stage') return index < focusIndex ? 'lit' : 'idle'
  return 'ready'
}

function Svg({ variant, mode, focusIndex, animateDot }) {
  const g = GEOMETRY[variant]
  const pathId = useId()
  const { xs, cy, r } = g
  const arcY = cy + r + 4
  const arc = `M${xs[3]} ${arcY} C${xs[3]} ${arcY + g.drop} ${xs[0]} ${arcY + g.drop} ${xs[0]} ${arcY}`
  const orbit = `M${xs[0]} ${cy} H${xs[3]} V${arcY} C${xs[3]} ${arcY + g.drop} ${xs[0]} ${arcY + g.drop} ${xs[0]} ${arcY} V${cy}`
  const returnState = mode === 'loop' ? 'lit' : mode === 'stage' && focusIndex === 3 ? 'ready' : mode === 'intro' ? 'ready' : 'idle'

  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} aria-hidden="true" focusable="false" className="block h-auto w-full">
      <path id={pathId} d={orbit} fill="none" stroke="none" />

      {/* the three forward links, each ending in a small arrowhead */}
      {xs.slice(0, 3).map((x, i) => {
        const from = x + r + 6
        const to = xs[i + 1] - r - 8
        const state = linkState(mode, focusIndex, i)
        return (
          <g key={STAGES[i].id}>
            <path className="tl-link tl-draw" pathLength="1" data-state={state} d={`M${from} ${cy} H${to}`} style={{ '--d': `${0.5 + i * 0.18}s` }} />
            <path className="tl-link" data-state={state} d={`M${to - 5} ${cy - 4} L${to} ${cy} L${to - 5} ${cy + 4}`} />
          </g>
        )
      })}

      {/* the return path: Mentor back to Strategy */}
      <path className="tl-link tl-draw" pathLength="1" data-state={returnState} d={arc} style={{ '--d': '1.05s' }} />
      <path className="tl-link" data-state={returnState} d={`M${xs[0] - 4} ${arcY + 6} L${xs[0]} ${arcY} L${xs[0] + 4} ${arcY + 6}`} />

      {animateDot && (
        <circle className="tl-spark" r={variant === 'wide' ? 3.2 : 2.6}>
          <animateMotion dur="9s" repeatCount="indefinite" rotate="0">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      )}

      {STAGES.map((stage, i) => (
        <g key={stage.id} className="tl-node" data-state={nodeState(mode, focusIndex, i)} style={{ '--d': `${i * 0.12}s` }}>
          <circle className="tl-halo" cx={xs[i]} cy={cy} r={r + 9} />
          <circle className="tl-node-ring" cx={xs[i]} cy={cy} r={r} />
          <g className="tl-node-icon" transform={`translate(${xs[i]} ${cy}) scale(${g.iconScale})`}>{ICONS[stage.id]}</g>
          <text className="tl-label" x={xs[i]} y={g.nameY} textAnchor="middle" fontSize={g.nameSize}>{stage.name}</text>
          {g.showSub && <text className="tl-sub" x={xs[i]} y={g.subY} textAnchor="middle" fontSize={g.subSize}>{stage.short}</text>}
        </g>
      ))}
    </svg>
  )
}

/**
 * The animated workflow: Strategy → Planner → Journal → AI Mentor, with a return path back to Strategy.
 *   mode 'intro'  all four nodes ready
 *   mode 'stage'  `focus` (a stage id) is highlighted, earlier stages are done
 *   mode 'loop'   everything lit, a spark circulating
 * It stays mounted between scenes, so state changes animate instead of re-drawing.
 */
export default function LoopDiagram({ mode = 'intro', focus = null }) {
  const reduced = useReducedMotion()
  const focusIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === focus))
  const animateDot = !reduced

  return (
    <figure className="m-0">
      <div className="hidden sm:block"><Svg variant="wide" mode={mode} focusIndex={focusIndex} animateDot={animateDot} /></div>
      <div className="sm:hidden"><Svg variant="narrow" mode={mode} focusIndex={focusIndex} animateDot={animateDot} /></div>
      <figcaption className="mt-1 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-300/90">
        Continuous improvement · back to Strategy
      </figcaption>
      <ol className="sr-only">
        {STAGES.map((stage) => <li key={stage.id}>{stage.name}: {stage.summary}</li>)}
        <li>The AI Mentor’s findings return to Strategy, forming a continuous improvement loop.</li>
      </ol>
    </figure>
  )
}
