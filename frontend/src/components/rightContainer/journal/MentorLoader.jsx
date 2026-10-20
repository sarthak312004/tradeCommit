import { useEffect, useState } from 'react'
import MentorMark from './MentorMark'
import './mentorProgress.css'

const DOTS = 40 // thin dots around the outer edge
const CYCLE_S = 2.8 // one lap of the outline; the dots light up as it passes them
const STEP_MS = 4500
const HEAD = 46 / 377 // the bright arc's leading edge sits this far (of a lap) ahead of where it starts

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const stepsFor = (tradeCount) => [
  `Reading your strategy and ${tradeCount ? plural(tradeCount, 'trade') : 'trades'}`,
  'Checking every trade against your rules',
  'Looking for patterns in your habits',
  'Writing your feedback'
]

/**
 * What the trader sees while the AI mentor writes a review: the mentor logo, an outline that circles it, and thin
 * dots around the edge that light up as the outline passes. The line under it moves through what the mentor is
 * doing, so the wait (10 to 30 seconds) feels like progress instead of an empty panel.
 * Colour comes from `currentColor` (clay, brighter in dark mode); motion stops for people who prefer reduced motion.
 */
function MentorLoader({ tradeCount = 0 }) {
  const steps = stepsFor(tradeCount)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // the last line stays until the review arrives
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, steps.length - 1)), STEP_MS)
    return () => clearInterval(timer)
  }, [steps.length])

  return (
    <div className="ml-enter flex min-h-[320px] flex-col items-center justify-center px-6 py-8 text-center" role="status" aria-live="polite">
      <div className="relative h-40 w-40 text-[#c4623f] dark:text-[#e08a68]">
        <span aria-hidden="true" className="ml-glow absolute inset-5 rounded-full" />

        <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {/* faint track the outline runs on */}
          <circle cx="80" cy="80" r="60" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />

          {/* the circling outline: a short arc with a round head, plus a longer, fainter tail */}
          <g className="ml-spin">
            <circle cx="80" cy="80" r="60" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="120 257" />
            <circle cx="80" cy="80" r="60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="46 331" />
          </g>

          {/* thin dots around the edge; each one flares when the outline passes it and then fades */}
          {Array.from({ length: DOTS }, (_, index) => {
            const angle = (index / DOTS) * Math.PI * 2 // from 3 o'clock, clockwise: the same way the outline runs
            return (
              <circle
                key={index}
                className="ml-dot"
                cx={80 + Math.cos(angle) * 71}
                cy={80 + Math.sin(angle) * 71}
                r="1.35"
                fill="currentColor"
                style={{ animationDuration: `${CYCLE_S}s`, animationDelay: `${-(1 - (index / DOTS - HEAD)) * CYCLE_S}s` }}
              />
            )
          })}
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <MentorMark className="ml-mark h-14 w-14" />
        </div>
      </div>

      <p key={step} className="ml-line mt-7 text-[15px] font-medium tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
        {steps[step]}
        <span aria-hidden="true" className="ml-ellipsis" />
      </p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">This usually takes 10 to 30 seconds.</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">If the mentor can’t finish, this review won’t use your allowance.</p>
    </div>
  )
}

export default MentorLoader
