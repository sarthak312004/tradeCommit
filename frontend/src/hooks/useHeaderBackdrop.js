import { useEffect, useSyncExternalStore } from 'react'
import { clearProfileCache, getProfile, headerBackdropApi } from '../services/profileApi'
import { HEADER_SCENES } from '../components/rightContainer/header/headerSceneData'
import { fileToHeaderImage } from '../utils/headerImage'
import { preloadImage } from '../utils/imageUpload'

// The header backdrop (a calm SVG scene or the user's own picture) lives on the user's account, so it follows them
// to every device. One shared store feeds every page header: it loads with the profile and updates optimistically.
const NONE = { mode: 'none', scene: null, image: null }
const SCENE_IDS = new Set(HEADER_SCENES.map((scene) => scene.id))

let state = NONE
let status = 'idle' // idle | loading | loaded
let version = 0 // bumped by every user action, so a slow reply never overwrites a newer choice
const listeners = new Set()

const setState = (next) => {
  state = next
  listeners.forEach((listener) => listener())
}

// the server sends { mode, scene, imageUrl }; anything unexpected becomes "no backdrop"
const fromServer = (saved) => {
  if (saved?.mode === 'scene' && SCENE_IDS.has(saved.scene)) return { mode: 'scene', scene: saved.scene, image: null }
  if (saved?.mode === 'image' && typeof saved.imageUrl === 'string' && saved.imageUrl) return { mode: 'image', scene: null, image: saved.imageUrl }
  return NONE
}

const load = () => {
  if (status !== 'idle') return
  status = 'loading'
  const startedAt = version
  getProfile()
    .then((profile) => {
      if (version === startedAt) setState(fromServer(profile?.headerBackdrop)) // the user may already have picked something
    })
    .catch(() => {
      // offline or signed out: no backdrop for now
    })
    .finally(() => {
      status = 'loaded'
    })
}

// a different account logging in on this tab must not see the previous account's backdrop
if (typeof window !== 'undefined') {
  window.addEventListener('auth-state-changed', () => {
    clearProfileCache()
    version += 1
    status = 'idle'
    setState(NONE)
    if (listeners.size > 0) load()
  })
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Saves a scene / "none": shows it at once, puts the old one back if the server says no. Resolves to an error text ('' = saved).
const save = async (next, body) => {
  const previous = state
  const mine = ++version
  setState(next)
  try {
    await headerBackdropApi.save(body)
    return ''
  } catch (error) {
    if (version === mine) setState(previous)
    return error.message || 'Could not save your header background.'
  }
}

const chooseScene = (scene) => (SCENE_IDS.has(scene) ? save({ mode: 'scene', scene, image: null }, { mode: 'scene', scene }) : Promise.resolve('Unknown scene.'))

const clear = () => save(NONE, { mode: 'none' })

// Shrinks the picture, shows it immediately, uploads it, then swaps in the hosted URL. Resolves to an error text ('' = saved).
const uploadImage = async (file) => {
  let blob
  try {
    blob = await fileToHeaderImage(file)
  } catch (error) {
    return error.message
  }

  const previous = state
  const mine = ++version
  const preview = URL.createObjectURL(blob)
  setState({ mode: 'image', scene: null, image: preview })
  try {
    const data = await headerBackdropApi.uploadImage(blob)
    const hosted = fromServer(data?.headerBackdrop)
    if (version === mine) {
      if (hosted.image) await preloadImage(hosted.image) // no flicker when the preview is swapped for the hosted file
      if (version === mine) setState(hosted)
    }
    return ''
  } catch (error) {
    if (version === mine) setState(previous)
    return error.message || 'Could not upload that picture.'
  } finally {
    URL.revokeObjectURL(preview)
  }
}

export function useHeaderBackdrop() {
  const backdrop = useSyncExternalStore(subscribe, () => state, () => NONE)
  useEffect(load, [])
  return { backdrop, chooseScene, clear, uploadImage }
}
