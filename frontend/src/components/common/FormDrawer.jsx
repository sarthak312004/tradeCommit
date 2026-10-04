import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CloseIcon, MaximizeIcon, MinimizeIcon } from '../../utils/Icons.jsx'
import { iconButtonClass } from './formStyles'

/* ---------- motion + layout constants (identical to TradeForm) ---------- */
const EASE = 'cubic-bezier(0.32, 0.72, 0.0, 1)'
const DURATION = 320
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
 */
function FormDrawer({ ref, ariaTitle, breadcrumb, onSubmit, onClose, footer, children }) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_WIDTH)
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [visible, setVisible] = useState(false)
  const isResizingRef = useRef(false)
  const closeTimerRef = useRef(null)

  // slide-in on mount (two frames so the browser paints the starting position first)
  useEffect(() => {
    let inner
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setVisible(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [])

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
    setVisible(false)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      onClose?.()
    }, DURATION)
  }

  useImperativeHandle(ref, () => ({ close: requestClose }))

  const slide = `transform ${DURATION}ms ${EASE}`
  const grow = `width ${DURATION}ms ${EASE}`
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-black/30 p-2 backdrop-blur-[2px] md:p-3"
      style={{ opacity: visible ? 1 : 0, transition: `opacity ${DURATION}ms ${EASE}` }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaTitle}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: `${expanded ? EXPANDED_WIDTH : drawerWidth}px`,
          transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 2rem))',
          // no width easing while the user drags the edge, otherwise it feels laggy
          transition: isDragging ? slide : `${grow}, ${slide}`
        }}
        className="relative flex h-full max-w-full flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
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
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              aria-pressed={expanded}
              title={expanded ? 'Collapse' : 'Expand'}
              className={`${iconButtonClass} hidden md:flex`}
            >
              {expanded ? <MinimizeIcon className="h-[15px] w-[15px]" /> : <MaximizeIcon className="h-[15px] w-[15px]" />}
            </button>
            <p className="truncate pl-1 text-xs text-zinc-500 dark:text-zinc-400">{breadcrumb}</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" title="Close" className={iconButtonClass}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* page body */}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:#d4d4d8_transparent] [scrollbar-width:thin] dark:[scrollbar-color:#3f3f46_transparent]">
          <div className={`mx-auto w-full px-6 pb-16 pt-4 sm:px-10 ${expanded ? 'max-w-[1080px]' : 'max-w-[920px]'}`}>
            {children}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-300 px-6 py-3 dark:border-white/[0.12]">
          {footer}
        </footer>
      </form>
    </div>
  )
}

export default FormDrawer
