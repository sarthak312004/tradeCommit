import { requestJson } from '../utils/http'

const BASE = '/api/v1/feedback'

/** rating: overall 1-5; ratings: optional { easeOfUse, ui, functionality, journaling } (each 1-5); message: optional text. */
export const submitFeedback = ({ rating, ratings, message }) =>
  requestJson(BASE, { method: 'POST', body: { rating, ratings, message } })

/** severity: 'minor' | 'major' | 'critical'; page is the path the user was on. */
export const submitBugReport = ({ title, description, steps, severity, page }) =>
  requestJson(`${BASE}/bug`, { method: 'POST', body: { title, description, steps, severity, page } })

/** Resolves to { handled, shouldPrompt }: whether the automatic popup should show now. */
export const getFeedbackStatus = () => requestJson(`${BASE}/status`)

/** Marks the automatic popup as dealt with so it never shows again. */
export const dismissFeedbackPrompt = () => requestJson(`${BASE}/dismiss`, { method: 'POST', body: {} })
