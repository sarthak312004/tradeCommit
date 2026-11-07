import { toDateKey } from '../../utils/calendar.js'

const shiftDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export const DEMO_JOURNAL_ID = 'demo-journal-swing'
export const DEMO_PLANNER_ID = 'demo-planner-swing'

export const DEMO_STRATEGY_RULES = Object.freeze([
  '1. Enter only after a 1H or daily candle closes beyond the planned level.',
  '2. Risk at most 1R per trade and set the invalidation stop before entry.',
  '3. Skip all entries during the first 15 minutes after the session open.',
  '4. Record the setup reason and plan check on every trade log.',
])

export const DEMO_ATTRIBUTES = Object.freeze([
  {
    id: 'demo-attr-setup',
    name: 'Setup',
    type: 'select',
    options: ['Breakout retest', 'Range reclaim', 'Pullback', 'Opening chase'],
  },
  {
    id: 'demo-attr-plan',
    name: 'Plan check',
    type: 'select',
    options: ['Followed plan', 'Early entry', 'Unplanned'],
  },
])

export const DEMO_CARRY_FORWARD = Object.freeze({
  rule: 'Wait for the first 15-minute candle to close before taking any breakout entry.',
  planLine: 'No orders before 09:45; require a 15-minute close above the planned trigger.',
  checkpoint: 'Zero entries logged in the first 15 minutes of the session.',
})

export const DEMO_MENTOR_PROGRESS = Object.freeze({
  count: 12,
  target: 5,
  completed: true,
  firstFeedbackReceived: true,
  celebrated: true,
})

const TRADE_SPECS = [
  {
    offsetDays: -12,
    exitOffsetDays: -11,
    symbol: 'ACME',
    side: 'Long',
    qty: 20,
    entryPrice: 105,
    exitPrice: 112,
    entryTime: '10:15',
    exitTime: '14:40',
    charges: 4,
    setup: 'Breakout retest',
    planCheck: 'Followed plan',
    notes: 'Waited for 1H close above 104.80 resistance; exited at planned target.',
  },
  {
    offsetDays: -11,
    exitOffsetDays: -10,
    symbol: 'NOVA',
    side: 'Short',
    qty: 30,
    entryPrice: 54,
    exitPrice: 50,
    entryTime: '10:30',
    exitTime: '15:10',
    charges: 5,
    setup: 'Range reclaim',
    planCheck: 'Followed plan',
    notes: 'Failed breakout rejection at prior high with clear invalidation at 55.20.',
  },
  {
    offsetDays: -10,
    exitOffsetDays: -10,
    symbol: 'VEXA',
    side: 'Long',
    qty: 25,
    entryPrice: 82,
    exitPrice: 78,
    entryTime: '09:34',
    exitTime: '11:05',
    charges: 4,
    setup: 'Opening chase',
    planCheck: 'Early entry',
    notes: 'Entered 4 minutes after the open before the level held; stopped out.',
  },
  {
    offsetDays: -9,
    exitOffsetDays: -8,
    symbol: 'KRON',
    side: 'Long',
    qty: 15,
    entryPrice: 140,
    exitPrice: 149,
    entryTime: '11:00',
    exitTime: '15:20',
    charges: 5,
    setup: 'Pullback',
    planCheck: 'Followed plan',
    notes: 'Higher-low pullback into 20-day moving average after confirmation candle.',
  },
  {
    offsetDays: -8,
    exitOffsetDays: -8,
    symbol: 'ORBX',
    side: 'Short',
    qty: 40,
    entryPrice: 32,
    exitPrice: 34.5,
    entryTime: '09:36',
    exitTime: '10:25',
    charges: 4,
    setup: 'Opening chase',
    planCheck: 'Early entry',
    notes: 'Shorted opening spike before 15m candle close; reversed into stop.',
  },
  {
    offsetDays: -7,
    exitOffsetDays: -6,
    symbol: 'ZETA',
    side: 'Long',
    qty: 20,
    entryPrice: 64,
    exitPrice: 69.5,
    entryTime: '10:45',
    exitTime: '14:15',
    charges: 4,
    setup: 'Breakout retest',
    planCheck: 'Followed plan',
    notes: 'Clean retest of weekly pivot level with 1R defined risk.',
  },
  {
    offsetDays: -6,
    exitOffsetDays: -5,
    symbol: 'LUMEN',
    side: 'Short',
    qty: 25,
    entryPrice: 91,
    exitPrice: 86,
    entryTime: '11:20',
    exitTime: '15:00',
    charges: 5,
    setup: 'Pullback',
    planCheck: 'Followed plan',
    notes: 'Lower-high rejection under breakdown level; held to target.',
  },
  {
    offsetDays: -5,
    exitOffsetDays: -5,
    symbol: 'SOLAR',
    side: 'Long',
    qty: 30,
    entryPrice: 45,
    exitPrice: 42.5,
    entryTime: '09:38',
    exitTime: '10:50',
    charges: 4,
    setup: 'Opening chase',
    planCheck: 'Early entry',
    notes: 'Took opening drive before 09:45 checkpoint; faded back inside range.',
  },
  {
    offsetDays: -4,
    exitOffsetDays: -3,
    symbol: 'TERRA',
    side: 'Long',
    qty: 20,
    entryPrice: 73,
    exitPrice: 78,
    entryTime: '10:20',
    exitTime: '14:55',
    charges: 4,
    setup: 'Range reclaim',
    planCheck: 'Followed plan',
    notes: 'Reclaimed prior week low after 1H close; followed stop rule.',
  },
  {
    offsetDays: -3,
    exitOffsetDays: -3,
    symbol: 'PULSE',
    side: 'Short',
    qty: 20,
    entryPrice: 60,
    exitPrice: 62,
    entryTime: '13:10',
    exitTime: '15:05',
    charges: 4,
    setup: 'Pullback',
    planCheck: 'Followed plan',
    notes: 'Valid setup that hit the planned 1R stop without rule violation.',
  },
  {
    offsetDays: -2,
    exitOffsetDays: -1,
    symbol: 'ACME',
    side: 'Long',
    qty: 20,
    entryPrice: 112.5,
    exitPrice: 118.5,
    entryTime: '10:35',
    exitTime: '15:15',
    charges: 4,
    setup: 'Breakout retest',
    planCheck: 'Followed plan',
    notes: 'Planned retest above 112.00 after 1H confirmation close.',
  },
  {
    offsetDays: 0,
    exitOffsetDays: null,
    symbol: 'NOVA',
    side: 'Long',
    qty: 25,
    entryPrice: 48.8,
    exitPrice: null,
    entryTime: '10:25',
    exitTime: '',
    charges: 2,
    setup: 'Breakout retest',
    planCheck: 'Followed plan',
    notes: 'Open swing position from planned 48.50 retest; stop set at 47.20.',
  },
]

export const buildDemoTrades = (baseDate = new Date()) => {
  return TRADE_SPECS.map((spec, index) => {
    const entryDate = toDateKey(shiftDays(baseDate, spec.offsetDays))
    const exitDate = spec.exitOffsetDays === null ? '' : toDateKey(shiftDays(baseDate, spec.exitOffsetDays))
    return {
      id: `demo-trade-${index + 1}`,
      symbol: spec.symbol,
      side: spec.side,
      qty: spec.qty,
      entryPrice: spec.entryPrice,
      exitPrice: spec.exitPrice,
      entryTime: spec.entryTime,
      exitTime: spec.exitTime,
      entryDate,
      exitDate,
      leverage: 1,
      charges: spec.charges,
      notes: spec.notes,
      properties: {
        'demo-attr-setup': spec.setup,
        'demo-attr-plan': spec.planCheck,
      },
      imageUrls: [],
    }
  })
}

export const buildDemoJournal = (baseDate = new Date()) => ({
  id: DEMO_JOURNAL_ID,
  name: 'Demo: Swing trades',
  icon: 'book',
  mode: 'live',
  currency: 'USD',
  readOnly: false,
  notes: 'Illustrative swing journal showing how plans, trades, and AI mentor reviews connect.',
  context: {
    strategy: DEMO_STRATEGY_RULES.join('\n'),
    attributes: DEMO_ATTRIBUTES.map((attr) => ({ ...attr, options: [...attr.options] })),
  },
  trades: buildDemoTrades(baseDate),
})

export const DEMO_PLANNER = Object.freeze({
  id: DEMO_PLANNER_ID,
  name: 'Demo: Swing planner',
  type: 'swing',
  icon: 'calendar',
  readOnly: false,
  linkedJournalId: DEMO_JOURNAL_ID,
  linkedJournal: Object.freeze({
    id: DEMO_JOURNAL_ID,
    name: 'Demo: Swing trades',
    icon: 'book',
    currency: 'USD',
  }),
})

export const buildDemoPlanEntries = (baseDate = new Date()) => {
  const pastDateKey = toDateKey(shiftDays(baseDate, -2))
  return [
    {
      _id: 'demo-plan-entry-1',
      id: 'demo-plan-entry-1',
      planner: DEMO_PLANNER_ID,
      date: pastDateKey,
      scope: 'day',
      title: 'ACME & NOVA retest plan',
      content: '<p><strong>Bias:</strong> Constructive above prior session support.</p><p><strong>Setups:</strong> ACME long on 1H retest of 112.00 (stop 109.50); NOVA long on 1H hold above 48.50 (stop 47.20).</p><p><strong>Rule focus:</strong> Skip the first 15 minutes after the open.</p>',
      images: [],
    },
  ]
}

export const buildDemoReviewData = (baseDate = new Date()) => {
  const plannedDateKey = toDateKey(shiftDays(baseDate, -2))
  const earlyDateKey = toDateKey(shiftDays(baseDate, -5))

  return {
    stats: {
      trades: 12,
      closed: 11,
      netPnl: 467,
      winRate: 64,
      expectancyR: 0.52,
      rewardRisk: 1.68,
    },
    review: {
      headline: 'Planned retests worked; opening-bell entries gave back part of the edge.',
      summary:
        'Eight of twelve trades followed your written rules and waited for a 1H close. All three avoidable losses happened inside the first 15 minutes after the session open.',
      flywheel: {
        weakestLink: {
          stage: 'execute',
          detail: 'Plans defined clear levels, but three entries were taken in the first 15 minutes before the candle closed.',
        },
        lastCommitment: {
          status: 'partly_kept',
          evidence: 'Risk stayed within 1R on every trade, but three entries broke the 15-minute opening wait rule.',
        },
        leaks: [
          {
            title: 'Entering during the first 15 minutes before confirmation',
            cost: '-$287 across 3 trades',
            detail: 'VEXA, ORBX, and SOLAR were entered between 09:34 and 09:38 without waiting for the first candle close.',
            trades: ['VEXA', 'ORBX', 'SOLAR'],
          },
        ],
        edgeSignal: {
          confidence: 'building',
          detail: 'Trades taken after 10:00 with a logged setup reason went 7-for-8. The sample is still small, so keep rules steady.',
        },
        carryForward: { ...DEMO_CARRY_FORWARD },
      },
      nextActions: [
        'Add a pre-trade checkpoint: no orders before 09:45.',
        'Keep logging the Setup and Plan check tags on every trade.',
      ],
      strengths: [
        {
          title: 'Confirmed retests respected planned invalidation levels',
          detail: 'When you waited for a 1H close on ACME, NOVA, and ZETA, risk stayed capped at 1R.',
          trades: ['ACME', 'NOVA', 'ZETA'],
        },
      ],
      issues: [
        {
          title: 'First-15-minute entries bypassed the confirmation rule',
          detail: 'Three impulse entries right after the bell accounted for the avoidable drawdown.',
          trades: ['VEXA', 'ORBX', 'SOLAR'],
        },
      ],
      discipline: {
        explanation: 'Three of four strategy rules were followed consistently; only the opening 15-minute filter slipped.',
      },
      ruleChecks: [
        {
          rule: DEMO_STRATEGY_RULES[2],
          status: 'broken',
          evidence: 'Three trades (VEXA, ORBX, SOLAR) were entered between 09:34 and 09:38.',
          trades: ['VEXA', 'ORBX', 'SOLAR'],
        },
        {
          rule: DEMO_STRATEGY_RULES[0],
          status: 'followed',
          evidence: 'Retest entries after 10:00 waited for candle confirmation.',
          trades: ['ACME', 'NOVA', 'KRON', 'ZETA'],
        },
        {
          rule: DEMO_STRATEGY_RULES[1],
          status: 'followed',
          evidence: 'Every closed loss stopped out at or within the planned 1R level.',
          trades: ['PULSE'],
        },
        {
          rule: DEMO_STRATEGY_RULES[3],
          status: 'followed',
          evidence: 'All 12 trades include setup tags and entry reasoning.',
          trades: ['ACME', 'NOVA'],
        },
      ],
      leakReport: {
        tooFewTrades: false,
        confidence: 'early',
        orderChecksSkipped: false,
        items: [
          {
            id: 'opening-chase-leak',
            title: 'Entries in the first 15 minutes after the open',
            kind: 'money',
            amount: -287,
            detail: '3 trades entered before 09:45 netted -$287 combined.',
            fix: 'Wait for the 09:45 candle close before placing any breakout order.',
            trades: ['VEXA', 'ORBX', 'SOLAR'],
          },
        ],
      },
      planAlignment: {
        defaultOpen: true,
        summary: 'Planned setups on ACME and NOVA matched the written plan; an unplanned opening trade on SOLAR lost money.',
        days: [
          {
            date: plannedDateKey,
            status: 'executed_as_planned',
            detail: 'Waited for the 112.00 retest on ACME after the 10:00 close, matching the daily plan.',
            trades: ['ACME'],
          },
          {
            date: earlyDateKey,
            status: 'deviated',
            detail: 'Entered SOLAR at 09:38 before the 15-minute opening wait rule.',
            trades: ['SOLAR'],
          },
        ],
      },
      mentorNote: 'Your edge is already visible when you wait for confirmation. Make the 09:45 rule a single checkbox in tomorrow’s plan.',
    },
  }
}

export const DEMO_JOURNAL = buildDemoJournal()
export const DEMO_PLAN_ENTRIES = buildDemoPlanEntries()
export const DEMO_REVIEW_DATA = buildDemoReviewData()
