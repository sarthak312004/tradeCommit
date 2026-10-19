import { useEffect, useRef, useState } from 'react'
import HeaderScene from './HeaderScene'
import { HEADER_SCENES } from './headerSceneData'
import { useIsDark } from '../../../hooks/useIsDark'

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50'

function ImageIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  )
}

/** Small button + popover in the header: pick a calm scene, upload your own picture, or switch the backdrop off. */
function HeaderBackdropPicker({ backdrop, onChooseScene, onClear, onUploadImage }) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const fileRef = useRef(null)
  const dark = useIsDark()

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
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

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setIsBusy(true)
    setError(await onUploadImage(file))
    setIsBusy(false)
  }

  const run = async (action) => setError(await action())

  const tile = (active) =>
    `group relative h-14 cursor-pointer overflow-hidden rounded-lg border transition ${focusRing} ${
      active ? 'border-sky-500 ring-2 ring-sky-400/40' : 'border-zinc-300 hover:border-zinc-400 dark:border-white/[0.14] dark:hover:border-white/30'
    }`

  const actionButton =
    `flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.06] ${focusRing}`

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Change header background"
        title="Header background"
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-900/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.08] ${isOpen ? 'bg-zinc-900/[0.06] dark:bg-white/[0.08]' : ''} ${focusRing}`}
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      <div
        role="dialog"
        aria-label="Header background"
        aria-hidden={!isOpen}
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-80 origin-top-right rounded-xl border border-zinc-300 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] transition duration-150 ease-out motion-reduce:transition-none dark:border-white/[0.14] dark:bg-panel-hi dark:shadow-black/50 ${
          isOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        <p className="px-0.5 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Header background</p>

        <div className="grid grid-cols-2 gap-2">
          {HEADER_SCENES.map((scene) => {
            const active = backdrop.mode === 'scene' && backdrop.scene === scene.id
            return (
              <button
                key={scene.id}
                type="button"
                tabIndex={isOpen ? 0 : -1}
                aria-pressed={active}
                onClick={() => run(() => onChooseScene(scene.id))}
                className={tile(active)}
              >
                <HeaderScene sceneId={scene.id} dark={dark} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent px-2 pb-1 pt-3 text-left text-[10px] font-medium text-white">{scene.name}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" tabIndex={isOpen ? 0 : -1} disabled={isBusy} onClick={() => fileRef.current?.click()} className={actionButton}>
            {isBusy ? 'Preparing…' : backdrop.mode === 'image' ? 'Replace picture' : 'Upload picture'}
          </button>
          {backdrop.mode !== 'none' && (
            <button type="button" tabIndex={isOpen ? 0 : -1} onClick={() => run(onClear)} className={actionButton}>
              Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" tabIndex={-1} />

        {backdrop.mode === 'image' && <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Your picture is used as the header background.</p>}
        {error && <p role="alert" className="mt-2 text-[11px] text-rose-500">{error}</p>}
        <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">Saved to your account.</p>
      </div>
    </div>
  )
}

export default HeaderBackdropPicker
