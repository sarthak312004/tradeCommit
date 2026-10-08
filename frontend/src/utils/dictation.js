import { correctTrading } from './tradingVocabulary'

// Turns a speech-recognition transcript into clean text inside the trade analysis editor.
// parseDictation() is pure (no DOM) so it is easy to test; the insert/interim helpers below touch the DOM.

// ---------- vocabulary ----------

// Trading terms (breakout, VWAP, Fibonacci retracement, ...) are repaired by ./tradingVocabulary.js.
// Only number formats live here.
const NUMERIC_TERMS = [
  [/\b(?:s and p|s&p|sp|s p)\s*(\d{3,4})\b/gi, 'S&P $1'],
  [/\bs and p\b/gi, 'S&P'],
  [/\b(\d+(?:\.\d+)?)\s*(?:percent|per cent)\b/gi, '$1%']
]

// spoken words that become punctuation ("period" is left alone because it is a real word: "time period")
const SPOKEN_PUNCTUATION = [
  [/\s*\bfull stop\b\s*/gi, '. '],
  [/\s*\bcomma\b\s*/gi, ', '],
  [/\s*\bquestion mark\b\s*/gi, '? '],
  [/\s*\b(?:exclamation mark|exclamation point)\b\s*/gi, '! '],
  [/\s*\bsemicolon\b\s*/gi, '; '],
  [/\s*\bcolon\b\s*/gi, ': ']
]

const FILLERS = /\b(?:u+m+|u+h+|e+r+m+|hmm+|mm+)\b[,.]?\s*/gi

// the capture group keeps which command was said when splitting
const BREAK_COMMAND = /\s*\b(new line|next line|new paragraph|bullet point|next bullet)\b\s*/i

// whole-phrase voice commands
const STOP_COMMAND = /(?:^|[\s,.])(?:stop (?:listening|dictation|dictating)|end dictation)[\s.!]*$/i
const UNDO_COMMAND = /^\s*(?:scratch that|undo that|delete that|undo last|remove that)[\s.!]*$/i

// A pause finishes a phrase, so a phrase that doesn't end in punctuation gets a full stop (or "?" for questions).
// Very short phrases are left alone: they are usually list items or half-sentences.
const QUESTION_START = /^(?:what|why|how|when|where|who|which|did|do|does|should|could|would|can|will)\b/i
const MIN_WORDS_FOR_PERIOD = 4
// a phrase ending on one of these is cut off mid-sentence (the speaker just paused), so the next phrase continues it
const DANGLING_END = /\b(?:and|or|but|also|the|a|an|of|at|to|in|on|for|with|by|from|as|is|are|was|were|be|that|which|because|if|then|than|my|our|its|this|these|those|not|very|more|too|into|about|around|after|before|while|when)$/i
const autoPunctuate = (text) => {
  if (/[.!?:;,\u2022]$/.test(text) || text.split(/\s+/).length < MIN_WORDS_FOR_PERIOD || DANGLING_END.test(text) || /\d$/.test(text)) return text
  return `${text}${QUESTION_START.test(text) ? '?' : '.'}`
}

const ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const DIGIT_WORD = 'zero|one|two|three|four|five|six|seven|eight|nine'
const ONES_PATTERN = Object.keys(ONES).sort((a, b) => b.length - a.length).join('|')
const WHOLE_NUMBER = `(?:${Object.keys(TENS).join('|')})(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|${ONES_PATTERN}|\\d+`

const wholeValue = (words) => {
  const [first, second] = String(words).toLowerCase().split(/[\s-]+/)
  if (/^\d+$/.test(first)) return first
  return String((TENS[first] ?? ONES[first] ?? 0) + (second ? ONES[second] ?? 0 : 0))
}

// "sixty one point eight" -> "61.8", "zero point seven eight six" -> "0.786" (engines usually already write digits;
// this covers the ones that don't)
const spokenDecimals = (text) =>
  text.replace(new RegExp(`\\b(${WHOLE_NUMBER})\\s+point\\s+((?:${DIGIT_WORD}|\\d)(?:\\s+(?:${DIGIT_WORD}|\\d))*)\\b`, 'gi'), (_, whole, fraction) => {
    const digits = fraction.trim().split(/\s+/).map((part) => ONES[part.toLowerCase()] ?? part).join('')
    return `${wholeValue(whole)}.${digits}`
  })

/**
 * "price comma new line stop hit" -> [{ text: 'price,' }, { breaks: 1 }, { text: 'stop hit' }]
 * "scratch that" -> [{ command: 'undo' }];  "that was it stop listening" -> [{ text: 'that was it' }, { command: 'stop' }]
 */
export const parseDictation = (raw) => {
  let text = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return []

  if (UNDO_COMMAND.test(text)) return [{ command: 'undo' }]

  let stopAfter = false
  if (STOP_COMMAND.test(text)) {
    text = text.replace(STOP_COMMAND, '').trim()
    stopAfter = true
  }

  text = text.replace(FILLERS, '')
  text = spokenDecimals(text)
  text = correctTrading(text).text
  for (const [pattern, replacement] of NUMERIC_TERMS) text = text.replace(pattern, replacement)
  for (const [pattern, replacement] of SPOKEN_PUNCTUATION) text = text.replace(pattern, replacement)

  const tokens = []
  text.split(BREAK_COMMAND).forEach((part, index) => {
    if (index % 2 === 1) {
      const command = part.toLowerCase()
      if (command === 'bullet point' || command === 'next bullet') {
        if (!tokens.length || !tokens[tokens.length - 1].breaks) tokens.push({ breaks: 1 })
        tokens.push({ text: '\u2022', bullet: true })
      }
      else tokens.push({ breaks: command === 'new paragraph' ? 2 : 1 })
    } else if (part.trim()) {
      tokens.push({ text: autoPunctuate(part.trim()) })
    }
  })
  if (stopAfter) tokens.push({ command: 'stop' })
  return tokens
}

/**
 * Some engines deliver the same sentence twice, the second time worded slightly differently
 * ("confirming the determination of the fifth wave" / "confirming determination of the fifth wave").
 * True when `text` says (almost) the same as the phrase finished `ageMs` ago.
 */
const ECHO_WINDOW_MS = 8000
const FILLER_WORDS = new Set(['the', 'a', 'an', 'and', 'it', 'is', 'also', 'of', 'to', 'in', 'that', 'this'])
const contentWords = (text) =>
  new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word && !FILLER_WORDS.has(word)))

export const isEchoOf = (text, previous, ageMs) => {
  if (!previous || ageMs > ECHO_WINDOW_MS) return false
  const a = contentWords(text)
  const b = contentWords(previous)
  const smaller = Math.min(a.size, b.size)
  if (smaller < 3) return String(text).trim().toLowerCase() === String(previous).trim().toLowerCase()
  let shared = 0
  for (const word of a) if (b.has(word)) shared += 1
  return shared / smaller >= 0.8
}

// ---------- DOM helpers ----------

const SENTENCE_END = /[.!?]\s*$/
const LEADING_PUNCTUATION = /^[.,;:!?)%]/
const ENDS_BEFORE_SPACE = /[\s.,;:!?)]/
const INLINE_TAGS = /^(B|I|U|EM|STRONG|SPAN|A)$/
// words that keep their capital even in the middle of a sentence
const KEEP_CAPITAL = /^(?:I|I'm|I'll|I've|I'd|Nifty|Sensex|Nasdaq|Bank|Fin|Dow|Fed|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$/
const lowerIfMidSentence = (text) => {
  const [first = ''] = text.split(/\s/, 1)
  return /^[A-Z][a-z']*$/.test(first) && !KEEP_CAPITAL.test(first) ? first.toLowerCase() + text.slice(first.length) : text
}

const INTERIM_ATTR = 'data-dictation-interim'

// the text node (or inline element) a boundary point sits next to, as plain text
const adjacentText = (node) => {
  if (!node) return ''
  if (node.nodeType === Node.TEXT_NODE) return node.data
  if (node.nodeType !== Node.ELEMENT_NODE || node.hasAttribute?.(INTERIM_ATTR)) return ''
  return INLINE_TAGS.test(node.nodeName) ? node.textContent : ''
}

// '' means the caret is at the start of a line / block
const charBefore = (range) => {
  const { startContainer: node, startOffset: offset } = range
  if (node.nodeType === Node.TEXT_NODE) return offset > 0 ? node.data[offset - 1] : ''
  return adjacentText(node.childNodes[offset - 1]).slice(-1)
}

const charAfter = (range) => {
  const { endContainer: node, endOffset: offset } = range
  if (node.nodeType === Node.TEXT_NODE) return offset < node.length ? node.data[offset] : ''
  return adjacentText(node.childNodes[offset]).charAt(0)
}

const textBefore = (editor, range) => {
  const probe = document.createRange()
  probe.selectNodeContents(editor)
  probe.setEnd(range.startContainer, range.startOffset)
  return probe.toString()
}

const endOfEditor = (editor) => {
  // an emptied contenteditable can keep a lone <br>; text after it would start on a blank line
  if (editor.childNodes.length === 1 && editor.firstChild.nodeName === 'BR') editor.replaceChildren()
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  return range
}

const caretRange = (editor, savedRange) => {
  const range = savedRange && editor.contains(savedRange.startContainer) ? savedRange.cloneRange() : endOfEditor(editor)
  range.collapse(false) // never replace text the user selected earlier
  return range
}

/** The editor's HTML without the grey "still being heard" preview text. Always use this when saving. */
export const getCleanHtml = (editor) => {
  if (!editor) return ''
  if (!editor.querySelector(`[${INTERIM_ATTR}]`)) return editor.innerHTML
  const copy = editor.cloneNode(true)
  copy.querySelectorAll(`[${INTERIM_ATTR}]`).forEach((node) => node.remove())
  return copy.innerHTML
}

export const clearInterim = (editor) => {
  editor?.querySelectorAll(`[${INTERIM_ATTR}]`).forEach((node) => node.remove())
}

/**
 * Shows the phrase that is still being heard as grey text at the caret, so words appear the moment they are
 * spoken instead of after the engine finishes. It is replaced by the real text (or removed) on the next call.
 */
export const showInterimText = (editor, savedRange, text) => {
  if (!editor) return
  const preview = String(text ?? '').trim()
  let span = editor.querySelector(`[${INTERIM_ATTR}]`)
  if (!preview) {
    span?.remove()
    return
  }
  if (!span) {
    span = document.createElement('span')
    span.setAttribute(INTERIM_ATTR, 'true')
    span.setAttribute('contenteditable', 'false')
    span.className = 'text-zinc-400 dark:text-zinc-500'
    const range = caretRange(editor, savedRange)
    const before = charBefore(range)
    span.dataset.lead = before && !/\s/.test(before) ? ' ' : ''
    range.insertNode(span)
  }
  span.textContent = `${span.dataset.lead ?? ''}${preview}`
}

/**
 * Inserts dictated text at `savedRange` (the last caret position inside `editor`), or at the end when there
 * is none. Adds the missing space, capitalises sentence starts and understands "new line" / "full stop" / "bullet point".
 * Works on the DOM directly, so it never moves focus away from whatever field the user is typing in.
 *
 * Returns { range, undo } - `range` is the caret after the inserted text (store it as the new saved range) and
 * `undo()` removes exactly what was inserted (returns the caret range from before it). Returns null if nothing was inserted.
 */
export const insertDictatedText = (editor, savedRange, tokens) => {
  const textTokens = tokens.filter((token) => token.text || token.breaks)
  if (!editor || !textTokens.length) return null
  clearInterim(editor)

  const range = caretRange(editor, savedRange)
  const startRange = range.cloneRange()
  const inserted = []

  for (const token of textTokens) {
    if (token.breaks) {
      for (let i = 0; i < token.breaks; i += 1) {
        const lineBreak = document.createElement('br')
        range.insertNode(lineBreak)
        range.setStartAfter(lineBreak)
        range.collapse(true)
        inserted.push(lineBreak)
      }
      continue
    }

    const before = charBefore(range)
    const startsSentence = !token.bullet && (before === '' || SENTENCE_END.test(textBefore(editor, range)))
    let text = token.text
    if (/^\d{2,}/.test(text) && /(?:^|\s)0$/.test(textBefore(editor, range))) text = `.${text}`
    if (startsSentence) text = text.charAt(0).toUpperCase() + text.slice(1)
    else if (!token.bullet) text = lowerIfMidSentence(text)
    if (before && !/\s/.test(before) && !LEADING_PUNCTUATION.test(text)) text = ` ${text}`
    if (token.bullet) text = `${text} `
    const after = charAfter(range)
    if (after && !token.bullet && !ENDS_BEFORE_SPACE.test(after)) text = `${text} `

    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStart(node, node.length)
    range.collapse(true)
    inserted.push(node)
  }

  // if the editor has the caret, move it past the new text (otherwise typing would land before it)
  if (document.activeElement === editor) {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range.cloneRange())
  }

  const undo = () => {
    const anchor = inserted[0]
    const parent = anchor?.parentNode
    const index = parent ? Array.prototype.indexOf.call(parent.childNodes, anchor) : -1
    inserted.forEach((node) => node.parentNode?.removeChild(node))
    if (!parent || !editor.contains(parent)) return startRange
    const restored = document.createRange()
    restored.setStart(parent, Math.min(index, parent.childNodes.length))
    restored.collapse(true)
    return restored
  }

  return { range, undo }
}