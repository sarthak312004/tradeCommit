// Copy, anchors and behaviour of every step of the guided onboarding. Step ids live in utils/onboardingGuide.js.
//
//   target       CSS selector of the element the card is connected to (null = a centred card)
//   placement    preferred side of the target for the card: 'right' | 'left' | 'bottom' | 'top'
//   sidebar      true = the step points into the sidebar (opened first when collapsed; on phones every other step puts it away)
//   interactive  true = the highlighted element stays clickable (the user has to use it); false = look, don't touch
//   primary      'next' | 'create-journal' | 'finish' (what the main button does)
//
// The anchors are existing `data-tour` attributes / `data-tour-section` on the real UI, so the guide always points at the
// actual Planner header, Journals section, journal Context and Add-trade buttons and the AI Mentor orb.

import { GUIDE_STEP } from '../../utils/onboardingGuide'

const at = (id) => `[data-tour="${id}"]`

export const GUIDE_STAGES = [
  { id: 'plan', label: 'Plan' },
  { id: 'journal', label: 'Journal' },
  { id: 'feedback', label: 'AI feedback' },
]

export const GUIDE_STEPS = {
  [GUIDE_STEP.PLANNER]: {
    target: at('sidebar-planners'),
    placement: 'right',
    sidebar: true,
    interactive: false,
    title: 'Plan before you trade',
    body: 'Write down what you’re looking for before the market opens: the setup, the levels that matter, and what would keep you out. A plan turns a trade from a reaction into a decision.',
    note: 'Planners live here. Create one whenever you’re ready, there’s no rush.',
    primary: 'next',
    primaryLabel: 'Continue',
  },
  [GUIDE_STEP.CREATE_JOURNAL]: {
    target: '[data-tour-section="sidebar-journals"]',
    placement: 'right',
    sidebar: true,
    interactive: true,
    keepFocus: true, // the journal form lives behind this step: never pull focus away from it
    title: 'Create your first journal',
    body: 'A journal is the home for one account or one strategy. Give it a name and a base currency, and every trade you log rolls up into one honest set of stats.',
    note: 'The currency can’t be changed later, so pick the one your account trades in.',
    waiting: 'Waiting for your journal…',
    primary: 'create-journal',
    primaryLabel: 'Create journal',
  },
  [GUIDE_STEP.JOURNAL_CONTEXT]: {
    target: at('journal-context'),
    placement: 'bottom',
    interactive: true,
    title: 'Give your journal context',
    body: 'Describe your strategy and the rules you want to follow. Every trade in this journal is read against this context, so your AI mentor knows what you were trying to do, not just what happened.',
    note: 'Three to five clear rules is plenty to start.',
    primary: 'next',
    primaryLabel: 'Next',
  },
  [GUIDE_STEP.JOURNAL_EXECUTION]: {
    target: at('add-trade'),
    placement: 'bottom',
    interactive: true,
    title: 'Record what actually happened',
    body: 'Log each trade with its entry, exit and stop, and why you took it. Execution tracking is only as useful as it is accurate: small gaps in your records turn into wrong conclusions later.',
    note: 'Log it right after the trade, while your reasoning is still fresh.',
    primary: 'next',
    primaryLabel: 'Next',
  },
  [GUIDE_STEP.AI_MENTOR]: {
    target: at('mentor-orb'),
    placement: 'left',
    interactive: false,
    title: 'Feedback that reads your journal',
    body: 'Your AI mentor reads your strategy, your plans and your logged trades, then points out patterns and gives you specific next actions. It unlocks once you’ve logged your first few trades.',
    note: 'Plan, journal, learn. Each loop makes the next one sharper.',
    primary: 'finish',
    primaryLabel: 'Start journaling',
  },
}
