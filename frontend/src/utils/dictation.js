import { correctTrading } from './tradingVocabulary'

// Turns a speech-recognition transcript into clean text for the rich text editor.
// Everything here is pure (no DOM, no editor) so it is easy to test. Putting the text into the Tiptap editor
// (caret, grey preview, "scratch that") lives in ./tiptapDictation.js.

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

// ---------- spacing and capitals around the caret ----------

const SENTENCE_END = /[.!?]\s*$/
const LEADING_PUNCTUATION = /^[.,;:!?)%]/
const ENDS_BEFORE_SPACE = /[\s.,;:!?)]/
// words that keep their capital even in the middle of a sentence
const KEEP_CAPITAL = /^(?:I|I'm|I'll|I've|I'd|Nifty|Sensex|Nasdaq|Bank|Fin|Dow|Fed|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$/
const lowerIfMidSentence = (text) => {
  const [first = ''] = text.split(/\s/, 1)
  return /^[A-Z][a-z']*$/.test(first) && !KEEP_CAPITAL.test(first) ? first.toLowerCase() + text.slice(first.length) : text
}

/**
 * Final wording of one dictated phrase at the caret: adds the missing space, capitalises sentence starts,
 * lowercases a stray capital in the middle of a sentence and fixes "0 75" -> "0.75".
 *
 * @param {{ text: string }} token       a { text } token from parseDictation()
 * @param {object} context
 * @param {string} context.before        character right before the caret ('' at the start of a line)
 * @param {string} context.after         character right after the caret ('' at the end of a line)
 * @param {string} context.textBefore    all text before the caret (to know whether a sentence just ended)
 */
export const shapeDictatedText = (token, { before = '', after = '', textBefore = '' }) => {
  let text = token.text
  if (/^\d{2,}/.test(text) && /(?:^|\s)0$/.test(textBefore)) text = `.${text}`
  if (before === '' || SENTENCE_END.test(textBefore)) text = text.charAt(0).toUpperCase() + text.slice(1)
  else text = lowerIfMidSentence(text)
  if (before && !/\s/.test(before) && !LEADING_PUNCTUATION.test(text)) text = ` ${text}`
  if (after && !ENDS_BEFORE_SPACE.test(after)) text = `${text} `
  return text
}
