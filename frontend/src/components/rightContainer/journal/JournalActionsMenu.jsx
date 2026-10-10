import { useEffect, useRef, useState } from 'react'
import { DownloadIcon, MoreIcon } from '../../../utils/Icons.jsx'
import { controlNeutral } from '../../common/controlStyles'

/**
 * The 3-dot button in the journal header. It opens a small menu of extra actions for the selected journal.
 * Add more entries to `items` later (import, duplicate, archive...) and they show up here.
 *
 * @param {Function} onExport  opens the export dialog
 */
function JournalActionsMenu({ onExport }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)

  const items = [
    { id: 'export', label: 'Export journal', hint: 'Excel, CSV, PDF, JSON or ZIP', Icon: DownloadIcon, onSelect: onExport }
  ]

  // close on outside click or Escape (Escape hands focus back to the button)
  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More journal actions"
        data-tour="journal-more"
        title="More actions"
        className={`${controlNeutral} px-0! w-8`}
      >
        <MoreIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Journal actions"
          className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-zinc-300 bg-white p-1.5 shadow-xl dark:border-white/[0.14] dark:bg-panel-hi"
        >
          {items.map(({ id, label, hint, Icon, onSelect }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              autoFocus
              onClick={() => {
                setIsOpen(false)
                onSelect()
              }}
              className="flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-300" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
                <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default JournalActionsMenu
