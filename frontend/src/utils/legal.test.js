import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { LEGAL_CONFIG, LEGAL_PAGES } from '../config/legal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(__dirname, '..')

test('LEGAL_PAGES defines all 5 required public legal routes in order', () => {
  assert.deepEqual(
    LEGAL_PAGES.map((p) => p.path),
    ['/terms', '/privacy', '/refund-policy', '/cancellation-policy', '/contact'],
  )
  for (const page of LEGAL_PAGES) {
    assert.ok(page.title && page.title.length > 0)
    assert.ok(page.shortLabel && page.shortLabel.length > 0)
    assert.ok(page.category && page.category.length > 0)
  }
})

test('LEGAL_CONFIG uses a visible support email placeholder until configured', () => {
  assert.equal(LEGAL_CONFIG.supportEmail.confirmed, false)
  assert.match(LEGAL_CONFIG.supportEmail.value, /^\[SET A SUPPORT EMAIL BEFORE LAUNCH\]$/)
})

test('Legal pages do not expose internal implementation identifiers to customers', () => {
  const forbiddenIdentifiers = [
    'PLAN_ENFORCEMENT',
    'entitlementOverrides',
    'legacyProUntil',
    'planAccessUntil',
    'billingCustomerId',
    'billingSubscriptionId',
    'AiUsage',
    'AiReview',
    'AiRangeReview',
    'BillingEvent',
    'googleId',
  ]
  const pageFiles = [
    'pages/TermsPage.jsx',
    'pages/PrivacyPage.jsx',
    'pages/RefundPolicyPage.jsx',
    'pages/CancellationPolicyPage.jsx',
    'pages/ContactPage.jsx',
  ]

  for (const relPath of pageFiles) {
    const content = fs.readFileSync(path.join(srcDir, relPath), 'utf8')
    for (const token of forbiddenIdentifiers) {
      assert.equal(
        content.includes(token),
        false,
        `Expected ${relPath} not to expose internal identifier "${token}"`,
      )
    }
  }
})

test('Public policies cover the basics customers need before paying', () => {
  const terms = fs.readFileSync(path.join(srcDir, 'pages/TermsPage.jsx'), 'utf8')
  const privacy = fs.readFileSync(path.join(srcDir, 'pages/PrivacyPage.jsx'), 'utf8')
  const refund = fs.readFileSync(path.join(srcDir, 'pages/RefundPolicyPage.jsx'), 'utf8')
  const cancellation = fs.readFileSync(path.join(srcDir, 'pages/CancellationPolicyPage.jsx'), 'utf8')
  const contact = fs.readFileSync(path.join(srcDir, 'pages/ContactPage.jsx'), 'utf8')

  assert.match(terms, /Dodo Payments/)
  assert.match(terms, /renew automatically/)
  assert.match(terms, /is financial or trading advice/)
  assert.match(privacy, /Google Gemini/)
  assert.match(privacy, /Dodo Payments/)
  assert.match(refund, /refund requests are reviewed individually/)
  assert.match(cancellation, /stops future renewals/)
  assert.match(contact, /supportEmail/)
})

test('main.jsx registers all 5 public legal routes', () => {
  const mainContent = fs.readFileSync(path.join(srcDir, 'main.jsx'), 'utf8')
  for (const route of ['/terms', '/privacy', '/refund-policy', '/cancellation-policy', '/contact']) {
    const hasRoute = mainContent.includes(`path:'${route}'`) || mainContent.includes(`path: '${route}'`)
    assert.equal(
      hasRoute,
      true,
      `Expected main.jsx to register route ${route}`,
    )
  }
})
