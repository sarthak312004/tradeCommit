import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CloseIcon, MaximizeIcon, MinimizeIcon } from '../../utils/Icons.jsx'
import { footerClass, iconButtonClass } from './formStyles'
import { useFormShortcuts } from '../../hooks/useFormShortcuts'
import { useDrawerMotion } from './useDrawerMotion'

/* ---------- motion + layout constants (identical to TradeForm) ---------- */
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const DURATION = 180
const EDGE_GAP = 12 // gap between the floating panel and the viewport edge (md:p-3)
const DEFAULT_WIDTH = 860
const MAX_WIDTH = 1400
const EXPANDED_WIDTH = 1400 // clamped by max-w-full on small screens

/**
 * Right-hand slide-over panel rendered as a <form>: resizable edge, expand toggle,
 * breadcrumb top bar, scrolling body and a footer. Call `ref.current.close()` to
 * play the slide-out animation; `onClose` fires once it has finished.
 *
 * `ref.current.close()` plays the slide-out animation before `onClose` fires.
 *
 * Esc closes the drawer and Ctrl/Cmd + Enter submits it. Pass `canClose={false}` / `canSubmit={false}`
 * to switch those off while a request is running.
 */
function FormDrawer({ ref, ariaTitle, breadcrumb, onSubmit, onClose, footer, children, canClose = true, canSubmit = true, deepMode = false, deepTheme = 'sage', headerExtra = null }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH)
  const [expanded, setExpanded] = useState(false)
  const isFullScreen = deepMode || expanded
  const [isDragging, setIsDragging] = useState(false)
  const isResizingRef = useRef(false)
  const closeTimerRef = useRef(null)
  const formRef = useRef(null)
  const overlayRef = useRef(null)

  // slide-in starts before the first paint and slide-out runs on the compositor: no state, no extra render
  const { slideOut } = useDrawerMotion({ overlayRef, panelRef: formRef, duration: DURATION })

  useEffect(() => () => clearTimeout(closeTimerRef.current), [])

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!isResizingRef.current) return
      setDrawerWidth(Math.min(MAX_WIDTH, window.innerWidth - EDGE_GAP * 2, Math.max(420, window.innerWidth - EDGE_GAP - event.clientX)))
    }

    const stopResizing = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [])

  const startResizing = () => {
    isResizingRef.current = true
    setIsDragging(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  // slide-out, then let the parent unmount the drawer
  const requestClose = () => {
    if (closeTimerRef.current) return
    slideOut()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onClose?.()
    }, DURATION)
  }

  // Take focus off whatever opened the drawer (a trade card, a calendar day) so Esc doesn't leave its focus ring lit.
  useEffect(() => {
    const form = formRef.current
    if (form && !form.contains(document.activeElement)) form.focus({ preventScroll: true })
  }, [])

  useImperativeHandle(ref, () => ({ close: requestClose }))
  useFormShortcuts({ formRef, onEscape: requestClose, canClose, canSubmit })

  const grow = `width ${DURATION}ms ${EASE}`
  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex justify-end overflow-hidden transition-colors duration-700 ${deepMode ? 'bg-[#f5f4f0]/95 p-0 backdrop-blur-xl dark:bg-[#111311]/95' : 'bg-black/30 p-2 backdrop-blur-[2px] md:p-3'}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaTitle}
    >
      <form
        ref={formRef}
        tabIndex={-1}
        onSubmit={onSubmit}
        style={{
          width: isFullScreen ? '100vw' : `${drawerWidth}px`,
          height: isFullScreen ? '100dvh' : '100%',
          borderRadius: deepMode ? 0 : undefined,
          transition: isDragging ? 'none' : `${grow}, height 450ms cubic-bezier(0.22,1,0.36,1), border-radius 450ms ease, background-color 700ms ease`,
          maxWidth: '100vw'
        }}
        className={`relative flex h-full max-w-full flex-col overflow-hidden border outline-none ${deepMode ? 'border-transparent bg-[#f7f6f2] shadow-none dark:bg-[#111311]' : 'rounded-xl border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel'}`}
      >
        <div
          role="separator"
          aria-label="Resize panel"
          aria-orientation="vertical"
          onPointerDown={startResizing}
          className={`group absolute bottom-0 left-0 top-0 z-20 w-2.5 cursor-ew-resize ${expanded ? 'hidden' : 'hidden md:block'}`}
        >
          <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-300 opacity-0 transition group-hover:opacity-100 dark:bg-zinc-600" />
        </div>

        {/* top bar */}
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={isFullScreen ? 'Exit full screen' : 'Expand panel'}
              aria-pressed={expanded}
              title={isFullScreen ? 'Exit full screen' : 'Expand'}
              className={`${iconButtonClass} hidden md:flex ${deepMode ? 'opacity-60 hover:opacity-100' : ''}`}
              disabled={deepMode}
            >
              {isFullScreen ? <MinimizeIcon className="h-[15px] w-[15px]" /> : <MaximizeIcon className="h-[15px] w-[15px]" />}
            </button>
            <p className={`truncate pl-1 text-xs ${deepMode ? 'text-stone-500 dark:text-stone-400' : 'text-zinc-600 dark:text-zinc-400'}`}>{breadcrumb}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2">{headerExtra}</div>
          <button type="button" onClick={requestClose} aria-label="Close" title="Close" className={iconButtonClass}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* page body */}
        <div
          data-focus-theme={deepMode ? deepTheme : undefined}
          className={`min-h-0 flex-1 overflow-y-auto [scrollbar-color:#d4d4d8_transparent] [scrollbar-width:thin] dark:[scrollbar-color:#3f3f46_transparent] ${deepMode ? 'deep-mode-scroll' : ''}`}
        >
          <div className={`mx-auto w-full px-6 pb-16 pt-4 sm:px-10 ${isFullScreen ? 'max-w-[1160px]' : 'max-w-[920px]'}`}>
            {children}
          </div>
        </div>

        <footer className={`${footerClass} justify-between ${deepMode ? 'deep-mode-footer' : ''}`}>
          {footer}
        </footer>
      </form>
    </div>
  )
}

export default FormDrawer
