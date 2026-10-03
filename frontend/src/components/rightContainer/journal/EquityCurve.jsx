import { useEffect, useId, useRef, useState } from 'react'
import { formatDateKey, formatMoney, toneOf } from '../../../utils/tradeAnalytics'

const HEIGHT = 260
const MARGIN = { top: 14, right: 12, bottom: 26, left: 56 }

/* ---------- geometry helpers ---------- */

// monotone cubic interpolation (Fritsch-Carlson): smooth, never overshoots the data
const monotonePath = (points) => {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M${points[0].x},${points[0].y}`

  const dx = []
  const slope = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x
    slope[i] = (points[i + 1].y - points[i].y) / dx[i]
  }

  const tangent = [slope[0]]
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  tangent[n - 1] = slope[n - 2]

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const magnitude = a * a + b * b
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude)
      tangent[i] = scale * a * slope[i]
      tangent[i + 1] = scale * b * slope[i]
    }
  }

  let path = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const step = dx[i] / 3
    path += ` C${points[i].x + step},${points[i].y + tangent[i] * step} ${points[i + 1].x - step},${points[i + 1].y - tangent[i + 1] * step} ${points[i + 1].x},${points[i + 1].y}`
  }
  return path
}

// 3-5 "nice" ticks that always include the zero line
const buildTicks = (min, max) => {
  const span = max - min || Math.abs(max) || 1
  const rawStep = span / 4
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalised = rawStep / magnitude
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks = []
  for (let value = start; value <= end + step / 2; value += step) ticks.push(Math.abs(value) < step / 1000 ? 0 : value)
  return ticks
}

function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    // ResizeObserver reports the initial size as soon as it starts observing
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}

/* ---------- component ---------- */

function EquityCurve({ points }) {
  const gradientId = useId()
  const [containerRef, width] = useElementWidth()
  const [activeIndex, setActiveIndex] = useState(null)

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0)
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const values = points.map((point) => point.value)
  const dataMin = Math.min(0, ...values)
  const dataMax = Math.max(0, ...values)
  const pad = (dataMax - dataMin || 1) * 0.08
  const ticks = buildTicks(dataMin - (dataMin < 0 ? pad : 0), dataMax + (dataMax > 0 ? pad : 0))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const x = (index) => MARGIN.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth)
  const y = (value) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin || 1)) * innerHeight

  const coords = points.map((point, index) => ({ x: x(index), y: y(point.value) }))
  const linePath = monotonePath(coords)
  const areaPath = coords.length > 1 ? `${linePath} L${coords[coords.length - 1].x},${MARGIN.top + innerHeight} L${coords[0].x},${MARGIN.top + innerHeight} Z` : ''

  // x labels: first trade, middle, last trade (dates only; spaced so they never collide)
  const labelIndexes = points.length > 5 ? [1, Math.round((points.length - 1) / 2), points.length - 1] : points.length > 2 ? [1, points.length - 1] : [points.length - 1]
  const xLabels = [...new Set(labelIndexes)].map((index) => ({ index, text: formatDateKey(points[index].label) }))

  const handlePointerMove = (event) => {
    if (!innerWidth || points.length < 2) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left - MARGIN.left) / innerWidth
    setActiveIndex(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))))
  }

  const active = activeIndex === null ? null : points[activeIndex]
  const activeX = activeIndex === null ? 0 : x(activeIndex)
  const flip = activeX > MARGIN.left + innerWidth * 0.62
  const finalValue = points[points.length - 1].value
  const summary = `Equity curve across ${points.length - 1} closed trades, ending at ${formatMoney(finalValue)}`

  return (
    <div ref={containerRef} className="relative w-full text-sky-500 dark:text-sky-400" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={summary}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
          className="block touch-pan-y overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid + y axis */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + innerWidth}
                y1={y(tick)}
                y2={y(tick)}
                strokeDasharray={tick === 0 ? '3 4' : undefined}
                className={tick === 0 ? 'stroke-zinc-300 dark:stroke-white/20' : 'stroke-zinc-200/70 dark:stroke-white/[0.06]'}
              />
              <text x={MARGIN.left - 10} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="fill-zinc-400 text-[11px] dark:fill-zinc-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(tick, { compact: true })}
              </text>
            </g>
          ))}

          {/* x axis */}
          {xLabels.map(({ index, text }) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={index === points.length - 1 ? 'end' : index === 1 && points.length > 5 ? 'start' : 'middle'}
              className="fill-zinc-400 text-[11px] dark:fill-zinc-500"
            >
              {text}
            </text>
          ))}

          {/* curve */}
          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

          {/* hover read-out */}
          {active && (
            <g pointerEvents="none">
              <line x1={activeX} x2={activeX} y1={MARGIN.top} y2={MARGIN.top + innerHeight} className="stroke-zinc-300 dark:stroke-white/20" />
              <circle cx={activeX} cy={y(active.value)} r="4" fill="currentColor" className="stroke-white dark:stroke-[#111315]" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}

      {active && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#1b1d20]"
          style={{ left: flip ? undefined : activeX + 12, right: flip ? width - activeX + 12 : undefined }}
        >
          <p className="text-zinc-500 dark:text-zinc-400">{active.trade ? formatDateKey(active.label, { withYear: true }) : 'Start'}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMoney(active.value)}</p>
          {active.trade && (
            <p className="mt-1 flex items-center justify-between gap-4 text-zinc-500 dark:text-zinc-400">
              <span>{active.trade.symbol}</span>
              <span className={`tabular-nums ${toneOf(active.pnl) === 'negative' ? 'text-rose-500 dark:text-rose-400' : toneOf(active.pnl) === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                {formatMoney(active.pnl, { signed: true })}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default EquityCurve
