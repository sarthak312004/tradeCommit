import { useState } from 'react'
import { errorText } from '../../services/authApi'
import { submitFeedback } from '../../services/feedbackApi'
import { dialogTextareaClass, primaryButtonClass } from '../profile/profileStyles'
import { ErrorText, FieldLabel } from './formParts'
import StarRating, { RATING_WORDS } from './StarRating'

export const MAX_MESSAGE_LENGTH = 1000

const AREAS = [
  { key: 'easeOfUse', label: 'Ease of use', hint: 'How simple is it to find things and get around?' },
  { key: 'ui', label: 'Look & feel', hint: 'How does the design feel to use every day?' },
  { key: 'functionality', label: 'Functionality', hint: 'Does it have what you need, and does it work well?' },
  { key: 'journaling', label: 'Journaling experience', hint: 'How well does it record and reflect your trading?' },
]

/** Overall experience (required), four optional area ratings, and an optional message. */
function FeedbackForm({ isBusy, onBusyChange, onSent }) {
  const [overall, setOverall] = useState(0)
  const [areaRatings, setAreaRatings] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const setAreaRating = (key, value) =>
    setAreaRatings((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key] // cleared: counts as skipped
      return next
    })

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!overall || isBusy) return
    onBusyChange(true)
    setError('')
    try {
      await submitFeedback({ rating: overall, ratings: areaRatings, message: message.trim() })
      onSent()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mt-5 flex flex-col items-center rounded-xl border border-zinc-200 bg-zinc-50/70 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
        <p className="mb-1 text-[13px] font-medium text-zinc-800 dark:text-zinc-100">Overall experience</p>
        <StarRating label="Overall experience" value={overall} onChange={setOverall} disabled={isBusy} />
        <p className="mt-1 h-4 text-xs font-medium text-zinc-600 dark:text-zinc-300" aria-live="polite">
          {overall ? RATING_WORDS[overall - 1] : ''}
        </p>
      </div>

      <div className="mt-4">
        <FieldLabel>
          Rate specific areas <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
        </FieldLabel>
        <div className="divide-y divide-zinc-200 dark:divide-white/[0.08]">
          {AREAS.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{hint}</p>
              </div>
              <StarRating
                label={label}
                size="sm"
                allowClear
                value={areaRatings[key] ?? 0}
                disabled={isBusy}
                onChange={(value) => setAreaRating(key, value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="feedback-message" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Message <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={isBusy}
          placeholder="Ideas, things you love, or anything you'd like us to know…"
          className={dialogTextareaClass}
        />
      </div>

      <ErrorText>{error}</ErrorText>

      <button type="submit" disabled={!overall || isBusy} className={`${primaryButtonClass} mt-4`}>
        {isBusy ? 'Sending…' : 'Send feedback'}
      </button>
      {!overall && <p className="mt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">Rate your overall experience to send.</p>}
    </form>
  )
}

export default FeedbackForm