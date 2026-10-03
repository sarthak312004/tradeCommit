/* Currencies a journal can be created with. Amounts are formatted with Intl, so
 * adding a currency is a one-line change here (any ISO 4217 code works). */

export const DEFAULT_CURRENCY = 'USD'

// order = order in the picker
export const CURRENCY_CODES = [
  'USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SGD',
  'HKD', 'CNY', 'AED', 'ZAR', 'SEK', 'NOK', 'MXN', 'BRL', 'KRW'
]

// locales whose digit grouping differs from en-US (INR gets lakh/crore: 12,50,000)
const LOCALE_OVERRIDES = { INR: 'en-IN' }

export const localeForCurrency = (code) => LOCALE_OVERRIDES[code] ?? 'en-US'

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' })
  } catch {
    return null
  }
})()

export const currencyName = (code) => names?.of(code) ?? code

/** Options for the picker: [{ code: 'INR', label: 'INR - Indian Rupee' }, ...] */
export const CURRENCY_OPTIONS = CURRENCY_CODES.map((code) => ({ code, label: `${code} - ${currencyName(code)}` }))
