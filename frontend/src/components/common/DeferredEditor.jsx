import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import TiptapEditor from './tiptap/TiptapEditor'
import { toolbarClass } from './formStyles'

const DEFAULT_HINT = 'Tip: paste screenshots straight in with Ctrl/⌘ + V'

/**
 * Drop-in replacement for <TiptapEditor> inside the trade and plan drawers.
 *
 * Starting a Tiptap/ProseMirror editor is the heaviest part of opening a drawer. Doing it in the same render as the
 * drawer itself is what made the drawer feel stuck for a moment before it slid in. This wrapper paints the drawer
 * first (label, toolbar outline and writing area at their final size, so nothing shifts) and starts the real editor
 * right after that first frame, while the slide-in is already running.
 *
 * It takes the same props as TiptapEditor and exposes the same ref methods (getDraft, getContent, markSubmitted,
 * focus). If the form is saved before the editor has started, the editor is started on the spot and the call waits
 * for it, so existing text is never lost.
 */
function DeferredEditor({ ref, id, label, hint = DEFAULT_HINT, minHeightClass = 'min-h-[420px]', ...rest }) {
  const [ready, setReady] = useState(false)
  const innerRef = useRef(null)
  const waitersRef = useRef([])

  // after the first frame has been painted
  useEffect(() => {
    let timer
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setReady(true), 0)
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [])

  // child effects run before this one, so the editor is fully wired up by the time waiting callers are released
  useEffect(() => {
    if (!ready || !innerRef.current) return
    waitersRef.current.splice(0).forEach((resolve) => resolve(innerRef.current))
  }, [ready])

  const whenReady = () =>
    new Promise((resolve) => {
      if (innerRef.current) {
        resolve(innerRef.current)
        return
      }
      waitersRef.current.push(resolve)
      setReady(true)
    })

  useImperativeHandle(ref, () => ({
    getDraft: async () => (await whenReady()).getDraft(),
    getContent: async () => (await whenReady()).getContent(),
    markSubmitted: () => innerRef.current?.markSubmitted(),
    focus: () => innerRef.current?.focus()
  }), [])

  if (ready) {
    return <TiptapEditor ref={innerRef} id={id} label={label} hint={hint} minHeightClass={minHeightClass} {...rest} />
  }

  // same structure and sizes as the real editor: label row, toolbar strip, writing area
  return (
    <section className="group" aria-busy="true">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
        {hint && <span className="hidden text-[11px] text-zinc-600 sm:block dark:text-zinc-400">{hint}</span>}
      </div>
      <div aria-hidden="true" className={toolbarClass}>
        <span className="h-8" />
      </div>
      <div className={minHeightClass} />
    </section>
  )
}

export default DeferredEditor
