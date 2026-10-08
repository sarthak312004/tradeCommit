import { useCallback, useEffect, useRef, useState } from 'react'
import { isEchoOf } from '../utils/dictation'
import { countTradingTerms } from '../utils/tradingVocabulary'

const getRecognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
const NAV = typeof navigator === 'undefined' ? null : navigator
// Chrome on Android repeats text in continuous mode, so there each phrase is its own session
const IS_ANDROID = Boolean(NAV && /android/i.test(NAV.userAgent))
const IS_MAC = Boolean(NAV && /mac|iphone|ipad/i.test(NAV.platform || NAV.userAgent))

export const SHORTCUT_LABEL = IS_MAC ? '\u2318\u21E7Space' : 'Ctrl+Shift+Space'

const IDLE_STOP_MS = 45_000 // switch the mic off if nothing is said for this long
const MAX_QUICK_RESTARTS = 6 // restarts within QUICK_WINDOW_MS that heard nothing = something is wrong, give up
const QUICK_WINDOW_MS = 4_000

// errors that end dictation; 'no-speech' and 'aborted' are normal and ignored
const FATAL_ERRORS = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser\u2019s site settings and try again.',
  'service-not-allowed': 'Speech recognition is turned off on this device. Enable dictation in your system settings.',
  'audio-capture': 'No microphone was found.',
  network: 'Could not reach the speech service. Check your connection and try again.',
  'language-not-supported': 'This language is not supported for voice input.'
}

// Picks the reading of a phrase to use. Normally the engine's most confident one, but when it offers close
// alternatives, the one containing real trading terms wins ("and gulfing" vs "engulfing").
const bestAlternative = (result) => {
  let top = result[0]
  for (let i = 1; i < result.length; i += 1) if (result[i].confidence > top.confidence) top = result[i]
  let best = top
  let bestHits = countTradingTerms(top.transcript)
  for (let i = 0; i < result.length; i += 1) {
    const alternative = result[i]
    if (alternative === top || (top.confidence > 0 && alternative.confidence < top.confidence - 0.25)) continue
    const hits = countTradingTerms(alternative.transcript)
    if (hits > bestHits) {
      best = alternative
      bestHits = hits
    }
  }
  return best
}

// Noise guards: background sound and breathing can make engines "hear" short junk words
const MIN_CONFIDENCE = 0.5 // engines report 0 when they don't score; those are kept
const MIN_VOICE_LEVEL = 0.03 // microphone level (0..1) that must be reached while a phrase is spoken
const NOISE_WORDS = new Set(['the', 'a', 'uh', 'um', 'hmm', 'mm', 'you', 'and', 'so', 'oh', 'huh', 'i', 'it', 'yeah'])

/**
 * Speech-to-text with the browser's built-in SpeechRecognition (no API key, nothing to install or pay for).
 *
 * - `onInterim(text)`   the phrase still being heard (called many times a second, never triggers a React render)
 * - `onFinalText(text)` a finished phrase
 * - `onCommand(name)`   only used by the caller for things like "stop listening"; handled in parseDictation
 *
 * Keeps listening through the browser's automatic end-of-silence stops until `stop()` is called, switches itself
 * off after a long silence, and exposes a `levelRef` (0..1 microphone loudness) for a live meter.
 */
export function useVoiceDictation({ onFinalText, onInterim, lang } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const flushWaitersRef = useRef([])
  const idleTimerRef = useRef(null)
  const forceStopTimerRef = useRef(null)
  const lastFinalRef = useRef({ text: '', at: 0 })
  const restartsRef = useRef([])
  const levelRef = useRef(0)
  const peakRef = useRef(0) // loudest the microphone got since the last finished phrase
  const meterRef = useRef(null)
  const meterTokenRef = useRef(0)
  const onFinalTextRef = useRef(onFinalText)
  const onInterimRef = useRef(onInterim)
  const isSupported = Boolean(getRecognition())

  useEffect(() => {
    onFinalTextRef.current = onFinalText
    onInterimRef.current = onInterim
  })

  const stopMeter = useCallback(() => {
    meterTokenRef.current += 1 // cancels a meter that is still waiting for microphone permission
    const meter = meterRef.current
    meterRef.current = null
    levelRef.current = 0
    if (!meter) return
    cancelAnimationFrame(meter.frame)
    meter.stream.getTracks().forEach((track) => track.stop())
    meter.context.close().catch(() => {})
  }, [])

  // microphone level for the live meter; purely cosmetic, so any failure is ignored
  const startMeter = useCallback(async () => {
    if (IS_ANDROID || meterRef.current || !NAV?.mediaDevices?.getUserMedia) return
    const token = (meterTokenRef.current += 1)
    try {
      const stream = await NAV.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (token !== meterTokenRef.current || !wantListeningRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const context = new (window.AudioContext ?? window.webkitAudioContext)()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Uint8Array(analyser.fftSize)
      const meter = { stream, context, frame: 0 }
      const tick = () => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i += 1) sum += ((samples[i] - 128) / 128) ** 2
        levelRef.current = Math.min(1, Math.sqrt(sum / samples.length) * 4)
        peakRef.current = Math.max(peakRef.current, levelRef.current)
        meter.frame = requestAnimationFrame(tick)
      }
      meter.frame = requestAnimationFrame(tick)
      meterRef.current = meter
    } catch {
      // no meter; dictation itself still works
    }
  }, [])

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
  }, [])

  // everything that must be true once a session is over, whichever way it ended
  const finishSession = useCallback(
    (recognition) => {
      if (recognition && recognitionRef.current && recognitionRef.current !== recognition) return
      clearIdleTimer()
      clearTimeout(forceStopTimerRef.current)
      stopMeter()
      recognitionRef.current = null
      setInterim('')
      onInterimRef.current?.('')
      setIsListening(false)
      flushWaitersRef.current.splice(0).forEach((resolve) => resolve())
    },
    [clearIdleTimer, stopMeter]
  )

  const stop = useCallback(() => {
    wantListeningRef.current = false
    clearIdleTimer()
    stopMeter() // the mic indicator goes off right away
    setInterim('')
    onInterimRef.current?.('') // so no half-heard grey text is left in the editor
    const recognition = recognitionRef.current
    if (!recognition) {
      setIsListening(false)
      return
    }
    try {
      recognition.stop() // lets the engine deliver the phrase it is still processing
    } catch {
      // already stopped
    }
    // some browsers never fire `end` after stop(); don't leave the button stuck on "Stop"
    clearTimeout(forceStopTimerRef.current)
    forceStopTimerRef.current = setTimeout(() => {
      if (recognitionRef.current !== recognition) return
      try {
        recognition.abort()
      } catch {
        // ignore
      }
      finishSession(recognition)
    }, 1200)
  }, [clearIdleTimer, stopMeter, finishSession])

  const armIdleTimer = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = setTimeout(() => {
      setNotice('Dictation stopped after a long silence.')
      stop()
    }, IDLE_STOP_MS)
  }, [clearIdleTimer, stop])

  const start = useCallback(() => {
    const Recognition = getRecognition()
    if (!Recognition || wantListeningRef.current) return

    // a previous session that is still shutting down must not keep running next to the new one
    const previous = recognitionRef.current
    if (previous) {
      recognitionRef.current = null
      try {
        previous.abort()
      } catch {
        // ignore
      }
    }
    clearTimeout(forceStopTimerRef.current)

    const recognition = new Recognition()
    recognition.lang = lang || NAV?.language || 'en-US'
    recognition.continuous = !IS_ANDROID
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return // result from an abandoned session
      if (wantListeningRef.current) armIdleTimer()
      restartsRef.current = []
      // without a working meter we can't judge loudness, so everything passes
      const heardVoice = !meterRef.current || peakRef.current >= MIN_VOICE_LEVEL
      const stopping = !wantListeningRef.current // the last phrase arriving after stop(); the meter is already off
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) {
          const best = bestAlternative(result)
          const text = best.transcript.trim()
          const last = lastFinalRef.current
          const now = Date.now()
          const unsure = best.confidence > 0 && best.confidence < MIN_CONFIDENCE
          const junk = (!heardVoice && !stopping) || unsure || NOISE_WORDS.has(text.toLowerCase().replace(/[^a-z]/g, ''))
          peakRef.current = 0
          // some engines deliver the same finished phrase twice (even worded slightly differently); ignore the echo
          if (text && !junk && !isEchoOf(text, last.text, now - last.at)) {
            lastFinalRef.current = { text, at: now }
            onFinalTextRef.current?.(text)
          }
        } else if (heardVoice && !stopping) {
          pending += result[0].transcript
        }
      }
      setInterim(pending)
      onInterimRef.current?.(pending)
    }

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return
      if (FATAL_ERRORS[event.error]) {
        wantListeningRef.current = false
        setError(FATAL_ERRORS[event.error])
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return // an abandoned session ending
      setInterim('')
      onInterimRef.current?.('')
      flushWaitersRef.current.splice(0).forEach((resolve) => resolve())

      if (!wantListeningRef.current) {
        finishSession(recognition)
        return
      }

      // browsers end a session after a few seconds of silence; carry on until the user stops it
      const now = Date.now()
      restartsRef.current = [...restartsRef.current.filter((at) => now - at < QUICK_WINDOW_MS), now]
      if (restartsRef.current.length > MAX_QUICK_RESTARTS) {
        setError('Voice input keeps stopping. Check your microphone and try again.')
        wantListeningRef.current = false
        finishSession(recognition)
        return
      }
      const restart = (attempt) => {
        if (!wantListeningRef.current || recognitionRef.current !== recognition) return
        try {
          recognition.start()
        } catch {
          if (attempt < 3) {
            setTimeout(() => restart(attempt + 1), 200)
          } else {
            wantListeningRef.current = false
            finishSession(recognition)
          }
        }
      }
      restart(0)
    }

    setError('')
    setNotice('')
    wantListeningRef.current = true
    recognitionRef.current = recognition
    restartsRef.current = []
    peakRef.current = 0
    try {
      recognition.start()
      setIsListening(true)
      armIdleTimer()
      startMeter()
    } catch {
      wantListeningRef.current = false
      recognitionRef.current = null
    }
  }, [lang, armIdleTimer, startMeter, finishSession])

  const toggle = useCallback(() => (wantListeningRef.current ? stop() : start()), [start, stop])

  // stops and waits for the last phrase to be delivered (used before saving), but never for long
  const stopAndFlush = useCallback(
    () =>
      new Promise((resolve) => {
        if (!recognitionRef.current) return resolve()
        const timer = setTimeout(resolve, 800)
        flushWaitersRef.current.push(() => {
          clearTimeout(timer)
          resolve()
        })
        return stop()
      }),
    [stop]
  )

  useEffect(
    () => () => {
      wantListeningRef.current = false
      clearIdleTimer()
      clearTimeout(forceStopTimerRef.current)
      recognitionRef.current?.abort()
      recognitionRef.current = null
      stopMeter()
    },
    [clearIdleTimer, stopMeter]
  )

  return { isSupported, isListening, interim, error, notice, levelRef, toggle, start, stop, stopAndFlush }
}

/** Global shortcut: Ctrl+Shift+Space (\u2318\u21E7Space on Mac) starts / stops dictation from anywhere in the form. */
export function useDictationShortcut(onToggle, { enabled = true } = {}) {
  const onToggleRef = useRef(onToggle)
  useEffect(() => {
    onToggleRef.current = onToggle
  })

  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event) => {
      if (event.code !== 'Space' || !event.shiftKey || !(IS_MAC ? event.metaKey : event.ctrlKey)) return
      if (event.altKey || event.repeat) return
      event.preventDefault()
      onToggleRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])
}