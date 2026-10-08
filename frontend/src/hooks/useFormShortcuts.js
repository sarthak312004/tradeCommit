import { useEffect, useRef } from 'react'

const NAV = typeof navigator !== 'undefined' ? navigator : null
const IS_MAC = Boolean(NAV && /mac|iphone|ipad/i.test(NAV.platform || NAV.userAgent))

/** "Ctrl" or "\u2318", for shortcut hints. */
export const MOD_LABEL = IS_MAC ? '\u2318' : 'Ctrl'

/**
 * Keyboard shortcuts for a drawer / dialog form:
 *   Esc               -> onEscape()  (usually the form's animated close)
 *   Ctrl/Cmd + Enter    -> submits the form through its normal submit handler, so validation still runs
 *
 * Esc is ignored when something inside the form already used it (an open menu calls preventDefault),
 * and while IME text is being composed. `canClose` / `canSubmit` switch each shortcut off, e.g. while saving.
 */
export function useFormShortcuts({ formRef, onEscape, canClose = true, canSubmit = true }) {
  const latestRef = useRef({ onEscape, canClose, canSubmit })

  useEffect(() => {
    latestRef.current = { onEscape, canClose, canSubmit }
  })

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing || event.defaultPrevented) return
      const latest = latestRef.current

      if (event.key === 'Escape') {
        if (!latest.canClose) return
        event.preventDefault()
        latest.onEscape?.()
        return
      }

      if (event.key === 'Enter' && (IS_MAC ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault() // also stops the editor from inserting a stray line break
        if (!event.repeat && latest.canSubmit) formRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [formRef])
}
