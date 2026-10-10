import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkText } from '../utils/reviewSpeech'

// Reads a queue of { label, text } chunks aloud with the browser's built-in speech engine (free, no server call).
// Chunks are spoken one utterance at a time, which keeps Chrome from cutting off long text and lets pause,
// speed changes and stop work at any moment.

export const SPEECH_RATES = [0.9, 1, 1.25, 1.5]
const RATE_KEY = 'tradecommit:speech-rate'

const readRate = () => {
  try {
    const saved = Number(window.localStorage.getItem(RATE_KEY))
    return SPEECH_RATES.includes(saved) ? saved : 1
  } catch {
    return 1
  }
}

// The review is written in English, so pick an English voice. Voices that run on the device or are the browser's
// "Natural" neural voices sound smoothest; plain online voices (Google's) are the fallback.
const pickVoice = (synth) => {
  const voices = synth.getVoices()
  if (!voices.length) return null
  const browser = (navigator.language || 'en-US').toLowerCase()
  const target = browser.startsWith('en') ? browser : 'en-us'
  const score = (voice) => {
    const lang = voice.lang.toLowerCase().replace('_', '-')
    if (!lang.startsWith('en')) return -1
    return (lang === target ? 3 : 1) + (voice.localService ? 2 : 0) + (/natural/i.test(voice.name) ? 3 : 0)
  }
  const best = [...voices].sort((a, b) => score(b) - score(a))[0]
  return score(best) > 0 ? best : null
}

// Google's online voices in Chrome stop talking mid-way through long text, so they need short pieces.
const SHORT_CHUNK = 160
const needsShortChunks = (voice) => Boolean(voice) && /google/i.test(voice.name)

// Utterances are handed to the browser one ahead of the one being spoken, so the engine can prepare the next
// sentence while the current one plays. Queuing each one only after the previous finished is what causes gaps.
const LOOKAHEAD = 2

export default function useSpeechSynthesis() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'
  const [status, setStatus] = useState('idle') // 'idle' | 'speaking' | 'paused'
  const [label, setLabel] = useState('')
  const [rate, setRate] = useState(readRate)

  const queue = useRef([])
  const position = useRef(0)
  const token = useRef(0) // bumped on every start / stop, so callbacks from a cancelled run do nothing
  const rateRef = useRef(rate)

  const speakFrom = useCallback((start) => {
    const synth = window.speechSynthesis
    const runToken = ++token.current
    synth.cancel()
    synth.resume() // cancelling while paused can leave some browsers paused

    // one voice for the whole run keeps the reading consistent
    const voice = pickVoice(synth)
    const lastIndex = queue.current.length - 1

    const enqueue = (index) => {
      const item = queue.current[index]
      if (!item || runToken !== token.current) return

      const utterance = new window.SpeechSynthesisUtterance(item.text)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? 'en-US'
      utterance.rate = rateRef.current
      utterance.onstart = () => {
        if (runToken !== token.current) return
        position.current = index
        setLabel(item.label)
        enqueue(index + LOOKAHEAD) // keep the browser's queue a couple of sentences ahead
      }
      utterance.onend = () => {
        if (runToken !== token.current || index !== lastIndex) return
        setStatus('idle')
        setLabel('')
      }
      utterance.onerror = (event) => {
        if (runToken !== token.current || event.error === 'interrupted' || event.error === 'canceled') return
        setStatus('idle')
        setLabel('')
      }
      synth.speak(utterance)
    }

    setStatus('speaking')
    for (let offset = 0; offset < LOOKAHEAD; offset += 1) enqueue(start + offset)
  }, [])

  const speak = useCallback(
    (chunks) => {
      if (!supported || !chunks.length) return
      // re-split into short pieces only when the voice that will be used needs it
      const short = needsShortChunks(pickVoice(window.speechSynthesis))
      queue.current = short ? chunks.flatMap((item) => chunkText(item.text, SHORT_CHUNK).map((text) => ({ label: item.label, text }))) : chunks
      speakFrom(0)
    },
    [supported, speakFrom]
  )

  const pause = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.pause()
    setStatus('paused')
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.resume()
    setStatus('speaking')
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    token.current += 1
    window.speechSynthesis.cancel()
    setStatus('idle')
    setLabel('')
  }, [supported])

  // next speed; if something is being read, carry on from the current chunk at the new speed
  const cycleRate = useCallback(() => {
    const next = SPEECH_RATES[(SPEECH_RATES.indexOf(rateRef.current) + 1) % SPEECH_RATES.length]
    rateRef.current = next
    setRate(next)
    try {
      window.localStorage.setItem(RATE_KEY, String(next))
    } catch {
      // storage unavailable: the speed just isn't remembered
    }
    if (status !== 'idle') speakFrom(position.current)
  }, [status, speakFrom])

  // never keep talking after the review is closed or the page is left
  useEffect(() => {
    if (!supported) return undefined
    const runs = token
    const silence = () => {
      runs.current += 1
      window.speechSynthesis.cancel()
    }
    window.addEventListener('pagehide', silence)
    return () => {
      window.removeEventListener('pagehide', silence)
      silence()
    }
  }, [supported])

  return { supported, status, label, rate, speak, pause, resume, stop, cycleRate }
}
