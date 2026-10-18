import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, Selection, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { shapeDictatedText } from './dictation'

// Puts dictated text into a Tiptap editor. The words being heard right now are drawn as a grey widget at the
// caret (a decoration, so it is never part of the document and can never end up in the saved HTML); finished
// phrases are inserted as real text.

const interimKey = new PluginKey('dictationInterim')

/** Extension that draws the grey "still being heard" preview at the caret. */
export const DictationInterim = Extension.create({
  name: 'dictationInterim',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: interimKey,
        state: {
          init: () => ({ text: '', lead: '' }),
          apply: (transaction, value) => transaction.getMeta(interimKey) ?? value
        },
        props: {
          decorations(state) {
            const { text, lead } = interimKey.getState(state)
            if (!text) return DecorationSet.empty
            const widget = Decoration.widget(
              state.selection.to,
              () => {
                const span = document.createElement('span')
                span.className = 'tc-dictation-interim'
                span.setAttribute('contenteditable', 'false')
                span.textContent = `${lead}${text}`
                return span
              },
              { side: 1, ignoreSelection: true, key: `interim:${lead}${text}` }
            )
            return DecorationSet.create(state.doc, [widget])
          }
        }
      })
    ]
  }
})

const setInterim = (editor, value) => {
  if (!editor || editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(interimKey, value))
}

export const clearInterim = (editor) => {
  if (!editor || editor.isDestroyed) return
  if (interimKey.getState(editor.state)?.text) setInterim(editor, { text: '', lead: '' })
}

// '\n' (a line break) counts as "start of a line", like the beginning of a paragraph
const charOrEmpty = (char) => (!char || char === '\n' ? '' : char)

const caretContext = (state) => {
  const { $from, to } = state.selection
  const parent = $from.parent
  const before = charOrEmpty(parent.textBetween(0, $from.parentOffset, '', '\n').slice(-1))
  const after = charOrEmpty(parent.textBetween($from.parentOffset, parent.content.size, '', '\n').charAt(0))
  return { before, after, textBefore: state.doc.textBetween(0, to, '\n', '\n') }
}

/** Shows the phrase that is still being heard as grey text at the caret. An empty `text` removes it. */
export const showInterimText = (editor, text) => {
  if (!editor || editor.isDestroyed) return
  const preview = String(text ?? '').trim()
  if (!preview) {
    clearInterim(editor)
    return
  }
  const { before } = caretContext(editor.state)
  setInterim(editor, { text: preview, lead: before && !/\s/.test(before) ? ' ' : '' })
}

// "bullet point": start a bullet list at the caret, or add the next item when already inside a list
const startBullet = (editor) => {
  if (editor.isActive('taskItem')) {
    editor.commands.splitListItem('taskItem')
  } else if (editor.isActive('listItem')) {
    editor.commands.splitListItem('listItem')
  } else {
    if (editor.state.selection.$from.parent.content.size > 0) editor.commands.splitBlock()
    editor.commands.toggleBulletList()
  }
}

const insertText = (editor, token) => {
  const { state, view } = editor
  const pos = state.selection.to
  const text = shapeDictatedText(token, caretContext(state))
  const transaction = state.tr.insertText(text, pos)
  transaction.setSelection(TextSelection.create(transaction.doc, pos + text.length))
  transaction.setMeta(interimKey, { text: '', lead: '' })
  view.dispatch(transaction)
}

/**
 * Inserts dictated tokens (from parseDictation) at the caret and understands "new line" / "new paragraph" /
 * "bullet point". Works without taking focus away from the field the user is typing in, and never replaces
 * text the user has selected.
 *
 * Returns { from, to } of what was inserted, so "scratch that" can remove it again (see removeDictated),
 * or null when nothing was inserted.
 */
export const insertDictation = (editor, tokens) => {
  const parts = tokens.filter((token) => token.text || token.breaks)
  if (!editor || editor.isDestroyed || !parts.length) return null
  clearInterim(editor)

  // continue after the selection, and never put text next to a screenshot (the caret has to be in a text block)
  const { selection, doc } = editor.state
  if (!selection.empty || !selection.$to.parent.isTextblock) {
    const target = selection.$to.parent.isTextblock ? TextSelection.create(doc, selection.to) : Selection.atEnd(doc)
    editor.view.dispatch(editor.state.tr.setSelection(target))
  }

  const startPos = editor.state.selection.to
  parts.forEach((token, index) => {
    if (token.breaks) {
      if (parts[index + 1]?.bullet) return // the bullet starts its own line
      if (token.breaks >= 2) editor.commands.splitBlock()
      else editor.commands.setHardBreak()
    } else if (token.bullet) {
      startBullet(editor)
    } else {
      insertText(editor, token)
    }
  })

  const endPos = editor.state.selection.to
  return endPos > startPos ? { from: startPos, to: endPos } : null
}

/** "scratch that": removes a phrase inserted by insertDictation. */
export const removeDictated = (editor, { from, to }) => {
  if (!editor || editor.isDestroyed || to <= from || to > editor.state.doc.content.size) return
  editor.view.dispatch(editor.state.tr.delete(from, to))
}

/**
 * Keeps the remembered ranges pointing at the same text while the user keeps typing.
 * `mapping` is transaction.mapping. Ranges that have been deleted are dropped.
 */
export const mapDictatedRanges = (ranges, mapping) =>
  ranges
    .map(({ from, to }) => ({ from: mapping.map(from, 1), to: mapping.map(to, -1) }))
    .filter(({ from, to }) => to > from)
