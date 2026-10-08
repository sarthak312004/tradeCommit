import { useState } from 'react'
import { StarIcon } from '../../utils/Icons.jsx'
import { focusRing } from '../profile/profileStyles'
import { RATING_WORDS } from './ratingWords'

const SIZES = {
  xl: { button: 'h-12 w-12', icon: 'h-8 w-8', gap: 'gap-1.5' },
  lg: { button: 'h-10 w-10', icon: 'h-7 w-7', gap: 'gap-1' },
  sm: { button: 'h-7 w-7', icon: 'h-[18px] w-[18px]', gap: 'gap-0' },
}

/**
 * Standard five-star rating: hover previews, click chooses, one radio group.
 * With `allowClear`, clicking the chosen star again removes the rating (for optional questions).
 */
function StarRating({ label, value, onChange, disabled, size = 'lg', allowClear = false }) {
  const [hovered, setHovered] = useState(0)
  const shown = hovered || value
  const { button, icon, gap } = SIZES[size]

  return (
    <div role="radiogroup" aria-label={label} className={`flex items-center ${gap}`} onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} out of 5 — ${RATING_WORDS[star - 1]}`}
          disabled={disabled}
          onClick={() => onChange(allowClear && value === star ? 0 : star)}
          onMouseEnter={() => setHovered(star)}
          className={`flex ${button} cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${focusRing} ${
            star <= shown ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-300 hover:text-zinc-400 dark:text-zinc-600 dark:hover:text-zinc-500'
          }`}
        >
          <StarIcon className={`${icon} ${star <= shown ? 'fill-current' : ''}`} strokeWidth={size === 'sm' ? 1.75 : 1.5} />
        </button>
      ))}
    </div>
  )
}

export default StarRating
