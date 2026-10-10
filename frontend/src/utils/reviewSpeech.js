// Turns a mentor review into short, speakable chunks for the browser's text-to-speech.
// Chunks are sentence-aligned so the voice keeps natural phrasing across each one.

// Big enough that a chunk is usually a few whole sentences (fewer gaps between utterances).
// The speech hook re-splits smaller for voices that cut off long text (Google's online voices in Chrome).
const MAX_CHUNK = 300

const DISCIPLINE = {
  followed: 'You followed your rules this week.',
  mostly_followed: 'You mostly followed your rules this week.',
  partly_followed: 'You only partly followed your rules this week.',
  not_followed: 'You did not follow your rules this week.',
  cannot_assess: "There wasn't enough in your logs to judge your discipline."
}

const STRATEGY = {
  keep: 'My advice is to keep your strategy as it is.',
  tweak: 'My advice is to tweak your strategy.',
  rethink: 'My advice is to rethink your strategy.'
}

const RULE_STATUS = { followed: 'You followed it.', broken: 'You broke it.', unclear: "I can't verify it from your logs." }

const ORDINALS = ['First', 'Second', 'Third']

// small fixes so numbers and symbols are read the way a person would say them
const speakable = (text) =>
  String(text ?? '')
    .replace(/&/g, ' and ')
    .replace(/\bT(\d+)\b/g, 'trade $1')
    .replace(/(^|[\s(])-(?=\d|[A-Z]{3}\b)/g, '$1minus ')
    .replace(/(^|[\s(])\+(?=[\dA-Z])/g, '$1plus ')
    .replace(/\bRRR\b/g, 'R R R')
    .replace(/(\d)\s?R\b/g, '$1 R')
    .replace(/\s+/g, ' ')
    .trim()

const endSentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`)

/** Splits text at sentence ends, then packs sentences into chunks of at most MAX_CHUNK characters. */
export const chunkText = (text, max = MAX_CHUNK) => {
  const sentences = speakable(text).split(/(?<=[.!?])\s+/).filter(Boolean)
  const chunks = []
  let current = ''

  const push = (piece) => {
    if (current && `${current} ${piece}`.length > max) {
      chunks.push(current)
      current = piece
    } else {
      current = current ? `${current} ${piece}` : piece
    }
  }

  for (const sentence of sentences) {
    if (sentence.length <= max) {
      push(sentence)
      continue
    }
    // one very long sentence: break it at commas / semicolons, then at spaces as a last resort
    for (const part of sentence.split(/(?<=[,;:])\s+/)) {
      if (part.length <= max) {
        push(part)
        continue
      }
      let rest = part
      while (rest.length > max) {
        const cut = rest.lastIndexOf(' ', max)
        const at = cut > 40 ? cut : max
        push(rest.slice(0, at).trim())
        rest = rest.slice(at).trim()
      }
      if (rest) push(rest)
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/** Returns [{ label, text }]: one entry per spoken chunk, labelled with the section it belongs to. */
export const buildReviewSpeech = (review) => {
  if (!review) return []

  const sections = []
  const add = (label, parts) => {
    const text = parts.filter(Boolean).join(' ')
    if (text.trim()) sections.push({ label, text })
  }

  add('Summary', [endSentence(review.headline ?? ''), review.summary])

  const discipline = review.discipline ?? {}
  add('Discipline', [
    DISCIPLINE[discipline.verdict] ?? DISCIPLINE.cannot_assess,
    discipline.score !== null && discipline.score !== undefined ? `That is about ${discipline.score} percent of the rules I could check.` : '',
    discipline.explanation
  ])

  if (review.ruleChecks?.length) {
    add(
      'Rule checks',
      review.ruleChecks.map((check) => `${endSentence(check.rule)} ${RULE_STATUS[check.status] ?? ''} ${check.evidence ?? ''}`)
    )
  }

  if (review.strengths?.length) {
    add('What went well', ['What went well.', ...review.strengths.map((item) => `${endSentence(item.title)} ${item.detail ?? ''}`)])
  }

  if (review.issues?.length) {
    add('Where to work', ['Where to work.', ...review.issues.map((item) => `${endSentence(item.title)} ${item.detail ?? ''}`)])
  }

  const strategy = review.strategyFeedback ?? {}
  add('Your strategy', [
    STRATEGY[strategy.verdict] ?? '',
    strategy.reasoning,
    strategy.suggestedChanges?.length ? `Worth testing. ${strategy.suggestedChanges.map(endSentence).join(' ')}` : '',
    strategy.marketAdaptation ? `On adapting to the market. ${strategy.marketAdaptation}` : ''
  ])

  if (review.nextWeek?.length) {
    add('Next week', ['For next week.', ...review.nextWeek.map((action, index) => `${ORDINALS[index] ?? 'Also'}, ${endSentence(action)}`)])
  }

  add('Closing note', [review.mentorNote])

  return sections.flatMap(({ label, text }) => chunkText(text).map((chunk) => ({ label, text: chunk })))
}
