export const ONBOARDING_WORKFLOW_STAGES = Object.freeze([
  {
    id: 'plan',
    label: 'PLAN',
    requiredActions: [
      { id: 'plan_created', label: 'Save a plan' },
      { id: 'planner_connected', label: 'Connect Planner to a journal' },
    ],
  },
  {
    id: 'journal',
    label: 'JOURNAL',
    requiredActions: [
      { id: 'journal_created', label: 'Create a journal' },
      { id: 'journal_context_saved', label: 'Save journal context' },
      { id: 'trade_logged', label: 'Log a trade' },
    ],
  },
  {
    id: 'feedback',
    label: 'FEEDBACK',
    requiredActions: [
      { id: 'mentor_review_created', label: 'Save a Mentor review' },
    ],
  },
])

export const ONBOARDING_WORKFLOW_ACTION_COUNT = ONBOARDING_WORKFLOW_STAGES
  .flatMap((stage) => stage.requiredActions)
  .length

export const getOnboardingWorkflowProgress = (state) => {
  const actions = new Set(Array.isArray(state?.actions) ? state.actions : [])
  const stages = ONBOARDING_WORKFLOW_STAGES.map((stage) => ({
    ...stage,
    requiredActions: stage.requiredActions.map((action) => ({
      ...action,
      completed: actions.has(action.id),
    })),
    completed: stage.requiredActions.every((action) => actions.has(action.id)),
  }))
  const completedActions = ONBOARDING_WORKFLOW_STAGES
    .flatMap((stage) => stage.requiredActions)
    .filter((action) => actions.has(action.id)).length
  const isComplete = Boolean(state?.workflowCompletedAt) || completedActions === ONBOARDING_WORKFLOW_ACTION_COUNT

  return {
    stages,
    completed: completedActions,
    total: ONBOARDING_WORKFLOW_ACTION_COUNT,
    fraction: completedActions / ONBOARDING_WORKFLOW_ACTION_COUNT,
    completedStages: stages.filter((stage) => stage.completed).length,
    currentStage: stages.find((stage) => !stage.completed)?.id ?? null,
    isComplete,
    visible: Boolean(state) && !isComplete,
  }
}
