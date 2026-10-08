// Trading vocabulary for voice dictation.
//
// Speech engines are trained on everyday speech, so they turn "retracement" into "tracement", "VWAP" into "we wap"
// and "engulfing" into "and gulfing". This module repairs that after the fact:
//   1. context fixes   - mishearings that depend on the words around them
//   2. glossary        - every term below is matched in its spelling variants (spaces, hyphens, plurals, spelled-out
//                        letters) and in the wrong ways engines commonly write it
//   3. sound-alike     - for long, distinctive terms, anything that *sounds* like the term is repaired too
//
// To add a term: t('Canonical spelling', 'wrong way 1, wrong way 2', 'f'). Aliases are comma separated. Flags:
//   f = also match by sound (use only for long, unusual words)    x = canonical spelling only, no spacing variants

const GLOSSARY = []
const t = (canonical, aliases = '', flags = '') => GLOSSARY.push({ canonical, aliases: aliases ? aliases.split(',').map((a) => a.trim()) : [], flags })

// ---------- price action & structure ----------
t('breakout', 'break out, work out, workout, brake out')
t('breakdown', '', 'x')
t('fakeout', 'fake out, fake-out')
t('pullback', 'pull back, pool back')
t('retest', 're test')
t('retracement', 'tracement, re tracement, retrace meant, retrace mint', 'f')
t('consolidation', '', 'f')
t('range-bound', 'range bound')
t('sideways', 'side ways')
t('uptrend', 'up trend')
t('downtrend', 'down trend')
t('trendline', 'trend line')
t('gap up', 'gap-up')
t('gap down', 'gap-down')
t('gap fill', 'gap-fill')
t('bullish', 'bull ish')
t('bearish', 'bear ish, bare ish')
t('oversold', 'over sold')
t('overbought', 'over bought')
t('timeframe', 'time frame')
t('higher high', 'hire high')
t('higher low', 'hire low')
t('lower high', 'lower hi')
t('lower low', 'lower lo')
t('all-time high', 'all time high')
t('all-time low', 'all time low')
t('52-week high', 'fifty two week high')
t('52-week low', 'fifty two week low')
t('pre-market', 'pre market, premarket')
t('after-hours', 'after hours')
t('opening range', '')
t('support zone', '')
t('resistance zone', '')
t('demand zone', '')
t('supply zone', '')

// ---------- candlesticks ----------
t('candlestick', 'candle stick, candle sticks', 'f')
t('engulfing', 'and gulfing, in gulfing, and golfing, engulf in, in golfing', 'f')
t('doji', 'dojo, dojee, dojy')
t('hammer')
t('inverted hammer')
t('hanging man')
t('shooting star')
t('morning star')
t('evening star')
t('harami', 'ha rami, haramy, harmi, harammi, haram me')
t('marubozu', 'maru bozu, maribozu, marubozo, maru bozo, maribozo, marabozu')
t('spinning top')
t('pin bar', 'pinbar, pin bars')
t('inside bar', 'insidebar')
t('outside bar', 'outsidebar')
t('tweezer top')
t('tweezer bottom')
t('three white soldiers')
t('three black crows')
t('piercing line')
t('dark cloud cover')

// ---------- chart patterns ----------
t('J-hook', 'j hook, jay hook, jhook, j-hook')
t('cup and handle', 'cup in handle, cup and handel, cup n handle, cup and handled')
t('head and shoulders', 'head in shoulders, head and shoulder, head n shoulders')
t('inverse head and shoulders', 'inverted head and shoulders, reverse head and shoulders')
t('double top')
t('double bottom')
t('triple top')
t('triple bottom')
t('rounding bottom')
t('rising wedge')
t('falling wedge')
t('ascending triangle')
t('descending triangle')
t('symmetrical triangle', 'symmetric triangle, symmetrical triangular')
t('bull flag')
t('bear flag')
t('pennant', 'pendant')
t('golden cross')
t('death cross')
t('golden ratio')
t('golden pocket')

// ---------- Fibonacci ----------
t('Fibonacci retracement', 'february retracement, february tracement, fib retracement, fibo retracement, fibonaci retracement, fibonacci tracement, fibonacci re tracement, fibonachi retracement')
t('Fibonacci extension', 'fib extension, fibo extension, fibonaci extension')
t('Fibonacci', 'fibonaci, fibbonacci, fibonachi, fibo nachi, fibro nacci, fiber nachi')
t('Fib', 'fibs')

// ---------- Elliott wave & Wyckoff ----------
t('Elliott wave', 'elliot wave, eliot wave, ellie ott wave, ellie oh wave, elliott waves, elliot waves')
t('impulse wave')
t('corrective wave')
t('Wyckoff', 'wycoff, wy cough, why cough, wickoff, y cough, vyckoff, wy koff, wycough')
t('accumulation phase')
t('distribution phase')
t('upthrust', 'up thrust')
t('Dow theory')

// ---------- indicators ----------
t('stochastic', 'stock astic, stock astick, stoke astic, stochastics', 'f')
t('Bollinger Bands', 'bolinger bands, ballinger bands, bowling bands, bollinger band, bolinger band, bowlinger bands', 'f')
t('Ichimoku', 'itchy moku, ichi moku, iki moku, ichimoko, ichimuku, ichi mokku, icky moku')
t('Supertrend', 'super trend')
t('Heikin Ashi', 'hiking ashi, hiken ashi, haiken ashi, heiken ashi, hike in ashi, hi can ashi, heikin ashe')
t('Parabolic SAR', 'p sar, parabolic sar')
t('pivot point', 'pivot points')
t('central pivot range', 'central pivot ranges')
t('moving average', '')
t('volume profile', '')
t('open interest', '')
t('put-call ratio', 'put call ratio')
t('VWAP', 'v wap, vee wap, we wap, v-wap, v w a p, vwapp')
t('MACD', 'mac d, mack dee, mac dee, mac-d, max d')
t('RSI', 'are s i, our s i')
t('EMA', 'ee em ay, ee ma, eema')
t('SMA', 'ess em ay')
t('ATR', 'a t r, ay tee are')
t('ADX', 'a d x')
t('OBV', 'o b v')
t('CCI', 'c c i')
t('VIX', 'vicks, vix, v i x')
t('India VIX', 'india vicks, india vix')

// ---------- smart money / market structure ----------
t('order block', 'order blog, order blocks')
t('breaker block')
t('mitigation block')
t('fair value gap', 'fair value gaps')
t('imbalance', '')
t('liquidity sweep')
t('liquidity grab')
t('stop hunt')
t('inducement')
t('break of structure', 'break of structures')
t('change of character')
t('market structure shift')
t('CHoCH', 'choch, choc, chock, chok')
t('killzone', 'kill zone')
t('order flow')
t('supply and demand', '')
t('liquidity pool')
t('equal highs')
t('equal lows')
t('premium and discount')

// ---------- orders, risk & performance ----------
t('stop loss', 'stoploss, stop-loss, stop lost, stop laws, stoplos, stop loss')
t('trailing stop loss', 'trailing stoploss, trailing stop-loss, trailing stop lost, trailing s l')
t('take profit', 'takeprofit, take-profit, take prophet, take profits')
t('breakeven', 'break even, break-even')
t('risk-reward', 'risk reward, risk to reward, risk/reward, r r r, risk reward ratio')
t('R-multiple', 'r multiple, are multiple, our multiple')
t('drawdown', 'draw down')
t('slippage', 'slip age')
t('limit order')
t('market order')
t('stop limit order')
t('bracket order')
t('position sizing')
t('position size')
t('risk per trade')
t('win rate')
t('profit factor')
t('expectancy')
t('intraday', 'intra day, intra-day')
t('overtrading', 'over trading')
t('scalping', 'scalp ping')
t('revenge trading')
t('averaging down')
t('pyramiding', 'pyramid ing')
t('P&L', 'p and l, p & l, pnl, p n l, profit and loss, pee and ell')
t('FOMO', 'fear of missing out, fo mo')

// ---------- Indian markets ----------
t('Nifty 50', 'nifty fifty, nifti fifty, nifty 50')
t('Nifty', 'nifti, niftie')
t('Bank Nifty', 'bank nifti, bank niftie, banknifty')
t('Fin Nifty', 'fin nifti, finnifty')
t('Midcap Nifty', 'mid cap nifty, midcap nifti')
t('GIFT Nifty', 'gift nifti')
t('Sensex', 'sense x, sensex, sens ex')
t('F&O', 'f and o, f & o, fno, f n o, futures and options')
t('SEBI', 'sebi, say bee, se bi')
t('expiry', 'expiry')
t('strike price')
t('theta decay')
t('iron condor', 'iron condo, iron conder')
t('straddle')
t('strangle')
t('short covering')
t('long buildup', 'long build up, long build-up')
t('short buildup', 'short build up, short build-up')

// ---------- global markets ----------
t('Nasdaq', 'nas dak, nas daq, naz dak, nasdack')
t('Dow Jones', 'dow jones')
t('forex', 'for ex, fore ex, foreign exchange')
t('EUR/USD', 'euro dollar, eur usd, e u r u s d, euro usd')
t('GBP/USD', 'pound dollar, gbp usd, g b p u s d')
t('USD/JPY', 'dollar yen, usd jpy, u s d j p y')
t('XAU/USD', 'xau usd, x a u usd, x a u u s d')
t('Bitcoin', 'bit coin')
t('Ethereum', 'ether rium, ethereum')
t('London session')
t('New York session')
t('Asian session')
t('London open')
t('New York open')

// ---------- acronyms (also matched when spelled out: "r s i", "a t m") ----------
const ACRONYMS =
  'SL TP RR RRR ATH EOD FUD BTST ROI OCO ITM OTM ATM NSE BSE MCX FII DII HFT DXY BTC ETH SMA EMA RSI BOS MSS FVG ICT SMC VSA POC VAH ORB PCR CPR OI'
for (const acronym of ACRONYMS.split(' ')) if (!GLOSSARY.some((entry) => entry.canonical === acronym)) t(acronym)

// ---------- compile ----------

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordsOf = (phrase) => phrase.split(/[\s/-]+/).filter(Boolean)
const isAcronym = (canonical) => /^[A-Z0-9&/]+$/.test(canonical) && /[A-Z]/.test(canonical)
const SUFFIX = '(s|es|ed|ing)?'

const compile = ({ canonical, aliases, flags }) => {
  const exact = flags.includes('x')
  const forms = [exact ? escape(canonical) : wordsOf(canonical).map(escape).join('[\\s/-]?')]
  for (const alias of aliases) forms.push(wordsOf(alias).map(escape).join('[\\s/-]+'))
  // "r s i" / "R.S.I" -> RSI
  if (isAcronym(canonical) && /^[A-Z]{3,5}$/.test(canonical)) forms.push(canonical.split('').join('[\\s.]?'))
  const acronym = isAcronym(canonical)
  return {
    canonical,
    acronym,
    words: wordsOf(canonical).length,
    size: forms.join('').length,
    fuzzy: flags.includes('f'),
    regex: new RegExp(`\\b(?:${forms.join('|')})${acronym ? '()' : SUFFIX}\\b`, 'gi')
  }
}

// longer terms first, so "trailing stop loss" is handled before "stop loss"
const RULES = GLOSSARY.map(compile).sort((a, b) => b.words - a.words || b.size - a.size)

// ---------- context fixes (depend on the surrounding words) ----------

const RATIO_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6 }

const CONTEXT_FIXES = [
  [/\b(?:that|at) (?:the )?(?:poor|pour|or|oh|over) ?sold\b/gi, 'at the oversold'],
  [/\bthat (over[- ]?sold|over[- ]?bought)\b/gi, 'at the $1'],
  [/\b(?:that|at the|at) sold\b/gi, 'at oversold'],
  [/\bcurdling\b/gi, 'curling'],
  [/\bdetermination of (?=(?:the )?\w+ wave)/gi, 'termination of '],
  [/\bbreak down(?=\s+(?:of|candle|level|area|zone)\b)/gi, 'breakdown'],
  [/\b(?:1|one)\s*(?:to|is to|:)\s*(\d|two|three|four|five|six)(?=\s+(?:risk|rr\b|r r|rrr|reward))/gi, (_, n) => `1:${RATIO_WORDS[n.toLowerCase()] ?? n}`],
  [/^is overall\b/i, 'The overall']
]

// ---------- sound-alike matching ----------

// Rough phonetic key: similar consonants share a letter, vowels and h/w/y drop out, repeats collapse.
// "stochastic" and "stock astic" both become "stkstk".
const KEY_MAP = { b: 'p', p: 'p', d: 't', t: 't', g: 'k', k: 'k', c: 'k', q: 'k', j: 'k', f: 'f', v: 'f', s: 's', z: 's', m: 'n', n: 'n', l: 'l', r: 'r', x: 'ks' }

const phoneticKey = (word) => {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '').replace(/ph/g, 'f').replace(/ck/g, 'k')
  let key = ''
  for (let i = 0; i < letters.length; i += 1) {
    const letter = letters[i]
    const mapped = i === 0 && 'aeiou'.includes(letter) ? '*' : KEY_MAP[letter] ?? (i === 0 && !'aeiouhwy'.includes(letter) ? letter : '')
    if (mapped && key[key.length - 1] !== mapped) key += mapped
  }
  return key
}

const editDistance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = next
    }
  }
  return row[b.length]
}

const FUZZY_TERMS = RULES.filter((rule) => rule.fuzzy).map((rule) => {
  const letters = rule.canonical.toLowerCase().replace(/[^a-z]/g, '')
  return { canonical: rule.canonical, letters, key: phoneticKey(letters) }
})

const findSoundAlike = (letters) => {
  const lower = letters.toLowerCase()
  const key = phoneticKey(lower)
  if (key.length < 6) return null
  for (const term of FUZZY_TERMS) {
    if (lower.startsWith(term.letters) || key[0] !== term.key[0] || Math.abs(lower.length - term.letters.length) > 4) continue
    const allowed = term.key.length >= 10 ? 2 : 1
    if (editDistance(key, term.key) <= allowed) return term
  }
  return null
}

// tries windows of 3, 2, then 1 words: "and gulfing" -> engulfing
const soundAlikePass = (text, onHit) => {
  const parts = text.split(/(\s+)/) // words at even positions, spacing at odd positions
  const out = []
  let i = 0
  while (i < parts.length) {
    let replaced = false
    for (let size = 3; size >= 1 && !replaced; size -= 1) {
      const end = i + (size - 1) * 2
      if (end >= parts.length) continue
      const words = []
      for (let k = 0; k < size; k += 1) words.push(parts[i + k * 2])
      if (words.slice(0, -1).some((word) => /[^A-Za-z]$/.test(word)) || words.some((word) => /\d/.test(word) || !/[A-Za-z]/.test(word))) continue
      const letters = words.map((word) => word.replace(/[^A-Za-z]/g, '')).join('')
      const term = findSoundAlike(letters)
      if (!term) continue
      const trailing = (words[size - 1].match(/[^A-Za-z]+$/) ?? [''])[0]
      out.push(term.canonical + trailing)
      onHit()
      i = end
      replaced = true
    }
    if (!replaced) out.push(parts[i])
    i += 1
    if (i < parts.length) {
      out.push(parts[i])
      i += 1
    }
  }
  return out.join('')
}

// ---------- public API ----------

/** Repairs trading terms in a transcript. Returns the corrected text and how many trading terms it contains. */
export const correctTrading = (raw) => {
  let text = String(raw ?? '')
  let hits = 0
  for (const [pattern, replacement] of CONTEXT_FIXES) text = text.replace(pattern, replacement)
  for (const rule of RULES) {
    text = text.replace(rule.regex, (match, suffix = '') => {
      hits += 1
      return rule.canonical + (rule.acronym ? '' : suffix)
    })
  }
  text = soundAlikePass(text, () => {
    hits += 1
  })
  return { text, hits }
}

/** How many trading terms a transcript contains - used to pick the best of the engine's alternative readings. */
export const countTradingTerms = (text) => correctTrading(text).hits
