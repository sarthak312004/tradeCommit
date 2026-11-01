// The scene list for "The Trading Loop". Pure data: edit copy here, not in the components.
//
//   kind: 'intro' | 'stage' | 'loop'
//   stage: id of the loop node this scene highlights (stage scenes only)
//   Component: OPTIONAL. A scene that sets it renders that component instead of the default copy layout.
//              Part 2 uses it for the interactive sandbox scenes (./sandbox). Their demo state is in-memory only.
//              The component receives { scene, goNext, goBack }.

import StrategyScene from './sandbox/StrategyScene'
import PlannerScene from './sandbox/PlannerScene'
import CompareScene from './sandbox/CompareScene'
import MentorScene from './sandbox/MentorScene'
import ImprovementScene from './sandbox/ImprovementScene'

export const OPENING_MESSAGE = ['You’re not here just to record trades.', 'You’re here to build a repeatable trading process.']

export { STAGES } from './stages'

export const SCENES = [
  {
    id: 'welcome',
    kind: 'intro',
    label: 'Welcome',
    eyebrow: 'TradeCommit: The Trading Loop',
    title: OPENING_MESSAGE,
    body: 'Four connected stages turn individual trades into a process you can improve. Here is how they fit together.',
    primary: 'Show me the loop',
  },
  {
    id: 'strategy',
    kind: 'stage',
    stage: 'strategy',
    label: 'Strategy',
    Component: StrategyScene,
    eyebrow: 'Stage 1 of 4',
    title: 'Strategy: define your trading rules',
    body: 'Everything else is measured against your rules, so they come first. Decide what you trade and what you do not, before the market is moving.',
    points: ['The setups you trade and what must be true to enter', 'Where a trade is wrong, and how much you risk', 'The conditions you will sit out'],
    note: 'In the app: your journal’s Context.',
  },
  {
    id: 'planner',
    kind: 'stage',
    stage: 'planner',
    label: 'Planner',
    Component: PlannerScene,
    eyebrow: 'Stage 2 of 4',
    title: 'Planner: plan before you trade',
    body: 'Turn your rules into a plan for the session ahead. A plan written beforehand is the baseline your actual trades get compared with.',
    points: ['Setups and key levels for upcoming sessions', 'Dated plans you can link to your journal', 'Notes you write while you are calm, not in the trade'],
    note: 'In the app: Trade planners in the sidebar.',
  },
  {
    id: 'journal',
    kind: 'stage',
    stage: 'journal',
    label: 'Plan vs journal',
    Component: CompareScene,
    eyebrow: 'Stage 3 of 4',
    title: 'Journal: what you planned vs what you did',
    body: 'Log each trade as it really happened, including the reason behind it. The gap between the plan and the execution is where the learning is.',
    points: ['Entries, exits and results, as taken', 'The reasoning behind each decision', 'Live and backtest trades kept separate'],
    note: 'In the app: your trade journal.',
  },
  {
    id: 'mentor',
    kind: 'stage',
    stage: 'mentor',
    label: 'AI Mentor',
    Component: MentorScene,
    eyebrow: 'Stage 4 of 4',
    title: 'AI Mentor: find the mistakes that repeat',
    body: 'The mentor reads your rules, your plans and your logged trades together, and points out patterns you are too close to see.',
    points: ['Execution compared with your own rules', 'Recurring mistakes, not one-off noise', 'Specific changes to bring back into your strategy'],
    note: 'In your account, the mentor starts once you have logged 5 trades. The feedback above is a demo.',
  },
  {
    id: 'loop',
    kind: 'loop',
    label: 'The loop',
    Component: ImprovementScene,
    eyebrow: 'Continuous improvement',
    title: 'A loop, not a list',
    body: 'What the mentor finds goes back into your Strategy. Better rules make a better plan, a better plan makes cleaner execution, and the cycle tightens with every trade.',
    primary: 'Start with my first journal',
  },
]
