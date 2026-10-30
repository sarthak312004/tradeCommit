import { useCallback, useEffect, useRef, useState } from 'react'

const API_SRC = 'https://www.youtube.com/iframe_api'
const API_TIMEOUT_MS = 12000
const VOLUME_KEY = 'tradecommit.music.volume.v1'
const DEFAULT_VOLUME = 60

let apiPromise = null

/** Loads the official YouTube IFrame Player API once per page. Rejects if it is blocked or takes too long, and can be retried. */
export function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('unavailable'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    const script = document.createElement('script')
    let timer = null

    const fail = (error) => {
      clearTimeout(timer)
      apiPromise = null
      script.remove()
      window.onYouTubeIframeAPIReady = previousReady
      reject(error)
    }

    timer = setTimeout(() => fail(new Error('timeout')), API_TIMEOUT_MS)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      previousReady?.()
      resolve(window.YT)
    }
    script.src = API_SRC
    script.async = true
    script.onerror = () => fail(new Error('blocked'))
    document.head.appendChild(script)
  })
  return apiPromise
}

const readVolume = () => {
  try {
    const saved = Number(window.localStorage.getItem(VOLUME_KEY))
    if (Number.isFinite(saved) && saved >= 0 && saved <= 100 && window.localStorage.getItem(VOLUME_KEY) !== null) return saved
  } catch { /* storage unavailable */ }
  return DEFAULT_VOLUME
}

// https://developers.google.com/youtube/iframe_api_reference#onError
const describeError = (code) => {
  if (code === 100) return 'This video or playlist is private or no longer available.'
  if (code === 101 || code === 150) return 'The owner of this video does not allow it to be played in other apps.'
  if (code === 2) return 'YouTube could not read this link. Try replacing it.'
  return 'YouTube could not play this right now. You can open it on YouTube instead.'
}

const STATE_NAMES = { '-1': 'idle', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'idle' }

/**
 * Drives one official YouTube embed through the IFrame Player API with our own compact controls.
 * Nothing autoplays: playback only starts from a click on play, which is what browser autoplay policies expect.
 * Mount it with `key={url}` so a different link gets a fresh player (and fresh loading state).
 *
 * @param {{ videoId?: string, listId?: string }} source  validated ids from parseMusicLink
 * @param {{ current: HTMLElement|null }} containerRef    empty element the player is built in
 */
export function useYouTubePlayer({ videoId, listId }, containerRef) {
  const playerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [playback, setPlayback] = useState('idle') // idle | playing | paused | buffering | ended
  const [error, setError] = useState('')
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const volumeRef = useRef(volume)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    let cancelled = false

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        const mount = document.createElement('div')
        container.replaceChildren(mount)
        const playerVars = { playsinline: 1, rel: 0, controls: 0, modestbranding: 1, origin: window.location.origin }
        if (listId && !videoId) Object.assign(playerVars, { listType: 'playlist', list: listId })
        if (listId && videoId) playerVars.list = listId
        new YT.Player(mount, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          videoId: videoId || undefined,
          playerVars,
          events: {
            onReady: (event) => {
              if (cancelled) return
              playerRef.current = event.target
              event.target.setVolume(volumeRef.current)
              setMuted(Boolean(event.target.isMuted?.()))
              setStatus('ready')
            },
            onStateChange: (event) => {
              if (!cancelled) setPlayback(STATE_NAMES[event.data] ?? 'idle')
            },
            onError: (event) => {
              if (cancelled) return
              setError(describeError(event.data))
              setStatus('error')
            }
          }
        })
      })
      .catch(() => {
        if (cancelled) return
        setError('YouTube could not be loaded. A network setting or browser extension may be blocking it.')
        setStatus('error')
      })

    return () => {
      cancelled = true
      const player = playerRef.current
      playerRef.current = null
      try { player?.destroy() } catch { /* already gone */ }
      container.replaceChildren()
    }
  }, [videoId, listId, containerRef, attempt])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playback === 'playing' || playback === 'buffering') player.pauseVideo()
    else player.playVideo()
  }, [playback])

  const previous = useCallback(() => playerRef.current?.previousVideo(), [])
  const next = useCallback(() => playerRef.current?.nextVideo(), [])

  const setVolume = useCallback((value) => {
    const clamped = Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
    volumeRef.current = clamped
    setVolumeState(clamped)
    const player = playerRef.current
    if (player) {
      player.setVolume(clamped)
      if (clamped > 0 && player.isMuted()) player.unMute()
      setMuted(Boolean(player.isMuted()))
    }
    try { window.localStorage.setItem(VOLUME_KEY, String(clamped)) } catch { /* storage unavailable */ }
  }, [])

  const toggleMute = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.isMuted()) player.unMute()
    else player.mute()
    setMuted(Boolean(player.isMuted()))
  }, [])

  const retry = useCallback(() => {
    setError('')
    setStatus('loading')
    setPlayback('idle')
    setAttempt((value) => value + 1)
  }, [])

  return { status, playback, error, volume, muted, togglePlay, previous, next, setVolume, toggleMute, retry }
}
