import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toolbarIconButton } from '../formStyles'
import { focusRing } from '../controlStyles'
import { LinkIcon } from './tiptapIcons.jsx'

const keepSelection = (event) => event.preventDefault()

// "tradingview.com/x/abc" -> "https://tradingview.com/x/abc"; mailto: and tel: stay as typed
const normalizeUrl = (value) => {
  const url = value.trim()
  if (!url) return ''
  return /^(https?:\/\/|mailto:|tel:)/i.test(url) ? url : `https://${url}`
}

/**
 * Link button for the toolbar. Opens a small popover under the button with the address field.
 * Works on the selected text, or on the whole link when the caret is inside one.
 */
function LinkMenu({ editor, active }) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const inputRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState(null)
  const inputId = useId()

  useEffect(() => {
    if (!isOpen) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    const closeOnViewportChange = () => setIsOpen(false)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const toggle = (event) => {
    if (!editor) return
    if (isOpen) {
      setIsOpen(false)
      return
    }
    setValue(editor.getAttributes('link').href ?? '')
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuPosition({ left: Math.min(rect.left, window.innerWidth - 288), top: rect.bottom + 6 })
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    editor?.chain().focus().run()
  }

  const apply = () => {
    const href = normalizeUrl(value)
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setIsOpen(false)
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setIsOpen(false)
  }

  // this input lives inside the page's <form>: Enter must apply the link, and Esc must only close this popover
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      apply()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Link"
        aria-label="Link"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-pressed={active}
        onMouseDown={keepSelection}
        onClick={toggle}
        className={toolbarIconButton(active || isOpen)}
      >
        <LinkIcon className="h-4 w-4" />
      </button>

      {isOpen && menuPosition && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Link address"
          style={{ position: 'fixed', left: menuPosition.left, top: menuPosition.top }}
          className="z-[60] w-72 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/10 dark:border-white/[0.12] dark:bg-panel dark:shadow-black/40"
        >
          <label htmlFor={inputId} className="sr-only">Link address</label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste or type a link"
            autoComplete="off"
            spellCheck={false}
            className={`h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[13px] text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-400 dark:border-white/[0.12] dark:bg-white/[0.04] dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus:border-white/30`}
          />
          <div className="mt-2 flex items-center justify-end gap-1.5">
            {active && (
              <button type="button" onClick={remove} className={`h-7 rounded-md px-2.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/10 dark:text-rose-300 ${focusRing}`}>
                Remove
              </button>
            )}
            <button type="button" onClick={apply} className={`h-7 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white ${focusRing}`}>
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default LinkMenu
