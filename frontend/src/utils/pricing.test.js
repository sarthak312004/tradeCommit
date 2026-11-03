import assert from 'node:assert/strict'
import test from 'node:test'
import { PRICES, displayRegion, formatPrice, pricingView, savingsPercent, yearlyPerMonth } from '../config/pricing.js'

const region = (timeZone, language) => displayRegion({ timeZone, language })

test('displayRegion: India time zone or Indian language shows the India price first', () => {
  assert.equal(region('Asia/Kolkata', 'en-US'), 'IN')
  assert.equal(region('Asia/Calcutta', 'en-US'), 'IN') // older name of the same zone
  assert.equal(region('America/New_York', 'en-IN'), 'IN')
  assert.equal(region('Europe/London', 'EN-in'), 'IN') // case does not matter
  assert.equal(region('Europe/London', 'hi'), 'IN')
  assert.equal(region('Europe/London', 'hi-IN'), 'IN')
  assert.equal(region('Europe/London', 'hi-Latn'), 'IN')
})

test('displayRegion: everything else is international', () => {
  assert.equal(region('America/New_York', 'en-US'), 'INTL')
  assert.equal(region('Europe/Berlin', 'de-DE'), 'INTL')
  assert.equal(region('Asia/Dubai', 'en-GB'), 'INTL')
  assert.equal(region('Asia/Colombo', 'ta-LK'), 'INTL')
  assert.equal(region('Europe/London', 'high'), 'INTL') // starts with "hi" but is not hi or hi-*
  assert.equal(region('Europe/London', 'en'), 'INTL')
})

test('displayRegion: missing or odd values fall back to international and never throw', () => {
  assert.equal(displayRegion({}), 'INTL')
  assert.equal(displayRegion({ timeZone: null, language: undefined }), 'INTL')
  assert.equal(displayRegion(null), 'INTL')
  assert.equal(region('', ''), 'INTL')
})

test('displayRegion with no argument reads the environment without throwing', () => {
  assert.ok(['IN', 'INTL'].includes(displayRegion()))
})

test('savingsPercent: about 24% international and about 17% India, from PRICES', () => {
  assert.equal(PRICES.yearly.usd, 119)
  assert.equal(savingsPercent('usd'), 24) // 1 - 119 / (12.99 * 12) = 23.7%
  assert.equal(savingsPercent('inr'), 17) // 1 - 4999 / (499 * 12) = 16.5%
})

test('savingsPercent follows whatever prices it is given, and never goes negative', () => {
  const prices = { monthly: { usd: 10, inr: 100 }, yearly: { usd: 60, inr: 1500 } }
  assert.equal(savingsPercent('usd', prices), 50)
  assert.equal(savingsPercent('inr', prices), 0) // yearly dearer than 12 months: no saving shown
  assert.equal(savingsPercent('usd', { monthly: { usd: 0 }, yearly: { usd: 5 } }), 0)
  assert.equal(savingsPercent('eur'), 0)
})

test('yearlyPerMonth is the yearly price over twelve months', () => {
  assert.ok(Math.abs(yearlyPerMonth('usd') - 119 / 12) < 1e-9)
  assert.ok(Math.abs(yearlyPerMonth('inr') - 4999 / 12) < 1e-9)
})

test('formatPrice keeps cents only when there are some', () => {
  assert.equal(formatPrice(12.99, 'usd'), '$12.99')
  assert.equal(formatPrice(119, 'usd'), '$119')
  assert.equal(formatPrice(119 / 12, 'usd'), '$9.92')
  assert.match(formatPrice(4999, 'inr'), /^₹\s?4,999$/)
  assert.match(formatPrice(499, 'inr'), /^₹\s?499$/)
  assert.match(formatPrice(4999 / 12, 'inr'), /^₹\s?417$/)
})

test('pricingView: the detected region leads, the other region is secondary', () => {
  const india = pricingView('yearly', 'IN')
  assert.equal(india.primary.currency, 'inr')
  assert.equal(india.secondary.currency, 'usd')
  assert.equal(india.primary.amount, 4999)
  assert.equal(india.secondary.amount, 119)
  assert.equal(india.savingsPercent, 17)
  assert.equal(india.secondary.regionLabel, 'International')

  const intl = pricingView('yearly', 'INTL')
  assert.equal(intl.primary.currency, 'usd')
  assert.equal(intl.secondary.currency, 'inr')
  assert.equal(intl.savingsPercent, 24)
  assert.equal(intl.secondary.regionLabel, 'India')
})

test('pricingView: monthly has no per-month line, yearly does; an unknown region means international', () => {
  assert.equal(pricingView('monthly', 'INTL').primary.perMonthText, null)
  assert.equal(pricingView('monthly', 'INTL').primary.text, '$12.99')
  assert.equal(pricingView('yearly', 'INTL').primary.perMonthText, '$9.92')
  assert.equal(pricingView('monthly', 'ZZ').primary.currency, 'usd')
})
