import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_WEEKLY_SECTIONS, EMPTY_WEEKLY, WEEKLY_ONE_RULE_MAX,
  addDaysToKey, appendWeeklyPlanHtml, buildWeeklyPlanHtml, hasWeeklyContent, sanitizeWeekly, sanitizeWeeklySections,
  weekRangeLabel, weekStartKey, weekTitle, weeklyDraftKey
} from './quickPlan.js'

test('an untouched weekly plan compiles to nothing', () => {
  assert.equal(buildWeeklyPlanHtml(EMPTY_WEEKLY), '')
  assert.equal(buildWeeklyPlanHtml(undefined), '')
  assert.equal(hasWeeklyContent(EMPTY_WEEKLY), false)
})

test('bias, the one rule and open sections compile in order, with the one rule highlighted', () => {
  const html = buildWeeklyPlanHtml({ bias: 'Bullish', oneRule: 'No revenge trades <ever>', levels: 'Support 24,300', risk: '3% for the week' })
  assert.equal(html, "<h3>Bias</h3><p>Bullish</p><h3>The one rule I won't break</h3><p><strong>No revenge trades &lt;ever&gt;</strong></p><h3>Key levels</h3><p>Support 24,300</p><h3>Risk budget</h3><p>3% for the week</p>")
})

test('adding a quick section to an existing full-editor plan preserves the original and compiles the new field', () => {
  const existing = '<h3>My custom setup</h3><p>Keep this analysis.</p>'
  assert.equal(
    appendWeeklyPlanHtml(existing, { events: 'Wed: earnings' }, ['events']),
    `${existing}<h3>Events to watch</h3><p>Wed: earnings</p>`
  )
})

test('cards follow the chosen order, and a removed card is left out even if it still holds text', () => {
  const values = { goals: '- Journal daily', rules: '1. Max 3 trades', levels: 'Level A' }
  assert.equal(buildWeeklyPlanHtml(values, ['rules', 'goals']), '<h3>Rules</h3><ol><li>Max 3 trades</li></ol><h3>Goals</h3><ul><li>Journal daily</li></ul>')
  assert.equal(hasWeeklyContent({ levels: 'Level A' }, ['goals']), false)
  assert.equal(hasWeeklyContent({ levels: 'Level A' }, ['levels']), true)
})

test('sanitizers cope with junk from an old or edited draft', () => {
  assert.deepEqual(sanitizeWeeklySections('nope'), [...DEFAULT_WEEKLY_SECTIONS])
  assert.deepEqual(sanitizeWeeklySections(['rules', 'bogus', 'rules', 'goals']), ['rules', 'goals'])
  const clean = sanitizeWeekly({ bias: 'Sideways', oneRule: `a\nb${'x'.repeat(500)}`, levels: 5 })
  assert.equal(clean.bias, '')
  assert.equal(clean.levels, '')
  assert.ok(!clean.oneRule.includes('\n') && clean.oneRule.length === WEEKLY_ONE_RULE_MAX)
})

test('the week starts on Monday and is worked out from the date string alone', () => {
  assert.equal(weekStartKey('2026-11-03'), '2026-11-02')
  assert.equal(weekStartKey('2026-11-02'), '2026-11-02')
  assert.equal(weekStartKey('2026-11-08'), '2026-11-02') // Sunday belongs to the week that began on Monday
  assert.equal(weekStartKey('2027-01-01'), '2026-12-28')
  assert.equal(weekStartKey('not a date'), 'not a date')
  assert.equal(addDaysToKey('2026-02-27', 3), '2026-03-02')
})

test('the default title and the read-only week text', () => {
  assert.equal(weekTitle('2026-11-02'), 'Week of 2 Nov \u2013 8 Nov')
  assert.equal(weekRangeLabel('2026-11-02'), 'Mon 2 Nov \u2013 Sun 8 Nov 2026')
  assert.equal(weekRangeLabel('2026-12-28'), 'Mon 28 Dec 2026 \u2013 Sun 3 Jan 2027')
})

test('weekly drafts use their own key, separate from the daily draft', () => {
  assert.equal(weeklyDraftKey('p1', '2026-11-02'), 'tradecommit:plan-form-draft:week:p1:2026-11-02')
})
