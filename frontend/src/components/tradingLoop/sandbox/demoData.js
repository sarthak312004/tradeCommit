// DEMO DATA for The Trading Loop sandbox. Static constants only: nothing here is read from, or written to, a user's account.
// This file must not import services, contexts or models. That is what keeps the sandbox isolated from production data.

export const DEMO_LABEL = 'DEMO DATA'
export const DEMO_NOTE = 'Illustrative example. Not an analysis of your trades, and nothing here is saved to your account.'

export const SETUPS = [
  {
    id: 'pullback',
    name: 'Pullback continuation',
    blurb: 'Trade with the trend after a shallow pullback to a key level.',
    entry: ['The higher-timeframe trend is up', 'Price pulls back to a key level', 'A confirmation candle closes above the level'],
    stop: 'Below the pullback low',
    risk: 1,
  },
  {
    id: 'retest',
    name: 'Breakout retest',
    blurb: 'Enter when a broken level is retested and holds.',
    entry: ['Price closes beyond a clear level', 'Price returns to retest that level', 'The retest holds and a rejection candle closes'],
    stop: 'Beyond the far side of the retest candle',
    risk: 1,
  },
]

export const RULES = [
  { id: 'risk', text: 'Risk no more than 1% of the account per trade' },
  { id: 'confirm', text: 'No entry without a confirmation candle' },
  { id: 'stop', text: 'Never move a stop further away' },
  { id: 'limit', text: 'Stop trading after two losing trades in a session' },
]

export const planDefaults = (setupId) => {
  const setup = SETUPS.find((item) => item.id === setupId) ?? SETUPS[0]
  return {
    setupName: setup.name,
    entry: setup.entry.map((line, i) => `${i + 1}. ${line}`).join('\n'),
    stopLoss: setup.stop,
    risk: setup.risk,
    notes: 'Wait for the pullback. Do not chase the first move.',
  }
}

// Scene 3: planned vs actual. `match` decides the verdict shown on each row.
export const COMPARISON = [
  { id: 'pullback', planned: 'Wait for pullback', actual: 'Entered early', match: false },
  { id: 'confirm', planned: 'Enter above confirmation', actual: 'Confirmation missing', match: false },
  { id: 'risk', planned: 'Risk 1%', actual: 'Risk 1%', match: true },
]

// Scene 4: illustrative mentor feedback. Hard-coded on purpose; no AI request is ever made from the sandbox.
export const MENTOR_FINDINGS = [
  {
    id: 'early-entry',
    tone: 'issue',
    title: 'Early entry',
    summary: 'The trade was entered before price finished the pullback your plan called for.',
    evidence: 'Planned: wait for pullback. Actual: entered early.',
    suggestion: 'Do not enter until price has reached the key level.',
    rule: 'Wait for the pullback to reach the key level before entering',
  },
  {
    id: 'missing-confirmation',
    tone: 'issue',
    title: 'Missing confirmation',
    summary: 'No confirmation candle had closed when the order was placed, so the entry condition in the plan was not met.',
    evidence: 'Planned: enter above confirmation. Actual: confirmation missing.',
    suggestion: 'Make the confirmation close a hard requirement, not a preference.',
    rule: 'No entry until a confirmation candle has closed',
  },
  {
    id: 'risk-held',
    tone: 'good',
    title: 'Risk matched the plan',
    summary: 'Risk stayed at 1%, as planned. That part of the process held up even though the entry did not.',
    evidence: 'Planned: risk 1%. Actual: risk 1%.',
  },
]
