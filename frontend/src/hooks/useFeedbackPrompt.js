import { useCallback, useEffect, useState } from 'react'
import { dismissFeedbackPrompt, getFeedbackStatus } from '../services/feedbackApi'

// Keep in step with FEEDBACK_PROMPT_AFTER_TRADES on the backend (which makes the real decision).
export const PROMPT_AFTER_TRADES = 10
const SHOW_DELAY_MS = 1500 // let the "trade saved" moment land before a dialog appears

// Module-level so the answer survives the sidebar re-mounting.
let promptHandled = false

/**
 * Opens the feedback popup once, automatically, after the user has logged their first 10 trades.
 * `tradeCount` is the number of trades across all journals; the server decides whether to show it
 * and remembers when it was answered or dismissed.
 */
export function useFeedbackPrompt(tradeCount) {
  const [isPromptOpen, setIsPromptOpen] = useState(false)

  useEffect(() => {
    if (promptHandled || tradeCount < PROMPT_AFTER_TRADES) return undefined

    let cancelled = false
    let timer
    getFeedbackStatus()
      .then((status) => {
        if (cancelled) return
        if (status.handled) promptHandled = true
        else if (status.shouldPrompt) timer = setTimeout(() => setIsPromptOpen(true), SHOW_DELAY_MS)
      })
      .catch(() => {
        /* the popup is a nicety: stay quiet if the check fails */
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tradeCount])

  // closing the popup (sent or not) counts as handled: it must not come back
  const closePrompt = useCallback(() => {
    promptHandled = true
    setIsPromptOpen(false)
    dismissFeedbackPrompt().catch(() => {})
  }, [])

  return { isPromptOpen, closePrompt }
}