import { useState } from 'react'
import { errorText } from '../../services/authApi'
import { submitBugReport } from '../../services/feedbackApi'
import { dialogInputClass, dialogTextareaClass } from '../profile/profileStyles'
import { ErrorText, ProgressBars, StepHeading, StepNav, stepEnter } from './formParts'

const MAX_TITLE = 100
const MAX_DESCRIPTION = 2000
const MAX_STEPS = 1000
const MIN_TITLE = 3
const MIN_DESCRIPTION = 10
const TOTAL_STEPS = 3

const SEVERITIES = [
  { value: 'minor', label: 'Minor', description: 'A small annoyance or visual glitch.' },
  { value: 'major', label: 'Major', description: 'Something important is not working.' },
  { value: 'critical', label: 'Critical', description: "I can't use TradeCommit properly." },
]

/** Onboarding-style bug report: what went wrong -> how to reproduce it -> how serious it is. */
function BugReportFlow({ isBusy, onBusyChange, onSent }) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [severity, setSeverity] = useState('minor')
  const [error, setError] = useState('')

  const canContinue = title.trim().length >= MIN_TITLE && description.trim().length >= MIN_DESCRIPTION
  const next = () => setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1))
  const back = () => setStep((current) => Math.max(current - 1, 0))

  const send = async () => {
    if (!canContinue || isBusy) return
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

  return (
    <div>
      <ProgressBars total={TOTAL_STEPS} current={step} />

      <div key={step} className={`mt-8 ${stepEnter}`}>
        {step === 0 && (
          <>
            <StepHeading eyebrow={`1 / ${TOTAL_STEPS} · Report a bug`} title="What went wrong?">
              A short title, then what you expected and what happened instead.
            </StepHeading>
            <div className="mt-7 space-y-3">
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={MAX_TITLE}
                aria-label="Bug title"
                placeholder="Short title, e.g. Equity curve doesn't update"
                className={dialogInputClass}
              />
              <div>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={MAX_DESCRIPTION}
                  aria-label="What happened"
                  placeholder="What did you expect, and what happened instead?"
                  className={`${dialogTextareaClass} min-h-[120px]`}
                />
                <p className="mt-1.5 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {description.length}/{MAX_DESCRIPTION}
                </p>
              </div>
            </div>
            <StepNav onNext={next} nextDisabled={!canContinue} />
          </>
        )}

        {step === 1 && (
          <>
            <StepHeading eyebrow={`2 / ${TOTAL_STEPS} · Steps`} title="How can we reproduce it?">
              List the steps that lead to the problem. Optional, but it helps a lot.
            </StepHeading>
            <div className="mt-7">
              <textarea
                autoFocus
                value={steps}
                onChange={(event) => setSteps(event.target.value)}
                maxLength={MAX_STEPS}
                aria-label="Steps to reproduce"
                placeholder={'1. Open a journal\n2. Edit a trade\n3. …'}
                className={`${dialogTextareaClass} min-h-[140px]`}
              />
              <p className="mt-1.5 text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                {steps.length}/{MAX_STEPS}
              </p>
            </div>
            <StepNav onBack={back} onSkip={next} onNext={next} />
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading eyebrow={`3 / ${TOTAL_STEPS} · Severity`} title="How serious is it?">
              This helps us decide what to fix first.
            </StepHeading>
            <div className="mt-7 grid gap-2.5" role="radiogroup" aria-label="Severity">
              {SEVERITIES.map((item) => {
                const active = severity === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isBusy}
                    onClick={() => setSeverity(item.value)}
                    className={`flex w-full cursor-pointer items-center gap-4 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed ${
                      active
                        ? 'border-zinc-700 bg-white shadow-card dark:border-zinc-400 dark:bg-panel'
                        : 'border-zinc-200 bg-white/50 hover:border-zinc-400 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/20'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</span>
                    </span>
                    <span className={`h-4 w-4 shrink-0 rounded-full border ${active ? 'border-[5px] border-zinc-800 dark:border-zinc-200' : 'border-zinc-300 dark:border-zinc-600'}`} />
                  </button>
                )
              })}
            </div>
            <ErrorText>{error}</ErrorText>
            <StepNav onBack={back} onNext={send} nextLabel={isBusy ? 'Sending…' : 'Send report'} isBusy={isBusy} />
          </>
        )}
      </div>
    </div>
  )
}

export default BugReportFlow
