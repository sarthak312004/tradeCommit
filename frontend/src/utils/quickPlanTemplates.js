// Optional templates and a "Try an example" sample for Quick Plan.
//
// A template only changes the guidance (placeholder) text shown in the empty fields. It never writes a value, so choosing
// one can never put text in a plan the user did not type. The example is shown read-only; the user can copy it into
// *empty* fields as a starting point, and even then nothing is saved until they press Create plan.

export const BLANK_TEMPLATE_ID = 'blank'

export const QUICK_TEMPLATES = [
  {
    id: BLANK_TEMPLATE_ID,
    name: 'Blank',
    description: 'Start from nothing. Fill only what helps.',
    placeholders: {}
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Price is pressing a level and you want a confirmed break.',
    placeholders: {
      setup: 'Which level is price compressing under, and why should it break?',
      levels: 'Breakout level\nNearest support (stop area)\nFirst target',
      entry: 'What counts as a real break? A close, a retest, a volume spike?',
      invalidation: 'Where does a failed break show itself? Back inside the range?',
      risk: 'Position size, and max loss if the break fails.'
    }
  },
  {
    id: 'pullback',
    name: 'Pullback',
    description: 'Join an existing trend after a dip.',
    placeholders: {
      setup: 'What is the trend, and where do you expect it to pause?',
      levels: 'Trend support or moving average\nPrior swing high\nTarget',
      entry: 'What do you need to see at the pullback? A hold, a reversal candle?',
      invalidation: 'How deep can the dip go before the trend is broken?',
      risk: 'Stop distance and size so a stop-out is a small, planned loss.'
    }
  },
  {
    id: 'reversal',
    name: 'Reversal',
    description: 'Fade an extended move at a key level.',
    placeholders: {
      setup: 'What looks stretched, and what level could stop it?',
      levels: 'Reversal zone\nStop beyond the zone\nTarget back to the mean',
      entry: 'What confirms the turn before you act? Do not catch it blindly.',
      invalidation: 'If price keeps going through the zone, you are out.',
      risk: 'Keep it small. Reversals are lower probability.'
    }
  },
  {
    id: 'range',
    name: 'Range day',
    description: 'No clear trend. Trade the edges, not the middle.',
    placeholders: {
      setup: 'Where are the range edges, and what makes you think it holds?',
      levels: 'Range high\nRange low\nMidpoint (no-trade zone)',
      entry: 'Only at the edges, and only with a rejection.',
      invalidation: 'A close outside the range ends the plan.',
      risk: 'Small size at each edge, and a daily loss limit.'
    }
  }
]

export const getTemplate = (id) => QUICK_TEMPLATES.find((template) => template.id === id) ?? QUICK_TEMPLATES[0]

/** A made-up illustration. It lives only in the UI and is never sent anywhere unless the user copies it and saves. */
export const EXAMPLE_PLAN = Object.freeze({
  title: 'Example: Nifty opening range breakout',
  values: Object.freeze({
    setup: 'Nifty is coiling just under yesterday\u2019s high after a three-day pullback. If buyers take it out cleanly, I expect a push toward the next swing high.',
    bias: 'Bullish',
    levels: '- Resistance 24,800\n- Support 24,550\n- Target 25,100',
    entry: 'A 15-minute candle closes above 24,800 on above-average volume. No entry on a wick alone.',
    invalidation: 'Price closes back below 24,700. I exit, and I do not re-enter on the same idea today.',
    risk: '1% of capital. Stop at 24,700. Max two attempts.'
  })
})
