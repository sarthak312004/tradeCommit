import { useEditorState } from '@tiptap/react'
import { BoldIcon, ImageIcon, ItalicIcon, ListIcon, ListOrderedIcon, MicIcon, QuoteIcon } from '../../../utils/Icons.jsx'
import { SHORTCUT_LABEL } from '../../../hooks/useVoiceDictation'
import { MOD_LABEL } from '../../../hooks/useFormShortcuts'
import TextStyleMenu from '../TextStyleMenu'
import { toolbarClass, toolbarDivider, toolbarIconButton } from '../formStyles'
import LinkMenu from './LinkMenu'
import { ChecklistIcon, CodeIcon, DividerIcon, StrikeIcon, UnderlineIcon } from './tiptapIcons.jsx'

// keep the text selection inside the editor when a toolbar button is pressed
const keepSelection = (event) => event.preventDefault()

const IDLE = { bold: false, italic: false, underline: false, strike: false, code: false, link: false, bulletList: false, orderedList: false, taskList: false, blockquote: false, block: 'p' }

const readFormats = (editor) => {
  if (!editor) return IDLE
  const heading = [2, 3, 4].find((level) => editor.isActive('heading', { level }))
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    code: editor.isActive('code'),
    link: editor.isActive('link'),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    blockquote: editor.isActive('blockquote'),
    block: heading ? `h${heading}` : 'p'
  }
}

function ToolbarButton({ title, Icon, onClick, active, disabled }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={keepSelection} onClick={onClick} className={toolbarIconButton(active)}>
      <Icon className="h-4 w-4" />
    </button>
  )
}

const Divider = () => <span aria-hidden="true" className={toolbarDivider} />

/**
 * Formatting strip above the editor. Same look as before (sticky, h-8 controls, neutral pressed state);
 * every button shows a real pressed state for the text at the caret.
 *
 * @param {object}   editor           Tiptap editor (null while it is starting)
 * @param {string}   label            used for the toolbar's accessible name
 * @param {number}   pendingUploads   screenshots still uploading
 * @param {Function} onAddScreenshot  opens the file picker
 * @param {object}   dictation        result of useVoiceDictation()
 */
function EditorToolbar({ editor, label, onAddScreenshot, dictation }) {
  const formats = useEditorState({ editor, selector: ({ editor: current }) => readFormats(current) })
  const run = (command) => () => editor && command(editor.chain().focus()).run()

  const applyBlock = (tag) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (tag === 'p') chain.setParagraph().run()
    else chain.setHeading({ level: Number(tag.slice(1)) }).run()
  }

  return (
    <div role="toolbar" aria-label={`${label} formatting`} className={toolbarClass}>
      <TextStyleMenu value={formats.block} onChange={applyBlock} />
      <Divider />
      <ToolbarButton title={`Bold (${MOD_LABEL} + B)`} Icon={BoldIcon} active={formats.bold} onClick={run((chain) => chain.toggleBold())} />
      <ToolbarButton title={`Italic (${MOD_LABEL} + I)`} Icon={ItalicIcon} active={formats.italic} onClick={run((chain) => chain.toggleItalic())} />
      <ToolbarButton title={`Underline (${MOD_LABEL} + U)`} Icon={UnderlineIcon} active={formats.underline} onClick={run((chain) => chain.toggleUnderline())} />
      <ToolbarButton title={`Strikethrough (${MOD_LABEL} + Shift + S)`} Icon={StrikeIcon} active={formats.strike} onClick={run((chain) => chain.toggleStrike())} />
      <ToolbarButton title={`Inline code (${MOD_LABEL} + E)`} Icon={CodeIcon} active={formats.code} onClick={run((chain) => chain.toggleCode())} />
      <LinkMenu editor={editor} active={formats.link} />
      <Divider />
      <ToolbarButton title="Bulleted list" Icon={ListIcon} active={formats.bulletList} onClick={run((chain) => chain.toggleBulletList())} />
      <ToolbarButton title="Numbered list" Icon={ListOrderedIcon} active={formats.orderedList} onClick={run((chain) => chain.toggleOrderedList())} />
      <ToolbarButton title="Checklist" Icon={ChecklistIcon} active={formats.taskList} onClick={run((chain) => chain.toggleTaskList())} />
      <ToolbarButton title="Quote" Icon={QuoteIcon} active={formats.blockquote} onClick={run((chain) => chain.toggleBlockquote())} />
      <ToolbarButton title="Divider" Icon={DividerIcon} onClick={run((chain) => chain.setHorizontalRule())} />
      <Divider />
      <button type="button" title="Add screenshot" aria-label="Add screenshot" onMouseDown={keepSelection} onClick={onAddScreenshot} className={toolbarIconButton()}>
        <ImageIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={dictation.toggle}
        disabled={!dictation.isSupported}
        aria-pressed={dictation.isListening}
        title={dictation.isSupported ? `${dictation.isListening ? 'Stop dictation' : 'Dictate'} (${SHORTCUT_LABEL})` : "Voice input isn't supported in this browser. Try Chrome, Edge or Safari."}
        aria-label={dictation.isListening ? 'Stop dictation' : 'Dictate'}
        className={toolbarIconButton(dictation.isListening)}
      >
        <MicIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

export default EditorToolbar
