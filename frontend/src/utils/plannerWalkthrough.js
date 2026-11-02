export const PLANNER_WALKTHROUGH_STEPS = Object.freeze([
  'connection',
  'open-plan',
  'deep-mode',
  'quick-plan',
  'full-editor',
])

export const PLANNER_WALKTHROUGH_INTERACTION_EVENT = 'tradecommit:planner-walkthrough-interaction'

export const isPlannerWalkthroughRunnable = (state, plannerId) => (
  state?.plannerId === plannerId
  && (state.status === 'pending' || state.status === 'in_progress')
)

export const getNextPlannerWalkthroughStep = (step) => (
  PLANNER_WALKTHROUGH_STEPS[PLANNER_WALKTHROUGH_STEPS.indexOf(step) + 1] ?? null
)
