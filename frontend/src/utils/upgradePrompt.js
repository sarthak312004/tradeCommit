// The upgrade prompts in locked sections ask for the upgrade by event, so they do not need to know where billing lives.
// The billing screen (added with the payments work) listens for this event and opens itself.
export const UPGRADE_REQUESTED_EVENT = 'upgrade-requested'

/** `feature` is the metric id (or other entitlement key) the person ran into. */
export const requestUpgrade = (feature) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(UPGRADE_REQUESTED_EVENT, { detail: { feature } }))
}
