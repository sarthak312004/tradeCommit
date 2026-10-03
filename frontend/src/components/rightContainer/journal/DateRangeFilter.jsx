import { useEffect, useRef, useState } from 'react'
import { ALL_TIME, RANGE_PRESETS, describeRange, isRangeActive, rangeFromPreset } from '../../../utils/dateRange'

const dateInputClass =
  'h-8 w-full rounded-md border border-zinc-200 bg-transparent px-2 text-xs text-zinc-800 outline-none transition-colors [color-scheme:light] focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 dark:border-white/10 dark:text-zinc-100 dark:[color-scheme:dark]'

function DateRangeFilter({ range, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const active = isRangeActive(range)

  // close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const selectPreset = (presetId) => {
    onChange(rangeFromPreset(presetId))
    setIsOpen(false)
  }

  const changeCustom = (field, value) => {
    const next = { ...range, preset: 'custom', [field]: value }
    // keep the range valid: if the user crosses the dates, move the other end along
    if (next.from && next.to && next.from > next.to) {
      if (field === 'from') next.to = value
      else next.from = value
    }
    onChange(next)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
          active
            ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : 'border-zinc-200 bg-white/60 text-zinc-600 hover:bg-white dark:border-white/10 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.06]'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
        <span className="max-w-40 truncate">{describeRange(range)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Filter trades by date"
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1b1d20]"
        >
          <ul>
            {RANGE_PRESETS.map((preset) => {
              const selected = range.preset === preset.id
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      selected
                        ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {preset.label}
                    {selected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-1.5 border-t border-zinc-200 px-1 pt-2.5 dark:border-white/[0.08]">
            <p className="mb-2 px-1.5 text-xs text-zinc-500 dark:text-zinc-400">Custom range</p>
            <div className="grid grid-cols-2 gap-2 px-1 pb-1">
              <label className="min-w-0">
                <span className="sr-only">From</span>
                <input type="date" value={range.from} max={range.to || undefined} onChange={(event) => changeCustom('from', event.target.value)} className={dateInputClass} />
              </label>
              <label className="min-w-0">
                <span className="sr-only">To</span>
                <input type="date" value={range.to} min={range.from || undefined} onChange={(event) => changeCustom('to', event.target.value)} className={dateInputClass} />
              </label>
            </div>
            {active && (
              <button
                type="button"
                onClick={() => {
                  onChange(ALL_TIME)
                  setIsOpen(false)
                }}
                className="mt-1 w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangeFilter
