import test from 'node:test'
import assert from 'node:assert/strict'
import { buildConnectorPath, computeGuideLayout } from './guideLayout.js'

const viewport = { width: 1280, height: 800 }
const card = { width: 340, height: 260 }
const inBounds = (layout, v = viewport, c = card) =>
  layout.x >= 0 && layout.y >= 0 && layout.x + c.width <= v.width && layout.y + c.height <= v.height

test('no target: a centred card without a connector', () => {
  const layout = computeGuideLayout({ target: null, card, viewport })
  assert.equal(layout.from, null)
  assert.equal(layout.x, (1280 - 340) / 2)
})

test('sidebar target: the card sits to its right and the connector leaves the card edge', () => {
  const target = { left: 0, top: 120, width: 260, height: 36 }
  const layout = computeGuideLayout({ target, card, viewport, placement: 'right' })
  assert.ok(layout.x >= target.left + target.width)
  assert.equal(layout.from.x, layout.x)
  assert.equal(layout.to.x, 260)
  assert.equal(layout.axis, 'x')
  assert.ok(inBounds(layout))
})

test('a preferred side without room flips to the other one', () => {
  const target = { left: 1180, top: 300, width: 80, height: 32 }
  const layout = computeGuideLayout({ target, card, viewport, placement: 'right' })
  assert.ok(layout.x + card.width <= target.left)
  assert.ok(inBounds(layout))
})

test('bottom placement stays inside the viewport, even for a target at the right edge', () => {
  const target = { left: 1000, top: 70, width: 90, height: 32 }
  const layout = computeGuideLayout({ target, card, viewport, placement: 'bottom' })
  assert.ok(layout.y >= target.top + target.height)
  assert.equal(layout.axis, 'y')
  assert.ok(inBounds(layout))
})

test('a target in the bottom-right corner (the mentor orb) puts the card to its left, above the baseline', () => {
  const target = { left: 1204, top: 724, width: 48, height: 48 }
  const layout = computeGuideLayout({ target, card, viewport, placement: 'left' })
  assert.ok(layout.x + card.width <= target.left)
  assert.ok(inBounds(layout))
})

test('phones: a sheet away from the target, connector runs vertically', () => {
  const phone = { width: 390, height: 780 }
  const high = computeGuideLayout({ target: { left: 20, top: 90, width: 200, height: 36 }, card: { width: 358, height: 300 }, viewport: phone, compact: true })
  assert.equal(high.y + 300, phone.height - 16) // target is in the upper half: sheet at the bottom
  const low = computeGuideLayout({ target: { left: 320, top: 700, width: 48, height: 48 }, card: { width: 358, height: 300 }, viewport: phone, compact: true })
  assert.equal(low.y, 16) // target is in the lower half: sheet at the top
  assert.equal(low.axis, 'y')
})

test('connector paths are orthogonal with rounded elbows, and straight when aligned', () => {
  assert.equal(buildConnectorPath({ x: 0, y: 10 }, { x: 100, y: 10 }, 'x'), 'M 0 10 L 100 10')
  const elbow = buildConnectorPath({ x: 300, y: 200 }, { x: 100, y: 120 }, 'x')
  assert.ok(elbow.startsWith('M 300 200') && elbow.endsWith('L 100 120') && elbow.includes('Q'))
  assert.ok(buildConnectorPath({ x: 50, y: 0 }, { x: 80, y: 100 }, 'y').includes('Q'))
  assert.equal(buildConnectorPath(null, null, null), '')
})
