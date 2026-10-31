// The guided tours. A new account starts with no journal and no planner, so the tour is split by what exists:
//   main     right after onboarding: the sidebar, feedback, and what to do first
//   journal  the first time a journal is on screen (usually just after the user creates one)
//   planner  the first time a planner is opened
// Each step points at an element carrying a matching `data-tour="..."` attribute.
//
//   target     CSS selector of the element to highlight (null = a centred card with no highlight)
//   placement  which side of the target the card prefers: 'right' | 'left' | 'top' | 'bottom'
//   sidebar    true = the step points into the sidebar, so the tour opens it first if it is collapsed
//   tip        optional "what to do next" line shown under the explanation
//   checklist  optional numbered list (used by the closing card)
//   primary    optional label for the main button
//
// "{name}" in a title or body is replaced with the user's first name.
// A step whose target is still not on screen after a long wait is skipped; a tour in which no step could be shown stays pending.

const at = (id) => `[data-tour="${id}"]`

export const TOURS = {
  // shown on the journals page right after onboarding
  main: [
    {
      id: 'welcome',
      target: null,
      eyebrow: 'Your first 60 seconds',
      title: 'Let’s make your first trade count, {name}',
      body: 'TradeCommit gets useful when you capture the decision behind a trade—not just the profit or loss. We’ll get your workspace ready, then you can log a real or past trade.',
      primary: 'Show me the first step',
    },
    {
      id: 'journals',
      target: at('sidebar-journals'),
      placement: 'right',
      sidebar: true,
      eyebrow: 'Step 1 · Create a home for your trades',
      title: 'Start with one focused journal',
      body: 'Create one journal for a single account or strategy. Give it a memorable name and choose its base currency—your stats will stay together and make more sense.',
      tip: 'Keep it simple for now. You can add more journals whenever you need them.',
      primary: 'Continue',
    },
    {
      id: 'planners',
      target: at('sidebar-planners'),
      placement: 'right',
      sidebar: true,
      eyebrow: 'Plan before you trade',
      title: 'Trade planners',
      body: 'Planners hold your dated trade plans: setups, key levels and notes for upcoming sessions. Create one here whenever you like, and opening it starts a short walkthrough.',
      tip: 'Optional. A planner can be linked to a journal so the AI mentor can compare plan and result.',
    },
    {
      id: 'done',
      target: null,
      eyebrow: 'Your first win is close',
      title: 'One journal. One trade. Real insight.',
      body: 'We’ll open the journal form next. After creating it, add one recent or historical trade. You don’t need a perfect setup or a long history to get started.',
      checklist: ['Name your journal and select currency', 'Add one trade with entry, exit and stop', 'Write one sentence about why you took it'],
      primary: 'Create my first journal',
    },
  ],

  // shown the first time a journal is on screen, so every step has something to point at
  journal: [
    {
      id: 'context',
      target: at('journal-context'),
      placement: 'bottom',
      title: 'Journal context',
      body: 'Your journal is ready. Write your strategy and default trade properties here. New trades start with those properties, and the weekly AI mentor checks your trades against this strategy.',
      tip: 'Do this first: write the 3 to 5 rules you want to follow. The mentor needs them.',
    },
    {
      id: 'add-trade',
      target: at('add-trade'),
      placement: 'bottom',
      title: 'Log a trade',
      body: 'Add the asset, entry, exit and stop loss, then write why you took it. Paste chart screenshots into your notes, or press the mic to dictate them by voice.',
      tip: 'Log it right after the trade, while the reasoning is fresh.',
    },
    {
      id: 'views',
      target: at('journal-views'),
      placement: 'bottom',
      title: 'Trades and Analysis',
      body: 'Trades lists every entry. Analysis turns them into an equity curve, win rate, profit factor and drawdown. Your AI mentor is the glowing orb in the bottom-right corner, on every tab.',
      tip: 'Hover the orb to open Mentor review. It needs a strategy and a few trades.',
    },
    {
      id: 'more',
      target: at('journal-more'),
      placement: 'bottom',
      title: 'More actions',
      body: 'Open this menu to export the journal as Excel, CSV, PDF or JSON, or all four in a ZIP, for any date range.',
      primary: 'Got it',
    },
  ],

  // shown the first time a planner is opened
  planner: [
    {
      id: 'planner-day',
      target: at('planner-today'),
      placement: 'bottom',
      title: 'Plan any day',
      body: 'Click a day, or its number, to write a plan: the setup, key levels, notes and screenshots. Plans appear as chips on that day, and you click one to reopen it.',
      tip: 'Try it now: click today and plan your next session.',
    },
    {
      id: 'planner-journal',
      target: at('planner-journal'),
      placement: 'bottom',
      title: 'Link a journal',
      body: 'Connect this planner to a journal and the weekly AI mentor compares your plans with the trades you actually took. Days without a plan, and plans you skipped, are never counted as mistakes.',
      primary: 'Got it',
    },
  ],
}

/**
 * The steps to run for a tour. Replaying the main tour while a journal already exists continues straight into the
 * journal steps, so one replay covers everything (its closing checklist is dropped, the journal steps close it instead).
 */
// For someone who already has a journal the "create your first journal" copy is swapped for a neutral one.
const EXISTING_JOURNAL_STEP = {
  eyebrow: 'Step 1 · Your journals',
  title: 'Your journals live here',
  body: 'Switch between journals here, or press + to add another one for a different account or strategy.',
  tip: undefined,
}

export const buildSteps = (tourId, hasJournal) =>
  tourId === 'main' && hasJournal
    ? [...TOURS.main.filter((step) => step.id !== 'done').map((step) => (step.id === 'journals' ? { ...step, ...EXISTING_JOURNAL_STEP } : step)), ...TOURS.journal]
    : TOURS[tourId]
