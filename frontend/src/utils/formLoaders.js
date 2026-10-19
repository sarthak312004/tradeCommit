// The trade form and the plan form are code-split (they carry the rich text editor), so the first click can wait
// for a download. Pages warm these modules as soon as they mount and the buttons warm them on pointer/focus.
// `lazy()` uses the same loaders, so it reuses the module already being fetched or evaluated.

export const loadTradeForm = () => import('../components/rightContainer/journal/TradeForm')
export const loadPlanForm = () => import('../components/rightContainer/planner/PlanForm')

// a failed warm-up must never surface as an error: the real click retries the import
export const preloadTradeForm = () => {
  loadTradeForm().catch(() => {})
}
export const preloadPlanForm = () => {
  loadPlanForm().catch(() => {})
}
