// Hardcoded sample data for the "demo" tour step.
// It is an illustration only: it is never saved, never sent to the server, never read by the AI, and never the user's data.

export const DEMO_BLOCKS = [
  { id: 'strategy', name: 'Strategy', hint: 'You write your rules once. All trades in the journal share them.' },
  { id: 'plan', name: 'Plan', hint: 'You write the plan before the session.' },
  { id: 'trades', name: 'Trades', hint: 'You log each trade. Trade 2 follows Plan 1.' },
  { id: 'feedback', name: 'AI feedback', hint: 'The AI mentor compares the plan with the trade.' },
]

export const DEMO_RULES = ['Trade with the trend only.', 'Risk 1% or less on each trade.']

export const DEMO_PLAN = { name: 'Plan 1', day: 'Monday', text: 'Buy pullback to 21 EMA, risk 1%' }

// `plan: true` marks the trade that follows the sample plan (it gets the shared sky accent).
export const DEMO_TRADES = [
  { id: 1, asset: 'TSLA', direction: 'Short', status: 'Closed' },
  { id: 2, asset: 'AAPL', direction: 'Long', status: 'Closed', plan: true },
  { id: 3, asset: 'AAPL', direction: 'Long', status: 'Open' },
]

export const DEMO_FEEDBACK = 'Plan said wait for the pullback. Trade 2 entered early.'
