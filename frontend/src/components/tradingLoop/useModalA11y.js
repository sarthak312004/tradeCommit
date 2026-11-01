import { useEffect } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Proper modal behaviour for a portalled dialog:
 *   - the app behind it (#root) becomes inert: no clicks, no Tab, hidden from screen readers
 *   - Tab / Shift+Tab stay inside the dialog
 *   - focus returns to whatever opened it when it closes
 * Escape and arrow keys are handled by the dialog itself.
 */
export function useModalA11y(panelRef) {
  useEffect(() => {
    const panel = panelRef.current
    const appRoot = document.getElementById('root')
    const opener = document.activeElement
    const wasInert = appRoot ? appRoot.inert : false
    if (appRoot) appRoot.inert = true

    const trapTab = (event) => {
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!panel.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapTab)

    return () => {
      document.removeEventListener('keydown', trapTab)
      if (appRoot) appRoot.inert = wasInert
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [panelRef])
}
