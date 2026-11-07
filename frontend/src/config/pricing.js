/* ------------------------------------------------------------------
 * Prices SHOWN in the app. Display only.
 *
 * The amount that is actually charged is decided by Dodo Payments (the product and its localized pricing rules) and
 * is shown on the checkout page. The server only maps "monthly" / "yearly" to a product id; it never reads these
 * numbers, and the browser never sends a price or a product id.
 *
 * UPDATE THIS FILE WHENEVER DODO PRICES CHANGE, so the app and the checkout page keep saying the same thing.
 * (backend/scripts/check-dodo-products.js compares these numbers with your Dodo test products.)
 * ------------------------------------------------------------------ */

export const PRICES = {
  monthly: { usd: 12.99, inr: 499 },
  yearly: { usd: 119, inr: 4999 },
}

export const REGION_IN = 'IN'
export const REGION_INTL = 'INTL'

// region -> which price column leads
const CURRENCY_OF = { [REGION_IN]: 'inr', [REGION_INTL]: 'usd' }
const REGION_LABEL = { [REGION_IN]: 'India', [REGION_INTL]: 'International' }

// Some browsers still report the old name of the Indian time zone.
const INDIA_TIME_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta'])

const readBrowserEnvironment = () => {
  let timeZone = ''
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    timeZone = ''
  }
  const language = typeof navigator === 'undefined' ? '' : navigator.language ?? ''
  return { timeZone, language }
}

/**
 * Which region's price to show FIRST: 'IN' when the time zone is Asia/Kolkata or the browser language is en-IN or
 * hi / hi-*, otherwise 'INTL'. A guess for display only; the real price is decided at checkout by billing country.
 * `environment` ({ timeZone, language }) is for tests; by default it is read from the browser.
 */
export const displayRegion = (environment = readBrowserEnvironment()) => {
  const timeZone = String(environment?.timeZone ?? '').trim()
  const language = String(environment?.language ?? '').trim().toLowerCase()
  if (INDIA_TIME_ZONES.has(timeZone)) return REGION_IN
  if (language === 'en-in' || language === 'hi' || language.startsWith('hi-')) return REGION_IN
  return REGION_INTL
}

/** The money saved by paying yearly, as a whole percentage, for a currency key ('usd' | 'inr'). */
export const savingsPercent = (currency, prices = PRICES) => {
  const monthly = prices.monthly[currency]
  const yearly = prices.yearly[currency]
  if (!(monthly > 0) || !(yearly >= 0)) return 0
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100))
}

/** What a yearly plan costs per month, for display ("about $9.92 a month"). */
export const yearlyPerMonth = (currency, prices = PRICES) => prices.yearly[currency] / 12

/** "$12.99", "$119", "₹4,999". Whole dollar amounts drop the decimals. */
export const formatPrice = (amount, currency) => {
  const isInr = currency === 'inr'
  return new Intl.NumberFormat(isInr ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency: isInr ? 'INR' : 'USD',
    minimumFractionDigits: !isInr && !Number.isInteger(amount) ? 2 : 0,
    maximumFractionDigits: isInr ? 0 : 2,
  }).format(amount)
}

const priceRow = (interval, currency, region, prices) => ({
  region,
  regionLabel: REGION_LABEL[region],
  currency,
  amount: prices[interval][currency],
  text: formatPrice(prices[interval][currency], currency),
  perMonthText: interval === 'yearly' ? formatPrice(yearlyPerMonth(currency, prices), currency) : null,
})

/**
 * Everything the pricing card prints for one interval: the detected region's price first, the other region's second,
 * and the yearly saving for the leading currency.
 */
export const pricingView = (interval, region = REGION_INTL, prices = PRICES) => {
  const lead = region === REGION_IN ? REGION_IN : REGION_INTL
  const other = lead === REGION_IN ? REGION_INTL : REGION_IN
  return {
    primary: priceRow(interval, CURRENCY_OF[lead], lead, prices),
    secondary: priceRow(interval, CURRENCY_OF[other], other, prices),
    savingsPercent: savingsPercent(CURRENCY_OF[lead], prices),
  }
}
