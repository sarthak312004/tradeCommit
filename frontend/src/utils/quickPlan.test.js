import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BIAS_OPTIONS, EMPTY_QUICK, QUICK_FIELDS, QUICK_FIELD_MAX,
  buildQuickPlanHtml, deriveTitle, hasQuickContent, htmlHasText, sanitizeQuick, textToHtml
} from './quickPlan.js'
import { BLANK_TEMPLATE_ID, EXAMPLE_PLAN, QUICK_TEMPLATES, getTemplate } from './quickPlanTemplates.js'

test('an untouched Quick Plan compiles to nothing, so an empty plan stays empty', () => {
  assert.equal(buildQuickPlanHtml(EMPTY_QUICK), '')
  assert.equal(buildQuickPlanHtml(undefined), '')
  assert.equal(hasQuickContent(EMPTY_QUICK), false)
  assert.equal(hasQuickContent({ setup: '   \n ' }), false)
})

test('only the filled sections are written, in a fixed order, under matching headings', () => {
  const html = buildQuickPlanHtml({ risk: '1% of capital', setup: 'Breakout over 24,800', bias: 'Bullish' })
  assert.equal(html, '<h3>Setup / thesis</h3><p>Breakout over 24,800</p><h3>Bias</h3><p>Bullish</p><h3>Risk</h3><p>1% of capital</p>')
})

test('a bias on its own counts as content', () => {
  assert.equal(hasQuickContent({ bias: 'Bearish' }), true)
  assert.equal(buildQuickPlanHtml({ bias: 'Bearish' }), '<h3>Bias</h3><p>Bearish</p>')
})

test('typed text is HTML-escaped, so a plan can never inject markup', () => {
  const html = buildQuickPlanHtml({ setup: '<img src=x onerror=alert(1)> & "quotes"' })
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; "quotes"'))
})

test('lines become paragraphs; "- " and "1. " runs become real lists', () => {
  assert.equal(textToHtml('one\ntwo'), '<p>one</p><p>two</p>')
  assert.equal(textToHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>')
  assert.equal(textToHtml('1. a\n2) b'), '<ol><li>a</li><li>b</li></ol>')
  assert.equal(textToHtml('intro\n\u2022 a\n* b\nafter'), '<p>intro</p><ul><li>a</li><li>b</li></ul><p>after</p>')
  assert.equal(textToHtml('- a\n1. b'), '<ul><li>a</li></ul><ol><li>b</li></ol>')
  assert.equal(textToHtml('\n  \n'), '')
})

test('sanitizeQuick repairs bad drafts: wrong types, unknown bias, over-long text, extra keys', () => {
  assert.deepEqual(sanitizeQuick(null), EMPTY_QUICK)
  assert.deepEqual(sanitizeQuick('nope'), EMPTY_QUICK)
  const cleaned = sanitizeQuick({ setup: 42, bias: 'Moon', levels: 'x'.repeat(QUICK_FIELD_MAX + 50), evil: 'y' })
  assert.equal(cleaned.setup, '')
  assert.equal(cleaned.bias, '')
  assert.equal(cleaned.levels.length, QUICK_FIELD_MAX)
  assert.equal('evil' in cleaned, false)
  for (const bias of BIAS_OPTIONS) assert.equal(sanitizeQuick({ bias }).bias, bias)
})

test('worst-case input (every character expands when escaped or encoded) still fits the 16 KB request body', () => {
  const worst = (char) => buildQuickPlanHtml({ setup: char.repeat(QUICK_FIELD_MAX), bias: 'Unsure', levels: char.repeat(QUICK_FIELD_MAX), entry: char.repeat(QUICK_FIELD_MAX), invalidation: char.repeat(QUICK_FIELD_MAX), risk: char.repeat(QUICK_FIELD_MAX) })
  for (const char of ['<', '&', '\u4e2d', '\u00e9']) {
    const body = JSON.stringify({ title: char.repeat(120), date: '2026-11-02', content: worst(char), images: [], removedImages: [] })
    assert.ok(new TextEncoder().encode(body).length < 16 * 1024 * 0.9, `${char}: ${new TextEncoder().encode(body).length} bytes`)
  }
})

test('deriveTitle: first line of the setup, shortened at a word; otherwise a dated name', () => {
  assert.equal(deriveTitle({ setup: 'Nifty breakout over 24,800\nmore detail' }), 'Nifty breakout over 24,800')
  const long = deriveTitle({ setup: 'word '.repeat(40) })
  assert.ok(long.length <= 61 && long.endsWith('\u2026'), long)
  assert.equal(deriveTitle({ dateLabel: 'Mon, 2 Nov' }), 'Plan \u00b7 Mon, 2 Nov')
  assert.equal(deriveTitle({ bias: 'Bearish', dateLabel: 'Mon, 2 Nov' }), 'Bearish plan \u00b7 Mon, 2 Nov')
  assert.equal(deriveTitle({ bias: 'Unsure', dateLabel: 'Mon, 2 Nov' }), 'Plan \u00b7 Mon, 2 Nov')
  assert.equal(deriveTitle({}), 'Plan')
})

test('a derived title always fits the backend limit of 120 characters', () => {
  assert.ok(deriveTitle({ setup: 'x'.repeat(500) }).length <= 120)
})

test('htmlHasText treats empty editor output as empty and keeps screenshots', () => {
  assert.equal(htmlHasText(''), false)
  assert.equal(htmlHasText('<p></p>'), false)
  assert.equal(htmlHasText('<p><br></p>'), false)
  assert.equal(htmlHasText('<p>&nbsp;</p>'), false)
  assert.equal(htmlHasText('<p>hi</p>'), true)
  assert.equal(htmlHasText('<p><img src="https://x/y.png"></p>'), true)
})

test('templates only change guidance: every placeholder key is a real field and none writes a value', () => {
  const keys = new Set(QUICK_FIELDS.map((field) => field.key))
  assert.equal(QUICK_TEMPLATES[0].id, BLANK_TEMPLATE_ID)
  for (const template of QUICK_TEMPLATES) {
    assert.ok(template.name && template.description)
    for (const key of Object.keys(template.placeholders)) assert.ok(keys.has(key), `${template.id}: ${key}`)
    assert.equal(hasQuickContent(template), false) // a template object is not plan data
  }
  assert.equal(getTemplate('does-not-exist').id, BLANK_TEMPLATE_ID)
})

test('the example is complete, valid, and compiles to a readable plan (it is shown, never saved by itself)', () => {
  assert.deepEqual(Object.keys(sanitizeQuick(EXAMPLE_PLAN.values)).sort(), Object.keys(EMPTY_QUICK).sort())
  assert.deepEqual(sanitizeQuick(EXAMPLE_PLAN.values), { ...EXAMPLE_PLAN.values })
  const html = buildQuickPlanHtml(EXAMPLE_PLAN.values)
  assert.ok(html.startsWith('<h3>Setup / thesis</h3>'))
  assert.ok(html.includes('<ul><li>Resistance 24,800</li>'))
  assert.ok(Object.isFrozen(EXAMPLE_PLAN) && Object.isFrozen(EXAMPLE_PLAN.values))
})
