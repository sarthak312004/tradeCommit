import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useYouTubePlayer } from '../../../hooks/useYouTubePlayer'
import { PROVIDER_LABEL, detectOtherProvider, getSavedMusic, kindLabel, parseMusicLink, spotifyEmbedUrl } from '../../../utils/musicLinks'

const SPOTIFY_SLOW_MS = 12000

const quietButton = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 disabled:pointer-events-none disabled:opacity-40'
const ghost = `${quietButton} border-stone-200/90 text-stone-600 hover:bg-stone-200/50 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/[0.07]`
const solid = `${quietButton} border-stone-700 bg-stone-800 text-stone-50 hover:bg-stone-700 dark:border-stone-200/80 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white`
const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 disabled:pointer-events-none disabled:opacity-40 dark:text-stone-400 dark:hover:bg-white/[0.07] dark:hover:text-stone-100'

const dialogStyles = `
.music-dialog-in { animation: music-dialog-in .2s cubic-bezier(.2,.8,.2,1) both; }
@keyframes music-dialog-in { from { opacity: 0; transform: translate(-50%,-6px) scale(.96); } to { opacity: 1; transform: translate(-50%,0) scale(1); } }
.music-dialog-minimized { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(.12); }
.music-dialog-shell { transform: translateX(-50%); transition: opacity .16s ease, transform .2s cubic-bezier(.2,.8,.2,1), width .2s ease, height .2s ease, padding .2s ease; }
.music-playing-indicator { animation: music-playing-glow 1.8s ease-in-out infinite; }
@keyframes music-playing-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } 50% { box-shadow: 0 0 0 4px rgba(52,211,153,.22); } }
@media (prefers-reduced-motion: reduce) { .music-dialog-in, .music-dialog-shell, .music-playing-indicator { animation: none !important; transition: none !important; } }
`

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export function MusicIcon({ className = 'h-4 w-4' }) {
  return <svg {...svg} className={className}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></svg>
}
const MinimizeGlyph = () => <svg {...svg} className="h-3.5 w-3.5"><path d="m6 9 6 6 6-6" /></svg>
const ExternalGlyph = () => <svg {...svg} className="h-3.5 w-3.5"><path d="M13 5h6v6M19 5l-9 9" /><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
const EditGlyph = () => <svg {...svg} className="h-3.5 w-3.5"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z" /></svg>
const RemoveGlyph = () => <svg {...svg} className="h-3.5 w-3.5"><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
const PlayGlyph = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
const PauseGlyph = () => <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
const SkipGlyph = ({ back }) => <svg viewBox="0 0 24 24" fill="currentColor" className={`h-3.5 w-3.5 ${back ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 6v12l8.5-6zM16 6h2.5v12H16z" /></svg>
const VolumeGlyph = ({ muted }) => <svg {...svg} className="h-3.5 w-3.5"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />{muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />}</svg>

function ProviderDot({ provider }) {
  return <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${provider === 'youtube' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
}

function OpenLink({ provider, url, children }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-stone-600 underline decoration-stone-300 underline-offset-2 hover:text-stone-900 dark:text-stone-300 dark:decoration-stone-600 dark:hover:text-white">
      {children ?? `Open in ${PROVIDER_LABEL[provider]}`}
    </a>
  )
}

/* ---------------------------------- Spotify ---------------------------------- */

// Official Spotify embed (a plain iframe, no OAuth). Its own controls handle play/pause, seek and volume.
function SpotifyPlayer({ parsed }) {
  const [loaded, setLoaded] = useState(false)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (loaded) return undefined
    const timer = setTimeout(() => setSlow(true), SPOTIFY_SLOW_MS)
    return () => clearTimeout(timer)
  }, [loaded])

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-stone-200/50 dark:bg-white/[0.05]" style={{ height: 152 }}>
        {!loaded && <p className="absolute inset-0 flex items-center justify-center text-[12px] text-stone-500 dark:text-stone-400" role="status">Loading Spotify…</p>}
        <iframe
          title={`Spotify ${kindLabel(parsed.kind).toLowerCase()}`}
          src={spotifyEmbedUrl(parsed)}
          width="100%"
          height="100%"
          style={{ border: 0, opacity: loaded ? 1 : 0, transition: 'opacity .3s ease' }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          onLoad={() => setLoaded(true)}
        />
      </div>
      {slow && !loaded ? (
        <p role="alert" className="mt-2 text-[11px] leading-5 text-amber-700 dark:text-amber-400">
          Spotify is taking a while. A network setting or browser extension may be blocking embeds. <OpenLink provider="spotify" url={parsed.url} />
        </p>
      ) : null}
    </div>
  )
}

/* ---------------------------------- YouTube ---------------------------------- */

function YouTubePlayer({ parsed, onPlaybackChange }) {
  const containerRef = useRef(null)
  const player = useYouTubePlayer({ videoId: parsed.videoId, listId: parsed.listId }, containerRef)
  const hasQueue = Boolean(parsed.listId)
  const isPlaying = player.playback === 'playing' || player.playback === 'buffering'
  const ready = player.status === 'ready'
  useEffect(() => onPlaybackChange(isPlaying), [isPlaying, onPlaybackChange])

  return (
    <div>
      {/* YouTube asks for an embedded player of at least 200x200, so the compact size stays above that */}
      <div className="relative overflow-hidden rounded-xl bg-stone-900/90" style={{ height: 200 }}>
        <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
        {player.status === 'loading' && <p role="status" className="absolute inset-0 flex items-center justify-center text-[12px] text-stone-300">Loading YouTube…</p>}
        {player.status === 'error' && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-900 px-4 text-center">
            <p className="text-[12px] leading-5 text-stone-200">{player.error}</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={player.retry} className="text-[11px] font-medium text-stone-100 underline underline-offset-2">Try again</button>
              <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-stone-100 underline underline-offset-2">Open on YouTube</a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1" role="group" aria-label="YouTube playback controls">
        {hasQueue && <button type="button" onClick={player.previous} disabled={!ready} aria-label="Previous track" title="Previous" className={iconButton}><SkipGlyph back /></button>}
        <button type="button" onClick={player.togglePlay} disabled={!ready} aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} className={`${iconButton} bg-stone-800 text-stone-50 hover:bg-stone-700 hover:text-white dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white dark:hover:text-stone-900`}>
          {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
        </button>
        {hasQueue && <button type="button" onClick={player.next} disabled={!ready} aria-label="Next track" title="Next" className={iconButton}><SkipGlyph /></button>}
        <button type="button" onClick={player.toggleMute} disabled={!ready} aria-label={player.muted ? 'Unmute' : 'Mute'} aria-pressed={player.muted} title={player.muted ? 'Unmute' : 'Mute'} className={`${iconButton} ml-1`}><VolumeGlyph muted={player.muted || player.volume === 0} /></button>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={player.muted ? 0 : player.volume}
          onChange={(event) => player.setVolume(event.target.value)}
          disabled={!ready}
          aria-label="Volume"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-stone-600 disabled:opacity-40 dark:accent-stone-300"
        />
      </div>
    </div>
  )
}

/* ------------------------------- Dialog sections ------------------------------- */

function SetupForm({ initialProvider, canCancel, isSaving, serverError, onCancel, onSave }) {
  const [provider, setProvider] = useState(initialProvider)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const other = value.trim() ? detectOtherProvider(provider, value) : null
  const preview = value.trim() ? parseMusicLink(provider, value) : null

  const submit = async (event) => {
    event.preventDefault()
    const parsed = parseMusicLink(provider, value)
    if (!parsed.ok) {
      setError(other ? `That looks like a ${PROVIDER_LABEL[other]} link. Switch provider to use it.` : parsed.message)
      inputRef.current?.focus()
      return
    }
    setError('')
    const message = await onSave(provider, parsed)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} noValidate>
      <div role="radiogroup" aria-label="Music provider" className="grid grid-cols-2 gap-1 rounded-lg bg-stone-200/50 p-0.5 dark:bg-white/[0.06]">
        {['spotify', 'youtube'].map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={provider === id}
            onClick={() => { setProvider(id); setError('') }}
            className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60 ${provider === id ? 'bg-white text-stone-800 shadow-sm dark:bg-[#252925] dark:text-stone-100' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100'}`}
          >
            <ProviderDot provider={id} /> {PROVIDER_LABEL[id]}
          </button>
        ))}
      </div>

      <label htmlFor="music-link" className="mt-3 block text-[11px] font-medium text-stone-500 dark:text-stone-400">
        {provider === 'spotify' ? 'Spotify playlist or album link' : 'YouTube playlist or video link'}
      </label>
      <input
        id="music-link"
        ref={inputRef}
        type="url"
        value={value}
        onChange={(event) => { setValue(event.target.value); setError('') }}
        placeholder={provider === 'spotify' ? 'https://open.spotify.com/playlist/…' : 'https://www.youtube.com/playlist?list=…'}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby="music-link-help"
        className="mt-1 h-9 w-full rounded-lg border border-stone-200/90 bg-transparent px-2.5 text-[12px] text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 dark:border-white/10 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-white/30"
      />
      <p id="music-link-help" className="mt-1.5 min-h-[1.25rem] text-[11px] leading-5">
        {error || serverError ? <span role="alert" className="text-rose-600 dark:text-rose-400">{serverError && error ? serverError : error || serverError}</span>
          : preview?.ok ? <span className="text-emerald-700 dark:text-emerald-400">{kindLabel(preview.kind)} link recognised</span>
          : other ? <span className="text-stone-500 dark:text-stone-400">This looks like a {PROVIDER_LABEL[other]} link. <button type="button" onClick={() => { setProvider(other); setError('') }} className="font-medium underline underline-offset-2">Switch to {PROVIDER_LABEL[other]}</button></span>
          : null}
      </p>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {canCancel && <button type="button" onClick={onCancel} disabled={isSaving} className={ghost}>Cancel</button>}
        <button type="submit" disabled={isSaving || value.trim() === ''} className={solid}>{isSaving ? 'Saving…' : 'Save playlist'}</button>
      </div>
    </form>
  )
}

function SavedCard({ saved, isSaving, onReplace, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  const label = saved.parsed.ok ? kindLabel(saved.parsed.kind) : 'Saved link'
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white/60 p-2 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium text-stone-600 dark:text-stone-300">
          <ProviderDot provider={saved.provider} /> {PROVIDER_LABEL[saved.provider]} · {label}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          {saved.parsed.ok && (
            <a href={saved.parsed.url} target="_blank" rel="noopener noreferrer" aria-label={`Open in ${PROVIDER_LABEL[saved.provider]}`} title={`Open in ${PROVIDER_LABEL[saved.provider]}`} className={iconButton}>
              <ExternalGlyph />
            </a>
          )}
          {confirming ? (
            <>
              <span role="status" aria-live="polite" className="mr-auto text-[11px] text-stone-600 dark:text-stone-300">{isSaving ? 'Removing…' : 'Remove saved playlist?'}</span>
              <button type="button" onClick={() => setConfirming(false)} disabled={isSaving} className={ghost}>Keep</button>
              <button type="button" onClick={onRemove} disabled={isSaving} className={`${quietButton} border-rose-600 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-500 dark:bg-rose-500`}>Remove</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onReplace} disabled={isSaving} aria-label="Replace playlist" title="Replace playlist" className={iconButton}><EditGlyph /></button>
              <button type="button" onClick={() => setConfirming(true)} disabled={isSaving} aria-label="Remove playlist" title="Remove playlist" className={iconButton}><RemoveGlyph /></button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact floating music dialog for Deep Mode. It sits under the header on the right, does not dim or block the
 * editor, and is rendered outside the plan <form>. Closing it unmounts the embedded player, so playback stops with it.
 * The saved playlist lives on the signed-in account (focus preferences) and is restored whenever Deep Mode opens.
 *
 * Props come straight from useFocusPreferences().
 */
function MusicDialog({ preferences, isLoaded, loadError, isSaving, saveError, onSave, onRetryLoad, anchorRef, minimized, onMinimizedChange, onPlaybackChange }) {
  const dialogRef = useRef(null)
  const [position, setPosition] = useState({ top: 56, left: 0 })
  const [replacing, setReplacing] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)
  const saved = getSavedMusic(preferences)
  const showSetup = isLoaded && (!saved || replacing)
  const hasYouTubePlayer = isLoaded && Boolean(saved?.parsed.ok) && saved.provider === 'youtube' && !replacing

  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    if (!hasYouTubePlayer) onPlaybackChange(false)
  }, [hasYouTubePlayer, onPlaybackChange])

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = anchorRef?.current?.getBoundingClientRect()
      if (rect) {
        setPosition({
          top: minimized ? rect.top + rect.height / 2 : rect.bottom + 8,
          left: rect.left + rect.width / 2
        })
      }
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, minimized])

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onMinimizedChange(true)
      anchorRef.current?.focus()
    }
  }

  const minimize = () => {
    onMinimizedChange(true)
    anchorRef.current?.focus()
  }

  const persist = async (next, expectedProvider) => {
    setActionFailed(false)
    const result = await onSave(next)
    if (!result || (result.musicProvider ?? '') !== expectedProvider) {
      setActionFailed(true)
      return 'Could not save your playlist. Check your connection and try again.'
    }
    return ''
  }

  const savePlaylist = async (provider, parsed) => {
    const message = await persist({
      ...preferences,
      musicProvider: provider,
      spotifyUrl: provider === 'spotify' ? parsed.url : '',
      youtubeUrl: provider === 'youtube' ? parsed.url : ''
    }, provider)
    if (!message) setReplacing(false)
    return message
  }

  const removePlaylist = () => persist({ ...preferences, musicProvider: '', spotifyUrl: '', youtubeUrl: '' }, '')

  return (
    <div
      ref={dialogRef}
      id="music-dialog"
      role="dialog"
      aria-label="Focus music"
      aria-hidden={minimized}
      inert={minimized}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ top: position.top, left: position.left, transform: minimized ? 'translate(-50%,-50%) scale(.12)' : undefined, transformOrigin: 'center' }}
      className={`music-dialog-shell fixed z-[60] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-stone-200/80 bg-[#fbfaf7]/95 text-stone-700 shadow-[0_16px_45px_rgba(20,25,20,0.16)] outline-none backdrop-blur-md [scrollbar-width:thin] dark:border-white/10 dark:bg-[#1b1e1b]/95 dark:text-stone-200 dark:shadow-black/40 ${minimized ? 'music-dialog-minimized h-8 w-8 overflow-hidden rounded-full border-transparent bg-transparent p-0 shadow-none' : 'music-dialog-in w-[min(22rem,calc(100vw-1.5rem))] p-3'}`}
    >
      <style>{dialogStyles}</style>
      {!minimized && <div className="mb-3 flex items-center justify-end">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={minimize}
            aria-label="Minimize music player"
            title="Minimize"
            className={iconButton}
          >
            <MinimizeGlyph />
          </button>
        </div>
      </div>}

      <div>
        {!isLoaded && !loadError && <p role="status" className="py-6 text-center text-[12px] text-stone-500 dark:text-stone-400">Loading your saved playlist…</p>}

        {loadError && (
          <div role="alert" className="py-4 text-center">
            <p className="text-[12px] leading-5 text-rose-600 dark:text-rose-400">{loadError}</p>
            <button type="button" onClick={onRetryLoad} className={`${ghost} mt-2`}>Try again</button>
          </div>
        )}

        {showSetup && (
          <>
            <SetupForm
              initialProvider={saved?.provider ?? 'spotify'}
              canCancel={Boolean(saved)}
              isSaving={isSaving}
              serverError={actionFailed ? saveError : ''}
              onCancel={() => setReplacing(false)}
              onSave={savePlaylist}
            />
          </>
        )}

        {isLoaded && saved && !replacing && (
          <div className="space-y-2.5">
            <SavedCard saved={saved} isSaving={isSaving} onReplace={() => setReplacing(true)} onRemove={removePlaylist} />
            {actionFailed && <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">{saveError || 'Could not update your playlist. Please try again.'}</p>}
            {saved.parsed.ok ? (
              saved.provider === 'spotify'
                ? <SpotifyPlayer key={saved.parsed.url} parsed={saved.parsed} />
                : <YouTubePlayer key={saved.parsed.url} parsed={saved.parsed} onPlaybackChange={onPlaybackChange} />
            ) : (
              <p role="alert" className="text-[12px] leading-5 text-amber-700 dark:text-amber-400">This saved link can no longer be played. Replace it with a new one, or remove it.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MusicDialog
