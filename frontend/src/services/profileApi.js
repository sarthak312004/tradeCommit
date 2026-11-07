import { readJson, requestJson } from '../utils/http'
import { getGuideState, hydrateGuideState, moveGuideState } from '../utils/onboardingGuide'
import {
  getDemoFlywheelState,
  hydrateDemoFlywheelState,
  isDemoFlywheelRunnable,
  moveDemoFlywheelState,
} from '../utils/demoFlywheel'

const BASE = '/api/v1/auth'
const post = (path, body = {}) => requestJson(`${BASE}${path}`, { method: 'POST', body })

// The profile never changes while the page is open, so every header (one per page) shares one request.
let cachedProfile = null
let onboardingGuideQueue = Promise.resolve()
let plannerWalkthroughQueue = Promise.resolve()
let demoFlywheelQueue = Promise.resolve()
export const PROFILE_UPDATED_EVENT = 'profile-updated'

const hydrateDemoFlywheel = async (profile) => {
  if (!profile?.username || !profile?.demoFlywheel) return profile
  const serverDemo = profile.demoFlywheel
  const localDemo = getDemoFlywheelState(profile.username)
  const serverTimestamp = Date.parse(serverDemo?.updatedAt ?? '') || 0

  if (
    isDemoFlywheelRunnable(serverDemo)
    && localDemo
    && localDemo.status !== 'pending'
    && localDemo.updatedAt > serverTimestamp
  ) {
    try {
      const saved = await requestJson(`${BASE}/onboarding/demo-flywheel`, {
        method: 'PATCH',
        body: { status: localDemo.status, step: localDemo.step },
      })
      profile = { ...profile, demoFlywheel: saved.demoFlywheel }
    } catch (error) {
      console.error('Could not sync saved flywheel demo progress:', error)
      return profile
    }
  }

  hydrateDemoFlywheelState(profile.username, profile.demoFlywheel)
  return profile
}

const hydrateProfile = async (profile) => {
  if (!profile?.username) return profile
  profile = await hydrateDemoFlywheel(profile)
  const serverGuide = profile?.onboardingGuide
  const localGuide = getGuideState(profile.username)
  if (!serverGuide && !localGuide) return profile

  const restoredFromLocal = !serverGuide && Boolean(localGuide)
  if (!serverGuide && localGuide) {
    try {
      const restored = await requestJson(`${BASE}/onboarding/guide`, {
        method: 'PATCH',
        body: { status: localGuide.status, step: localGuide.step },
      })
      profile = { ...profile, onboardingGuide: restored.onboardingGuide }
    } catch (error) {
      console.error('Could not restore saved onboarding guide progress:', error)
      return profile
    }
  }

  const activeGuide = profile.onboardingGuide
  const serverTimestamp = Date.parse(activeGuide?.updatedAt ?? '') || 0
  if (!restoredFromLocal && localGuide && activeGuide && localGuide.updatedAt > serverTimestamp) {
    try {
      const saved = await requestJson(`${BASE}/onboarding/guide`, {
        method: 'PATCH',
        body: { status: localGuide.status, step: localGuide.step },
      })
      profile = { ...profile, onboardingGuide: saved.onboardingGuide }
    } catch (error) {
      console.error('Could not sync saved onboarding guide progress:', error)
      return profile
    }
  }

  hydrateGuideState(profile.username, profile.onboardingGuide)
  return profile
}

export const getProfile = () => {
  cachedProfile ??= requestJson(`${BASE}/profile`)
    .then(hydrateProfile)
    .catch((error) => {
      cachedProfile = null // let the next call retry
      throw error
    })
  return cachedProfile
}

export const clearProfileCache = () => {
  cachedProfile = null
}

const publishProfileUpdate = (patch) => {
  if (cachedProfile) {
    cachedProfile = Promise.resolve(cachedProfile)
      .then((profile) => ({ ...profile, ...patch }))
      .catch((error) => {
        cachedProfile = null
        throw error
      })
  }
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
}

/** Re-fetches profile-owned onboarding progress after a successful Planner, Journal or Mentor action. */
export const refreshProfile = () => {
  clearProfileCache()
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
}

export const saveOnboardingGuideState = async ({ status, step }) => {
  const request = onboardingGuideQueue.then(() => requestJson(`${BASE}/onboarding/guide`, {
    method: 'PATCH',
    body: { status, step },
  }))
  onboardingGuideQueue = request.catch(() => {})
  const saved = await request
  publishProfileUpdate({ onboardingGuide: saved.onboardingGuide })
  return saved.onboardingGuide
}

export const savePlannerWalkthroughState = async ({ plannerId, status, step }) => {
  const request = plannerWalkthroughQueue.then(() => requestJson(`${BASE}/onboarding/planner-walkthrough`, {
    method: 'PATCH',
    body: { plannerId, status, step },
  }))
  plannerWalkthroughQueue = request.catch(() => {})
  const saved = await request
  publishProfileUpdate({ plannerWalkthrough: saved.plannerWalkthrough })
  return saved.plannerWalkthrough
}

export const saveDemoFlywheelState = async ({ status, step }) => {
  const request = demoFlywheelQueue.then(() => requestJson(`${BASE}/onboarding/demo-flywheel`, {
    method: 'PATCH',
    body: { status, step },
  }))
  demoFlywheelQueue = request.catch(() => {})
  const saved = await request
  publishProfileUpdate({ demoFlywheel: saved.demoFlywheel })
  return saved.demoFlywheel
}

/** Saves the name and/or username (sign-up no longer asks for them). Resolves to `{ fullname, username }`. */
export const updateProfile = async (changes) => {
  const previous = cachedProfile ? await Promise.resolve(cachedProfile).catch(() => null) : null
  const saved = await requestJson(`${BASE}/profile`, { method: 'PATCH', body: changes })
  if (previous?.username) {
    moveGuideState(previous.username, saved.username)
    moveDemoFlywheelState(previous.username, saved.username)
  }
  cachedProfile = Promise.resolve({ ...(previous ?? {}), ...saved })
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT)) // every mounted profile hook re-reads the cache
  return saved
}

// A passwordless account that just chose a password has one from now on; no reload needed to see it.
const markPasswordSet = async () => {
  const previous = cachedProfile ? await Promise.resolve(cachedProfile).catch(() => null) : null
  if (!previous || previous.hasPassword) return
  cachedProfile = Promise.resolve({ ...previous, hasPassword: true })
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
}

/** The three password-change steps. Each one resolves to the server's `data` object. */
export const passwordApi = {
  sendCode: () => post('/password/send-otp'), // { email, sent, retryAfter }
  verifyCode: (otp) => post('/password/verify-otp', { otp }), // { resetToken }
  setPassword: async (resetToken, newPassword) => {
    const data = await post('/password/reset', { resetToken, newPassword })
    markPasswordSet() // the profile card switches from "Set a password" to "Reset password" right away
    return data
  },
}


/** The picture behind the page header. Both calls resolve to `{ headerBackdrop: { mode, scene, imageUrl } }`. */
export const headerBackdropApi = {
  save: (backdrop) => requestJson(`${BASE}/header-backdrop`, { method: 'PUT', body: backdrop }), // { mode: 'none' } or { mode: 'scene', scene }
  uploadImage: async (blob) => {
    const form = new FormData()
    form.append('image', blob, 'header.jpg')
    return readJson(await fetch(`${BASE}/header-backdrop/image`, { method: 'POST', credentials: 'include', body: form }))
  },
}

/** Playlist and focus palette preferences follow the signed-in account across sessions. */
export const saveFocusPreferences = async (preferences) => {
  const response = await requestJson(`${BASE}/focus-preferences`, { method: 'PUT', body: preferences })
  if (
    typeof response?.focusPreferences?.spotifyUrl !== 'string' ||
    !['sage', 'ocean', 'amber'].includes(response.focusPreferences.focusTheme)
  ) {
    throw new Error('The server returned an invalid focus preference response.')
  }
  if (cachedProfile) {
    cachedProfile = Promise.resolve(cachedProfile)
      .then((profile) => ({ ...profile, focusPreferences: response.focusPreferences }))
      .catch((error) => {
        cachedProfile = null
        throw error
      })
  }
  return response.focusPreferences
}
