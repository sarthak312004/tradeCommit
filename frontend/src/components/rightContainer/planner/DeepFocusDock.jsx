import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDeepFocus } from '../../../context/useDeepFocus'
import { useFocusTimer } from '../../../hooks/useFocusTimer'
import FocusTimerPanel from './FocusTimerPanel'
import MusicDialog, { MusicIcon } from './MusicDialog'
import { SlidersIcon } from '../../../utils/Icons.jsx'

const THEMES = [
  { value: 'sage', label: 'Sage', swatch: 'bg-[#8b9b83]' },
  { value: 'ocean', label: 'Ocean', swatch: 'bg-sky-500' },
  { value: 'amber', label: 'Amber', swatch: 'bg-amber-500' },
]

const controlButton = 'inline-flex h-8 items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70'
const iconButton = 'relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70 dark:text-stone-400 dark:hover:bg-white/[0.07] dark:hover:text-stone-100'

const dockStyles = `
.music-playing-indicator { animation: music-playing-glow 1.8s ease-in-out infinite; }
@keyframes music-playing-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } 50% { box-shadow: 0 0 0 4px rgba(52,211,153,.22); } }
@media (prefers-reduced-motion: reduce) { .music-playing-indicator { animation: none !important; } }
`

function DeepFocusDock() {
  const { isEnabled, setIsEnabled, mainHeaderHost, plannerHeaderHost, preferences, isLoaded, loadError, isSaving, saveError, savePreferences, retryLoad } = useDeepFocus()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMusicOpen, setIsMusicOpen] = useState(false)
  const [isMusicMinimized, setIsMusicMinimized] = useState(false)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)
  const musicButtonRef = useRef(null)
  const settingsRef = useRef(null)
  const { reset: resetTimer } = useFocusTimer()
  const headerHost = plannerHeaderHost ?? mainHeaderHost
  const isPlannerOpen = Boolean(plannerHeaderHost)
  const showHeaderControls = isPlannerOpen || isEnabled

  return (
    <>
      <style>{dockStyles}</style>
      {showHeaderControls && headerHost && createPortal(
      <div
        className="flex items-center gap-1"
      >
        {isEnabled && isPlannerOpen && (
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((open) => !open)}
            aria-label="Focus settings"
            aria-expanded={isSettingsOpen}
            aria-controls="global-focus-settings"
            title="Focus settings"
            className={`${iconButton} ${isSettingsOpen ? 'border-stone-300 bg-white/80 text-stone-700 dark:border-white/15 dark:bg-white/[0.08] dark:text-stone-100' : ''}`}
          >
            <SlidersIcon className="h-4 w-4" />
          </button>
          {isSettingsOpen && (
            <div id="global-focus-settings" role="dialog" aria-label="Focus settings" className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-stone-200 bg-[#fbfaf7] p-3.5 text-stone-800 shadow-[0_16px_45px_rgba(20,25,20,0.16)] dark:border-white/10 dark:bg-[#1b1e1b] dark:text-stone-100 dark:shadow-black/40">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">Focus tint</p>
              <div role="radiogroup" aria-label="Focus theme" className="grid grid-cols-3 gap-1.5">
                {THEMES.map(({ value, label, swatch }) => {
                  const active = preferences.focusTheme === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => savePreferences({ ...preferences, focusTheme: value })}
                      disabled={!isLoaded || isSaving}
                      title={active ? `${label} focus tint selected` : `Switch to ${label} focus tint`}
                      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border text-[10px] font-medium transition-colors disabled:opacity-60 ${active ? 'border-stone-400/70 bg-white text-stone-800 shadow-sm dark:border-white/20 dark:bg-white/[0.09] dark:text-white' : 'border-transparent text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-white/[0.06]'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${swatch}`} />
                      {label}{active && <span aria-hidden="true" className="ml-0.5">✓</span>}
                    </button>
                  )
                })}
              </div>
              {loadError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">{loadError} <button type="button" onClick={retryLoad} className="font-medium underline">Retry</button></p>}
              {saveError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-400">{saveError}</p>}
            </div>
          )}
        </div>
        )}
        {isEnabled && <button
          ref={musicButtonRef}
          type="button"
          onClick={() => {
            if (!isMusicOpen) {
              setIsMusicOpen(true)
              setIsMusicMinimized(false)
            } else {
              setIsMusicMinimized((minimized) => !minimized)
            }
            setIsSettingsOpen(false)
          }}
          aria-label={isMusicPlaying ? 'Focus music playing' : 'Focus music'}
          aria-expanded={isMusicOpen && !isMusicMinimized}
          aria-controls="music-dialog"
          title={isMusicPlaying ? 'Music playing' : 'Focus music'}
          className={`${iconButton} ${isMusicOpen && !isMusicMinimized ? 'border-stone-300 bg-white/80 text-stone-700 dark:border-white/15 dark:bg-white/[0.08] dark:text-stone-100' : ''}`}
        >
          <MusicIcon />
          {isMusicPlaying && <span aria-hidden="true" className="music-playing-indicator absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-[#f7f6f2] dark:ring-[#111311]" />}
        </button>}

        <button
          type="button"
          onClick={() => {
            setIsEnabled((enabled) => !enabled)
            if (isEnabled) {
              resetTimer()
              setIsSettingsOpen(false)
              setIsMusicOpen(false)
              setIsMusicMinimized(false)
              setIsMusicPlaying(false)
            }
          }}
          aria-pressed={isEnabled}
          aria-label={isEnabled ? 'Turn off Deep Focus' : 'Turn on Deep Focus'}
          title={isEnabled ? 'Turn off Deep Focus' : 'Turn on Deep Focus'}
          className={`${controlButton} ${isEnabled ? 'border-stone-300/80 bg-white/70 text-stone-700 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-stone-200' : 'border-zinc-300 text-zinc-600 hover:bg-white/70 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.06]'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
          <span className="hidden sm:inline">{isEnabled ? 'Deep focus on' : 'Deep focus'}</span>
        </button>
      </div>
      , headerHost)}

      {isEnabled && <FocusTimerPanel theme={preferences.focusTheme} placement="floating" />}
      {isEnabled && isMusicOpen && (
        <MusicDialog
          preferences={preferences}
          isLoaded={isLoaded}
          loadError={loadError}
          isSaving={isSaving}
          saveError={saveError}
          onSave={savePreferences}
          onRetryLoad={retryLoad}
          anchorRef={musicButtonRef}
          anchorHost={headerHost}
          minimized={isMusicMinimized}
          onMinimizedChange={setIsMusicMinimized}
          onPlaybackChange={setIsMusicPlaying}
        />
      )}
    </>
  )
}

export default DeepFocusDock
