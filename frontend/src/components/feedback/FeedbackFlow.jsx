import { useState } from 'react'
import { errorText } from '../../services/authApi'
import { submitFeedback } from '../../services/feedbackApi'
import { dialogTextareaClass } from '../profile/profileStyles'
import { ErrorText, ProgressBars, StepHeading, StepNav, stepEnter } from './formParts'
import StarRating from './StarRating'
import { RATING_WORDS } from './ratingWords'

export const MAX_MESSAGE_LENGTH = 1000

// One question per step. The overall rating is required; the four area ratings can be skipped.
const RATING_STEPS = [
  { key: 'overall', eyebrow: 'Overall', title: 'How is TradeCommit working for you?', help: 'A quick rating of your overall experience.' },
  { key: 'easeOfUse', eyebrow: 'Ease of use', title: 'How easy is it to use?', help: 'Finding things, getting around, doing what you came to do.' },
  { key: 'ui', eyebrow: 'Look & feel', title: 'How does it look and feel?', help: 'The design, the spacing, the way it feels day to day.' },
  { key: 'functionality', eyebrow: 'Functionality', title: 'Does it do what you need?', help: 'Whether the features you need are here, and work well.' },
  { key: 'journaling', eyebrow: 'Journaling', title: 'How well does it journal for you?', help: 'How well it records and reflects your trading decisions.' },
]
const MESSAGE_STEP = RATING_STEPS.length
const TOTAL_STEPS = RATING_STEPS.length + 1

/** Onboarding-style feedback: one question at a time, then an optional message. */
function FeedbackFlow({ isBusy, onBusyChange, onSent, isAutoPrompt }) {
  const [step, setStep] = useState(0)
  const [ratings, setRatings] = useState({}) // { overall, easeOfUse, ui, functionality, journaling }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const setRating = (key, value) => setRatings((prev) => ({ ...prev, [key]: value }))
  const next = () => setStep((current) => Math.min(current + 1, MESSAGE_STEP))
  const back = () => setStep((current) => Math.max(current - 1, 0))

  const send = async () => {
    if (!ratings.overall || isBusy) return
    const { overall, ...areaRatings } = ratings
    const chosenAreas = Object.fromEntries(Object.entries(areaRatings).filter(([, value]) => value))
    onBusyChange(true)
    setError('')
    try {
      await submitFeedback({ rating: overall, ratings: chosenAreas, message: message.trim() })
      onSent()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      onBusyChange(false)
    }
  }

  const ratingStep = RATING_STEPS[step]

  return (
    <div>
      <ProgressBars total={TOTAL_STEPS} current={step} />

      <div key={step} className={`mt-8 ${stepEnter}`}>
        {ratingStep ? (
          <>
            <StepHeading
              eyebrow={step === 0 && isAutoPrompt ? "10 trades logged · Overall" : `${step + 1} / ${TOTAL_STEPS} · ${ratingStep.eyebrow}`}
              title={ratingStep.title}
            >
              {step === 0 && isAutoPrompt ? "You've logged your first 10 trades. How is it going so far?" : ratingStep.help}
            </StepHeading>

            <div className="mt-7 flex flex-col items-center rounded-xl border border-zinc-200 bg-zinc-50/70 py-7 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <StarRating
                label={ratingStep.eyebrow}
                size="xl"
                allowClear={step > 0}
                value={ratings[ratingStep.key] ?? 0}
                onChange={(value) => setRating(ratingStep.key, value)}
                disabled={isBusy}
              />
              <p className="mt-2 h-4 text-xs font-medium text-zinc-600 dark:text-zinc-300" aria-live="polite">
                {ratings[ratingStep.key] ? RATING_WORDS[ratings[ratingStep.key] - 1] : ''}
              </p>
            </div>

            <StepNav
              onBack={step > 0 ? back : undefined}
              onSkip={step > 0 ? next : undefined}
              onNext={next}
              nextDisabled={!ratings[ratingStep.key]}
            />
          </>
        ) : (
          <>
            <StepHeading eyebrow={`${TOTAL_STEPS} / ${TOTAL_STEPS} · Anything else?`} title="Anything you'd like to add?">
              Ideas, things you love, or things that got in your way. Optional.
            </StepHeading>

            <div className="mt-7">
              <textarea
                autoFocus
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={isBusy}
                aria-label="Message"
                placeholder="Write anything on your mind…"
                className={`${dialogTextareaClass} min-h-[120px]`}
              />
              <p className="mt-1.5 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </p>
            </div>

            <ErrorText>{error}</ErrorText>
            <StepNav onBack={back} onNext={send} nextLabel={isBusy ? 'Sending…' : 'Send feedback'} isBusy={isBusy} />
          </>
        )}
      </div>
    </div>
  )
}

export default FeedbackFlow
