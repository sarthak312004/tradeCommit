import { useState } from 'react'
import { errorText } from '../../services/authApi'
import { submitBugReport } from '../../services/feedbackApi'
import { dialogInputClass, dialogTextareaClass, focusRing, primaryButtonClass } from '../profile/profileStyles'
import { ErrorText, FieldLabel } from './formParts'

const MAX_TITLE = 100
const MAX_DESCRIPTION = 2000
const MAX_STEPS = 1000
const MIN_TITLE = 3
const MIN_DESCRIPTION = 10

const SEVERITIES = [
  { value: 'minor', label: 'Minor', hint: 'Small annoyance or visual glitch' },
  { value: 'major', label: 'Major', hint: 'Something important is not working' },
  { value: 'critical', label: 'Critical', hint: "I can't use TradeCommit properly" },
]

/** Title, what happened, optional steps to reproduce, and how serious it is. */
function BugReportForm({ isBusy, onBusyChange, onSent }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [error, setError] = useState('')

  const canSend = title.trim().length >= MIN_TITLE && description.trim().length >= MIN_DESCRIPTION

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSend || isBusy) return
    onBusyChange(true)
    setError('')
    try {
      await submitBugReport({
        title: title.trim(),
        description: description.trim(),
        steps: steps.trim(),
        severity,
        page: window.location.pathname,
      })
      onSent()
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      onBusyChange(false)
    }
  }

  const severityHint = SEVERITIES.find((option) => option.value === severity)?.hint

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5">
      <FieldLabel htmlFor="bug-title">Title</FieldLabel>
      <input
        id="bug-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={MAX_TITLE}
        disabled={isBusy}
        placeholder="e.g. Equity curve doesn't update after editing a trade"
        className={dialogInputClass}
      />

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="bug-description" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            What happened?
          </label>
          <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
        <textarea
          id="bug-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={MAX_DESCRIPTION}
          disabled={isBusy}
          placeholder="What did you expect, and what happened instead?"
          className={dialogTextareaClass}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="bug-steps" className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Steps to reproduce <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {steps.length}/{MAX_STEPS}
          </span>
        </div>
        <textarea
          id="bug-steps"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          maxLength={MAX_STEPS}
          disabled={isBusy}
          placeholder={'1. Open a journal\n2. Edit a trade\n3. …'}
          className={`${dialogTextareaClass} min-h-[72px]`}
        />
      </div>

      <div className="mt-4">
        <FieldLabel>How serious is it?</FieldLabel>
        <div role="radiogroup" aria-label="Severity" className="flex gap-0.5 rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.06]">
          {SEVERITIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={severity === value}
              disabled={isBusy}
              onClick={() => setSeverity(value)}
              className={`h-8 flex-1 cursor-pointer rounded-md text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${focusRing} ${
                severity === value
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">{severityHint}</p>
      </div>

      <ErrorText>{error}</ErrorText>

      <button type="submit" disabled={!canSend || isBusy} className={`${primaryButtonClass} mt-4`}>
        {isBusy ? 'Sending…' : 'Send report'}
      </button>
    </form>
  )
}

export default BugReportForm