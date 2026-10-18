import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper } from '@tiptap/react'
import { Selection } from '@tiptap/pm/state'
import { CloseIcon, MaximizeIcon, TrashIcon } from '../../../utils/Icons.jsx'
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, GripIcon } from './tiptapIcons.jsx'

const MIN_WIDTH = 80
const SNAP_PX = 12 // dragging this close to the full width snaps to it
const SIZES = [
  { label: 'S', title: 'Small (25%)', ratio: 0.25 },
  { label: 'M', title: 'Medium (50%)', ratio: 0.5 },
  { label: 'L', title: 'Large (75%)', ratio: 0.75 },
  { label: 'Full', title: 'Full width', ratio: 1 }
]
const ALIGNS = [
  { value: null, title: 'Align left', Icon: AlignLeftIcon },
  { value: 'center', title: 'Align center', Icon: AlignCenterIcon },
  { value: 'right', title: 'Align right', Icon: AlignRightIcon }
]
// corners: which side the handle sits on (a left handle grows the picture when dragged to the left)
const CORNERS = [
  { id: 'tl', sign: -1, position: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { id: 'tr', sign: 1, position: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { id: 'bl', sign: -1, position: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
  { id: 'br', sign: 1, position: '-bottom-1.5 -right-1.5 cursor-nwse-resize' }
]

const alignClass = { center: 'mx-auto', right: 'ml-auto' }

const pillButton = (active) =>
  `flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
    active ? 'bg-white/25' : 'hover:bg-white/15'
  }`

const keepSelection = (event) => event.preventDefault()

// full-size preview; Esc or a click anywhere closes it (and Esc never reaches the form's own Esc shortcut)
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={onClose} className="fixed inset-0 z-[70] flex cursor-zoom-out items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8">
      <img src={src} alt={alt ?? ''} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
      <button type="button" onClick={onClose} aria-label="Close preview" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>,
    document.body
  )
}

/**
 * How a screenshot looks inside the editor. Hover it (or tap it) to get:
 *  - a small bar on top: drag grip (move it anywhere between paragraphs), alignment, size presets, full-size preview, remove
 *  - a handle on every corner: drag to resize (keeps the proportions, snaps to full width, double-click to reset)
 */
function ImageView({ node, editor, getPos, updateAttributes, deleteNode, selected }) {
  const imageRef = useRef(null)
  const wrapperRef = useRef(null)
  const resizeRef = useRef(null)
  const [liveWidth, setLiveWidth] = useState(null) // px while a corner is being dragged
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [resizeCursor, setResizeCursor] = useState('')
  const { src, alt, width, align } = node.attrs
  const visibility = selected || liveWidth ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/img:pointer-events-auto group-hover/img:opacity-100 group-focus-within/img:pointer-events-auto group-focus-within/img:opacity-100'
  const fullWidth = () => Math.max(MIN_WIDTH, editor.view.dom.clientWidth)

  useEffect(() => {
    const deselectOnOutsidePointer = (event) => {
      if (wrapperRef.current?.contains(event.target) || !selected || editor.isDestroyed) return
      const selection = Selection.near(editor.state.doc.resolve(getPos()), -1)
      editor.view.dispatch(editor.state.tr.setSelection(selection))
    }
    document.addEventListener('pointerdown', deselectOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', deselectOnOutsidePointer)
  }, [editor, getPos, selected])

  useEffect(() => {
    if (!resizeCursor) return undefined
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = resizeCursor
    return () => { document.body.style.cursor = previousCursor }
  }, [resizeCursor])

  const startResize = (corner) => (event) => {
    const image = imageRef.current
    if (!image) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { sign: corner.sign, startX: event.clientX, startWidth: image.offsetWidth, maxWidth: fullWidth() }
    setResizeCursor(getComputedStyle(event.currentTarget).cursor)
    setLiveWidth(image.offsetWidth)
  }

  const moveResize = (event) => {
    const active = resizeRef.current
    const image = imageRef.current
    if (!active || !image) return
    let next = active.startWidth + (event.clientX - active.startX) * active.sign
    next = Math.min(active.maxWidth, Math.max(MIN_WIDTH, next))
    if (active.maxWidth - next < SNAP_PX) next = active.maxWidth
    next = Math.round(next)
    image.style.width = `${next}px`
    image.style.height = 'auto'
    setLiveWidth(next)
  }

  const endResize = (event) => {
    const active = resizeRef.current
    const image = imageRef.current
    if (!active) return
    resizeRef.current = null
    setResizeCursor('')
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setLiveWidth(null)
    if (image) updateAttributes({ width: Math.round(image.offsetWidth) })
  }

  const resetSize = () => {
    if (imageRef.current) imageRef.current.style.width = ''
    updateAttributes({ width: null })
  }

  const applySize = (ratio) => updateAttributes({ width: Math.round(fullWidth() * ratio) })
  const isSize = (ratio) => Boolean(width) && Math.abs(width - fullWidth() * ratio) <= 2

  return (
    <NodeViewWrapper ref={wrapperRef} className={`group/img relative my-4 w-fit max-w-full ${alignClass[align] ?? ''}`}>
      <img
        ref={imageRef}
        src={src}
        alt={alt ?? ''}
        draggable={false}
        onDoubleClick={() => setIsPreviewOpen(true)}
        style={{ margin: 0, height: 'auto', width: width ? `${width}px` : undefined }}
        className={selected ? 'ring-2 ring-sky-600/50 dark:ring-sky-400/50' : ''}
      />

      {/* action bar */}
      <div role="toolbar" aria-label="Screenshot options" className={`absolute left-1/2 top-2 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-lg bg-zinc-900/85 p-0.5 shadow-md backdrop-blur-sm transition-opacity ${visibility}`}>
        <span data-drag-handle title="Drag to move" aria-label="Drag to move screenshot" className="flex h-7 w-6 cursor-grab items-center justify-center rounded-md text-white/80 hover:bg-white/15 active:cursor-grabbing">
          <GripIcon className="h-4 w-4" />
        </span>
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/20" />
        {ALIGNS.map(({ value, title, Icon }) => (
          <button key={title} type="button" title={title} aria-label={title} aria-pressed={(align ?? null) === value} onMouseDown={keepSelection} onClick={() => updateAttributes({ align: value })} className={pillButton((align ?? null) === value)}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/20" />
        {SIZES.map(({ label, title, ratio }) => (
          <button key={label} type="button" title={title} aria-label={title} aria-pressed={isSize(ratio)} onMouseDown={keepSelection} onClick={() => applySize(ratio)} className={pillButton(isSize(ratio))}>
            {label}
          </button>
        ))}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/20" />
        <button type="button" title="View full size" aria-label="View full size" onMouseDown={keepSelection} onClick={() => setIsPreviewOpen(true)} className={pillButton(false)}>
          <MaximizeIcon className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Remove screenshot" aria-label="Remove screenshot" onMouseDown={keepSelection} onClick={deleteNode} className={`${pillButton(false)} hover:!bg-rose-500/80`}>
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* corner handles */}
      {CORNERS.map((corner) => (
        <button
          key={corner.id}
          type="button"
          tabIndex={-1}
          onPointerDown={startResize(corner)}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={resetSize}
          title="Drag to resize (double-click to reset)"
          aria-label="Resize screenshot"
          className={`absolute h-3.5 w-3.5 touch-none rounded-full border-2 border-white bg-sky-600 shadow transition-opacity focus-visible:outline-none dark:border-zinc-900 dark:bg-sky-400 ${corner.position} ${visibility}`}
        />
      ))}

      {liveWidth && (
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/85 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {liveWidth}px
        </span>
      )}

      {isPreviewOpen && <Lightbox src={src} alt={alt} onClose={() => setIsPreviewOpen(false)} />}
    </NodeViewWrapper>
  )
}

export default ImageView
