import { useCallback, useEffect, useId, useRef } from 'react'
import { BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon, QuoteIcon } from '../../utils/Icons.jsx'
import { strategyToHtml } from '../../utils/richText'
import { useActiveFormats } from '../../hooks/useActiveFormats'
import TextStyleMenu from './TextStyleMenu'
import { editorClass, toolbarClass, toolbarDivider, toolbarIconButton, toolbarTextButton } from './formStyles'

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

// Same writing surface as the trade analysis (TradeForm) and the plan editor (PlanForm): a sticky toolbar strip
// above a borderless, roomy editing area. Only the starting height differs, so it is taken out of the shared class.
const contentClass = editorClass.replace('min-h-[420px]', '').replace(/\s+/g, ' ').trim()

// "- " / "* " / "1. " / "> " typed at the start of a line turn into a list or quote, like in most note apps
const SHORTCUTS = [
  { pattern: /^[-*]$/, command: 'insertUnorderedList' },
  { pattern: /^1[.)]$/, command: 'insertOrderedList' },
  { pattern: /^>$/, command: 'formatBlock', value: 'blockquote' }
]

function ToolbarButton({ title, Icon, onClick, active }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} onMouseDown={keepSelection} onClick={onClick} className={toolbarIconButton(active)}>
      <Icon className="h-4 w-4" />
    </button>
  )
}

/**
 * A small rich text editor for notes without images: bold, italic, headings, bullet and numbered lists
 * (Tab / Shift+Tab to nest), quotes and clear formatting. Pasted text is always inserted as plain text.
 * Uncontrolled: it is filled once from `initialHtml` and reports every change through `onChange(html, text)`.
 * Looks like the editors in the trade form and the planner. Set the editing area's starting height with `editorClassName`.
 */
function BasicRichTextEditor({ id, label, labelledBy, initialHtml = '', placeholder, onChange, editorClassName = 'min-h-[240px]' }) {
  const fallbackId = useId()
  const editorId = id ?? fallbackId
  const editorRef = useRef(null)
  const formats = useActiveFormats(editorRef)

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = strategyToHtml(initialHtml)
  }, [initialHtml])

  const emitChange = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    const text = editor.textContent.trim()
    // browsers leave <br> or empty blocks behind after deleting everything; reset so the placeholder comes back
    if (!text && !editor.querySelector('li, ul, ol, blockquote') && editor.innerHTML !== '') editor.innerHTML = ''
    onChange?.(editor.innerHTML, text)
  }, [onChange])

  const runCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    emitChange()
  }

  const clearFormatting = () => {
    editorRef.current?.focus()
    document.execCommand('removeFormat')
    document.execCommand('formatBlock', false, 'p')
    if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList')
    if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList')
    emitChange()
  }

  const handleKeyDown = (event) => {
    const inList = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')

    // Tab nests the current list item (Shift+Tab un-nests); outside lists Tab keeps moving focus, for keyboard users
    if (event.key === 'Tab' && inList) {
      event.preventDefault()
      runCommand(event.shiftKey ? 'outdent' : 'indent')
      return
    }

    if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return
    const selection = window.getSelection()
    const node = selection?.anchorNode
    if (!selection?.isCollapsed || node?.nodeType !== Node.TEXT_NODE || inList) return

    const before = node.textContent.slice(0, selection.anchorOffset)
    const shortcut = SHORTCUTS.find(({ pattern }) => pattern.test(before))
    if (!shortcut) return
    // only at the very start of a line
    const block = node.parentElement?.closest('p, div, h2, h3, h4, blockquote') ?? editorRef.current
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    if (walker.nextNode() !== node) return

    event.preventDefault()
    node.textContent = node.textContent.slice(selection.anchorOffset)
    const range = document.createRange()
    range.setStart(node, 0)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    runCommand(shortcut.command, shortcut.value)
  }

  // never let pasted content bring its own fonts, colours or markup in
  const handlePaste = (event) => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (text) {
      document.execCommand('insertText', false, text)
      emitChange()
    }
  }

  return (
    <div>
      <div role="toolbar" aria-label={`${label ?? 'Text'} formatting`} className={toolbarClass}>
        <ToolbarButton title="Bold (Ctrl/⌘ + B)" Icon={BoldIcon} active={formats.bold} onClick={() => runCommand('bold')} />
        <ToolbarButton title="Italic (Ctrl/⌘ + I)" Icon={ItalicIcon} active={formats.italic} onClick={() => runCommand('italic')} />
        <TextStyleMenu value={formats.block} onChange={(tag) => runCommand('formatBlock', tag)} />
        <span aria-hidden="true" className={toolbarDivider} />
        <ToolbarButton title="Bulleted list" Icon={ListIcon} active={formats.insertUnorderedList} onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton title="Numbered list" Icon={ListOrderedIcon} active={formats.insertOrderedList} onClick={() => runCommand('insertOrderedList')} />
        <ToolbarButton title="Quote" Icon={QuoteIcon} active={formats.block === 'blockquote'} onClick={() => runCommand('formatBlock', 'blockquote')} />
        <span aria-hidden="true" className={toolbarDivider} />
        <button type="button" onMouseDown={keepSelection} onClick={clearFormatting} title="Clear formatting" className={toolbarTextButton()}>
          Clear
        </button>
        <span className="ml-auto hidden px-2 text-[11px] text-zinc-600 lg:block dark:text-zinc-400">Tip: type &quot;- &quot; or &quot;1. &quot; to start a list</span>
      </div>

      <div
        ref={editorRef}
        id={editorId}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        data-placeholder={placeholder}
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`${contentClass} ${editorClassName}`}
      />
    </div>
  )
}

export default BasicRichTextEditor
