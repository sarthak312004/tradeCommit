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
// A step whose target is not on screen is skipped automatically.

const at = (id) => `[data-tour="${id}"]`

export const TOURS = {
  // shown on the journals page right after onboarding
  main: [
    {
      id: 'welcome',
      target: null,
      title: 'Welcome to TradeCommit, {name}',
      body: 'Here is a one-minute tour of the places you will use most. You can skip it now and replay it any time from your profile menu.',
      primary: 'Start tour',
    },
    {
      id: 'journals',
      target: at('sidebar-journals'),
      placement: 'right',
      sidebar: true,
      title: 'Your journals',
      body: 'A journal holds the trades of one account or strategy, in its own currency. Press + to create your first one: give it a name and pick its currency.',
      tip: 'Use a separate journal for each strategy so every strategy\u2019s stats stay clean.',
    },
    {
      id: 'planners',
      target: at('sidebar-planners'),
      placement: 'right',
      sidebar: true,
      title: 'Trade planner',
      body: 'Plan before the market opens. A planner is a calendar of dated plans with notes and screenshots. Press + to create one for a style you trade, like Intraday or Swing.',
      tip: 'Open a planner once it exists and you will get a short walkthrough.',
    },
    {
      id: 'feedback',
      target: at('sidebar-feedback'),
      placement: 'right',
      sidebar: true,
      title: 'Feedback and bugs',
      body: 'Something broken, or an idea that would improve your routine? Send it from here. It helps shape what TradeCommit becomes next.',
    },
    {
      id: 'done',
      target: null,
      title: 'You\u2019re ready to start',
      body: 'Good first moves, in this order:',
      checklist: ['Create your first journal with the + in the sidebar', 'Write your strategy in Journal context', 'Log your first trade', 'Create a trade planner and plan tomorrow'],
      primary: 'Got it',
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
      body: 'Trades lists every entry. Analysis turns them into an equity curve, win rate, profit factor and drawdown, and it is where your weekly AI mentor review lives.',
      tip: 'The mentor review needs a strategy and a few trades.',
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
export const buildSteps = (tourId, hasJournal) =>
  tourId === 'main' && hasJournal ? [...TOURS.main.filter((step) => step.id !== 'done'), ...TOURS.journal] : TOURS[tourId]
