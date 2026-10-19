// The trade form and the plan form are code-split (they carry the rich text editor), so the very first click on
// "Add trade" / "Plan today" used to wait for a download. These helpers fetch that code ahead of time:
//   - when the browser is idle after the page shows up
//   - the moment the pointer reaches (or the keyboard focuses) the button that opens the form
// `lazy()` in the pages uses the very same loaders, so the click finds the code already evaluated.

export const loadTradeForm = () => import('../components/rightContainer/journal/TradeForm')
export const loadPlanForm = () => import('../components/rightContainer/planner/PlanForm')

// a failed warm-up must never surface as an error: the real click retries the import
export const preloadTradeForm = () => {
  loadTradeForm().catch(() => {})
}
export const preloadPlanForm = () => {
  loadPlanForm().catch(() => {})
}

/** Runs `task` once the browser is idle (at the latest after `timeout` ms). Returns a cancel function. */
export const runWhenIdle = (task, timeout = 1500) => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(task, { timeout })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = setTimeout(task, 800)
  return () => clearTimeout(handle)
}
