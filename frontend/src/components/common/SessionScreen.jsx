import { useEffect, useState } from 'react'
import { SERIF } from '../auth/authStyles'

/* Quiet full-screen states shown by <Home/> while the session is verified.
   Same visual language as the auth + onboarding pages: warm canvas, monochrome mark, serif headline. */

const STAGES = [
  { from: 0, title: 'Opening your workspace', hint: 'Checking your session.' },
  { from: 5, title: 'Waking things up', hint: 'The server was resting. It usually needs a few seconds to start.' },
  { from: 20, title: 'Almost there', hint: 'A cold start can take up to a minute. Your journal is safe.' },
  { from: 45, title: 'Still starting', hint: 'Thanks for waiting. This only happens after a period of inactivity.' },
]

function Shell({ children }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-6 text-zinc-900 dark:bg-night dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_15%,rgba(120,113,108,0.10),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(120,113,108,0.08),transparent_30%)] dark:opacity-40" />
      <div className="tc-session-in relative flex w-full max-w-sm flex-col items-center text-center">{children}</div>
    </main>
  )
}

function Mark({ breathing }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-11 w-11 place-items-center rounded-xl bg-zinc-900 text-base font-bold text-white shadow-card dark:bg-zinc-100 dark:text-zinc-900 ${
        breathing ? 'tc-session-breathe' : ''
      }`}
    >
      T
    </span>
  )
}

export function SessionLoading() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const stage = STAGES.reduce((acc, item) => (seconds >= item.from ? item : acc), STAGES[0])

  return (
    <Shell>
      <Mark breathing />

      <div role="status" aria-live="polite" className="mt-8">
        <h1
          key={stage.title}
          className={`${SERIF} tc-session-text text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[32px]`}
        >
          {stage.title}
        </h1>
        <p
          key={stage.hint}
          className="tc-session-text mt-3 min-h-[3rem] text-sm leading-6 text-zinc-500 dark:text-zinc-400"
        >
          {stage.hint}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="relative mt-6 h-px w-40 overflow-hidden rounded-full bg-zinc-400/30 dark:bg-white/10"
      >
        <span className="tc-session-line absolute inset-y-0 w-1/3 rounded-full bg-zinc-700 dark:bg-zinc-300" />
      </div>

      <p className="mt-4 h-4 text-[11px] uppercase tracking-[0.18em] tabular-nums text-zinc-400 dark:text-zinc-500">
        {seconds >= 5 ? `${seconds}s` : ''}
      </p>
    </Shell>
  )
}

export function SessionError({ onRetry }) {
  return (
    <Shell>
      <Mark />
      <h1 className={`${SERIF} mt-8 text-[28px] font-medium leading-tight tracking-[-0.03em] sm:text-[32px]`}>
        We couldn&apos;t reach the server
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        It may still be starting up or briefly unavailable. Your data is safe, so please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-8 inline-flex h-10 items-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:ring-offset-night"
      >
        Try again
      </button>
    </Shell>
  )
}