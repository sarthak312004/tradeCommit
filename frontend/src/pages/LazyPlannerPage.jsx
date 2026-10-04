import { lazy, Suspense } from 'react'

const PlannerPage = lazy(() => import('./PlannerPage.jsx'))

function LazyPlannerPage() {
  return (
    <Suspense fallback={null}>
      <PlannerPage />
    </Suspense>
  )
}

export default LazyPlannerPage
