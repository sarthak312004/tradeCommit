import { useMemo } from 'react'
import { useProfile } from './useProfile'

/**
 * The signed-in user's plan, as the server reports it (GET /auth/profile).
 * `entitlements` is null until the profile has loaded: every limit and lock in the UI reads it from here,
 * never from a hardcoded number. `isPro` is for display only (a badge, a button label); nothing is enforced from it.
 */
export function usePlan() {
  const { profile, entitlements } = useProfile()
  return useMemo(() => {
    const plan = profile?.plan ?? null
    const planState = profile?.planState ?? null
    return { plan, planState, entitlements, isPro: plan === 'pro', loading: entitlements === null }
  }, [profile, entitlements])
}
