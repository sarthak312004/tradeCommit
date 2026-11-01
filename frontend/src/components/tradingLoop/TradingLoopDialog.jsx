import { useEffect, useEffectEvent, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../utils/Icons.jsx'
import LoopDiagram from './LoopDiagram'
import SandboxProvider from './sandbox/SandboxProvider'
import LoopIcon from './LoopIcon'
import { Scene, SceneHeader, ScenePoints } from './LoopScene'
import { NavControls, ProgressIndicator } from './LoopNavigation'
import { loopGhost } from './loopStyles'
import { SCENES } from './scenes'
import { useLoopFlow } from './useLoopFlow'
import { useModalA11y } from './useModalA11y'
import './tradingLoop.css'

const titleText = (scene) => (Array.isArray(scene.title) ? scene.title.join(' ') : scene.title)

/**
 * The Trading Loop dialog. Pure presentation + navigation: it knows nothing about accounts or storage.
 *   scenes          scene list (defaults to SCENES; Part 2 can append sandbox scenes)
 *   initialSceneId  where to start (resume)
 *   onSceneChange   (sceneId) each time the scene changes
 *   onComplete      the last scene's main button
 *   onSkip          "Skip intro"
 *   onClose         the X, or Escape
 *   onOpenPlaybook  optional: shows a "Playbook" button; the controller pauses this dialog, opens the Playbook, then resumes here
 *   mode            'onboarding' | 'replay' | 'preview'; the last two show a small badge
 */
export default function TradingLoopDialog({ scenes = SCENES, initialSceneId, mode = 'onboarding', onSceneChange, onComplete, onSkip, onClose, onOpenPlaybook }) {
  const panelRef = useRef(null)
  const nextRef = useRef(null)
  const labelId = useId()
  const flow = useLoopFlow(scenes, initialSceneId, onSceneChange)
  const { scene, index, direction, isFirst, isLast } = flow

  useModalA11y(panelRef)

  // keyboard focus starts on the main button, and returns there if the focused button just became disabled
  useEffect(() => {
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) nextRef.current?.focus({ preventScroll: true })
  }, [index])

  const handleNext = () => (isLast ? onComplete?.() : flow.next())

  const handleKey = useEffectEvent((event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    // arrow keys belong to text fields and sliders inside the sandbox scenes; only Escape still closes from there
    const inField = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')
    if (inField && event.key !== 'Escape') return
    if (event.key === 'Escape') onClose?.()
    else if (event.key === 'ArrowRight') handleNext()
    else if (event.key === 'ArrowLeft') flow.back()
    else return
    event.preventDefault()
  })
  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const diagramMode = scene.kind === 'stage' ? 'stage' : scene.kind === 'loop' ? 'loop' : 'intro'
  const nextLabel = scene.primary ?? (isLast ? 'Get started' : 'Next')
  const CustomScene = scene.Component

  return createPortal(
    <SandboxProvider>
    <div className="tl-root fixed inset-0 z-[120] flex bg-black/75 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-guide-surface=""
        aria-labelledby={labelId}
        className="tl-dialog-in relative flex h-full w-full flex-col overflow-hidden bg-[#070b11] text-zinc-100 sm:h-auto sm:max-h-[min(740px,calc(100dvh-3rem))] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        {/* ambient light: two faint cyan/blue washes, no motion */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:radial-gradient(ellipse_60%_45%_at_12%_0%,rgba(34,211,238,0.11),transparent_70%),radial-gradient(ellipse_50%_40%_at_95%_100%,rgba(59,130,246,0.10),transparent_70%)]" />

        <div className="relative flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-8 sm:pt-5">
          <p id={labelId} className="flex items-center gap-2 text-xs font-medium tracking-[0.04em] text-zinc-300">
            <LoopIcon className="h-4 w-4 text-cyan-300" />
            TradeCommit · The Trading Loop
            {mode !== 'onboarding' && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-400">{mode}</span>}
          </p>
          <div className="flex items-center gap-1">
            {onOpenPlaybook && (
              <button type="button" onClick={onOpenPlaybook} className={`${loopGhost} h-9 !px-3 text-xs`}>
                Playbook
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close The Trading Loop" title="Close (Esc)" className={`${loopGhost} h-9 w-9 !px-0`}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:px-8">
          {CustomScene ? (
            <Scene key={scene.id} direction={direction}><CustomScene scene={scene} goNext={flow.next} goBack={flow.back} /></Scene>
          ) : (
            <>
              <Scene key={scene.id} direction={direction}>
                <SceneHeader scene={scene} hero={scene.kind === 'intro'} />
              </Scene>
              <div className="mt-5 sm:mt-6">
                <LoopDiagram mode={diagramMode} focus={scene.stage ?? null} />
              </div>
              <Scene key={`${scene.id}-detail`} direction={direction}>
                <ScenePoints points={scene.points} note={scene.note} />
              </Scene>
            </>
          )}
        </div>

        <div className="relative border-t border-white/[0.08] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:pb-5">
          <ProgressIndicator scenes={scenes} index={index} onGo={flow.goTo} />
          <NavControls isFirst={isFirst} isLast={isLast} nextLabel={nextLabel} nextRef={nextRef} onBack={flow.back} onNext={handleNext} onSkip={onSkip} />
        </div>

        <div role="status" aria-live="polite" className="sr-only">Step {index + 1} of {scenes.length}: {titleText(scene)}</div>
      </div>
    </div>
    </SandboxProvider>,
    document.body
  )
}
