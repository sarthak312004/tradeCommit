// Where the guide card goes and how its thin connector reaches the highlighted element (pure: unit-tested).
//
//   computeGuideLayout({ target, card, viewport, placement, compact })
//     target     { left, top, width, height } of the highlighted element (viewport coordinates), or null (centred card)
//     card       { width, height } of the measured card
//     viewport   { width, height }
//     placement  preferred side of the target: 'right' | 'left' | 'bottom' | 'top'
//     compact    phones: the card becomes a sheet at the top or bottom edge, away from the target
//   -> { x, y, from, to, axis } (from = on the card edge, to = on the target edge, axis = 'x' | 'y' | null)

const MARGIN = 16
const GAP = 40 // space between the card and the highlighted element: the connector lives here
const STAGGER = 28 // the card sits slightly off-axis, so the connector reads as a deliberate elbow
const INSET = 22 // keep connector ends away from the card's rounded corners

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))
const centerX = (rect) => rect.left + rect.width / 2
const centerY = (rect) => rect.top + rect.height / 2

export function computeGuideLayout({ target, card, viewport, placement = 'right', compact = false, safeTop = 0, safeBottom = 0 }) {
  const { width: vw, height: vh } = viewport
  const top = MARGIN + safeTop
  const bottom = vh - MARGIN - safeBottom

  if (!target) {
    return { x: Math.round((vw - card.width) / 2), y: Math.round(Math.max(top, (vh - card.height) / 2)), from: null, to: null, axis: null }
  }

  if (compact) {
    const width = Math.min(card.width, vw - MARGIN * 2)
    const x = Math.round((vw - width) / 2)
    const sheetOnTop = centerY(target) > vh / 2
    const y = Math.round(sheetOnTop ? top : bottom - card.height)
    const tx = clamp(centerX(target), target.left + 6, target.left + target.width - 6)
    const fx = clamp(tx, x + INSET, x + width - INSET)
    return {
      x,
      y,
      from: { x: fx, y: sheetOnTop ? y + card.height : y },
      to: { x: tx, y: sheetOnTop ? target.top : target.top + target.height },
      axis: 'y',
    }
  }

  // flip to the other side when the preferred one has no room
  let side = placement
  if (side === 'right' && target.left + target.width + GAP + card.width > vw - MARGIN) side = 'left'
  else if (side === 'left' && target.left - GAP - card.width < MARGIN) side = 'right'
  else if (side === 'bottom' && target.top + target.height + GAP + card.height > bottom) side = 'top'
  else if (side === 'top' && target.top - GAP - card.height < top) side = 'bottom'

  if (side === 'right' || side === 'left') {
    const x = side === 'right' ? target.left + target.width + GAP : target.left - GAP - card.width
    // the card hangs off-axis: below the target's centre line on the upper half of the screen, above it on the lower half
    const below = centerY(target) < vh / 2
    const y = clamp(below ? centerY(target) + STAGGER - 24 : centerY(target) - STAGGER - card.height + 24, top, bottom - card.height)
    const toY = clamp(centerY(target), target.top + 4, target.top + target.height - 4)
    const fromY = clamp(toY, y + INSET, y + card.height - INSET)
    return {
      x: Math.round(x),
      y: Math.round(y),
      from: { x: side === 'right' ? x : x + card.width, y: fromY },
      to: { x: side === 'right' ? target.left + target.width : target.left, y: toY },
      axis: 'x',
    }
  }

  const y = side === 'bottom' ? target.top + target.height + GAP : target.top - GAP - card.height
  const x = clamp(centerX(target) - card.width * 0.72, MARGIN, vw - MARGIN - card.width)
  const toX = clamp(centerX(target), target.left + 4, target.left + target.width - 4)
  const fromX = clamp(toX, x + INSET, x + card.width - INSET)
  return {
    x: Math.round(x),
    y: Math.round(y),
    from: { x: fromX, y: side === 'bottom' ? y : y + card.height },
    to: { x: toX, y: side === 'bottom' ? target.top + target.height : target.top },
    axis: 'y',
  }
}

/**
 * A thin orthogonal path with softly rounded elbows, from the card to the element.
 * axis 'x': horizontal - vertical - horizontal; axis 'y': vertical - horizontal - vertical.
 */
export function buildConnectorPath(from, to, axis, radius = 10) {
  if (!from || !to || !axis) return ''
  const round = (n) => Math.round(n * 10) / 10
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (axis === 'x') {
    if (Math.abs(dy) < 2) return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(from.y)}`
    const midX = from.x + dx / 2
    const r = Math.min(radius, Math.abs(dy) / 2, Math.abs(dx) / 2)
    const sx = Math.sign(dx) || 1
    const sy = Math.sign(dy)
    return [
      `M ${round(from.x)} ${round(from.y)}`,
      `L ${round(midX - sx * r)} ${round(from.y)}`,
      `Q ${round(midX)} ${round(from.y)} ${round(midX)} ${round(from.y + sy * r)}`,
      `L ${round(midX)} ${round(to.y - sy * r)}`,
      `Q ${round(midX)} ${round(to.y)} ${round(midX + sx * r)} ${round(to.y)}`,
      `L ${round(to.x)} ${round(to.y)}`,
    ].join(' ')
  }
  if (Math.abs(dx) < 2) return `M ${round(from.x)} ${round(from.y)} L ${round(from.x)} ${round(to.y)}`
  const midY = from.y + dy / 2
  const r = Math.min(radius, Math.abs(dx) / 2, Math.abs(dy) / 2)
  const sx = Math.sign(dx)
  const sy = Math.sign(dy) || 1
  return [
    `M ${round(from.x)} ${round(from.y)}`,
    `L ${round(from.x)} ${round(midY - sy * r)}`,
    `Q ${round(from.x)} ${round(midY)} ${round(from.x + sx * r)} ${round(midY)}`,
    `L ${round(to.x - sx * r)} ${round(midY)}`,
    `Q ${round(to.x)} ${round(midY)} ${round(to.x)} ${round(midY + sy * r)}`,
    `L ${round(to.x)} ${round(to.y)}`,
  ].join(' ')
}
