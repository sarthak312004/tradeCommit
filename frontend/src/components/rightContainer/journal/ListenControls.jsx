import { useMemo } from 'react'
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis'
import { buildReviewSpeech } from '../../../utils/reviewSpeech'
import { focusRing } from '../../common/controlStyles'

const iconProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'h-3.5 w-3.5' }

const SpeakerIcon = () => (
  <svg {...iconProps}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
)
const PauseIcon = () => (
  <svg {...iconProps}>
    <path d="M9 5v14M15 5v14" />
  </svg>
)
const StopIcon = () => (
  <svg {...iconProps}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
)

const pill = `inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-white/[0.14] dark:bg-panel dark:text-zinc-200 dark:hover:bg-panel-hi ${focusRing}`

/**
 * "Listen" row for a finished review: read it aloud with the browser's speech engine, pause / resume, stop,
 * and change the speed. Reading stops by itself when this unmounts (review closed, week changed, regenerating).
 */
function ListenControls({ review }) {
  const { supported, status, label, rate, speak, pause, resume, stop, cycleRate } = useSpeechSynthesis()
  const chunks = useMemo(() => buildReviewSpeech(review), [review])

  if (!supported || !chunks.length) return null

  const isIdle = status === 'idle'
  const handleMain = () => (isIdle ? speak(chunks) : status === 'speaking' ? pause() : resume())

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleMain} aria-pressed={!isIdle} className={pill}>
        {status === 'speaking' ? <PauseIcon /> : <SpeakerIcon />}
        {isIdle ? 'Listen' : status === 'speaking' ? 'Pause' : 'Resume'}
      </button>

      {!isIdle && (
        <button type="button" onClick={stop} aria-label="Stop listening" className={pill}>
          <StopIcon />
          Stop
        </button>
      )}

      <button type="button" onClick={cycleRate} title="Change reading speed" aria-label={`Reading speed ${rate} times, press to change`} className={`${pill} tabular-nums`}>
        {rate}x
      </button>

      {!isIdle && label && (
        <span role="status" className="min-w-0 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {status === 'paused' ? 'Paused' : 'Reading'}: {label}
        </span>
      )}
    </div>
  )
}

export default ListenControls
