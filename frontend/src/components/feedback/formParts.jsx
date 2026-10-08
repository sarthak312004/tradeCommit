// Pieces shared by the feedback and bug-report flows. They follow the onboarding page: thin progress bars,
// a small uppercase eyebrow, a serif heading, then Back / Continue.
import { SERIF } from '../auth/authStyles'

export function ErrorText({ children }) {
  return children ? (
    <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">
      {children}
    </p>
  ) : null
}

/** One thin bar per step; filled up to and including the current one. */
export function ProgressBars({ total, current }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index <= current ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-300/80 dark:bg-white/10'}`}
        />
      ))}
    </div>
  )
}

/** Eyebrow + serif heading + short line of help. Re-keyed per step by the caller so it fades in. */
export function StepHeading({ eyebrow, title, children }) {
  return (
    <>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
      <h2 className={`${SERIF} text-[28px] font-medium leading-[1.12] tracking-[-0.025em] text-zinc-900 dark:text-zinc-50`}>{title}</h2>
      {children && <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{children}</p>}
    </>
  )
}

const textButton =
  'cursor-pointer text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-zinc-100'

/** Back on the left; optional Skip and the main button on the right. */
export function StepNav({ onBack, onSkip, onNext, nextLabel = 'Continue', nextDisabled = false, isBusy = false }) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} disabled={isBusy} className={textButton}>
          ← Back
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-4">
        {onSkip && (
          <button type="button" onClick={onSkip} disabled={isBusy} className={textButton}>
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || isBusy}
          className="h-10 cursor-pointer rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

export const stepEnter = 'animate-[fadeIn_.25s_ease-out]'
