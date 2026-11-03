// Pure checks for scripts/check-dodo-products.js: does a Dodo product look the way the app's displayed prices assume?
// Field names follow the Dodo API reference: product.price { currency, price (smallest unit) }, product.pricing_mode
// ('by_country' | 'by_currency' | null) and, per localized price rule, { mode, country_code, currency, amount (smallest unit) }.

const minor = (amount) => (Number.isFinite(amount) ? amount / 100 : null);
const show = (amount, currency) => (minor(amount) === null ? "unknown" : `${minor(amount)} ${currency ?? "?"}`);

/** The rules list comes back as an array or wrapped in `items` / `data`. */
export const ruleList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const isIndiaRule = (rule) => rule?.country_code === "IN" || String(rule?.currency).toUpperCase() === "INR";

/**
 * @param {{ label: string, product: object, rules: object[], expected?: { usd?: number, inr?: number } }} input
 * @returns {{ summary: string[], warnings: string[] }}
 */
export const analyzeProduct = ({ label, product, rules = [], expected = {} }) => {
  const summary = [];
  const warnings = [];

  const base = product?.price ?? {};
  const baseAmount = Number(base.price ?? base.amount);
  const baseCurrency = base.currency ?? null;
  const mode = product?.pricing_mode ?? null;

  summary.push(`${label}: base price ${show(baseAmount, baseCurrency)}, pricing_mode ${mode ?? "null (base only)"}`);

  if (mode !== "by_country") {
    warnings.push(`${label}: pricing_mode is ${mode ?? "null"}, not by_country. Indian customers will not get a fixed price per country.`);
  }

  const india = rules.find(isIndiaRule);
  for (const rule of rules) summary.push(`  rule: ${rule.mode ?? "?"} ${rule.country_code ?? "-"} ${show(Number(rule.amount), rule.currency)}`);
  if (!india) {
    warnings.push(`${label}: no India price rule (country_code IN / currency INR). Indian checkouts would be converted from the base price.`);
  } else if (Number.isFinite(expected.inr) && Number(india.amount) !== Math.round(expected.inr * 100)) {
    warnings.push(`${label}: India rule is ${show(Number(india.amount), india.currency)} but the app shows ${expected.inr} INR (frontend/src/config/pricing.js).`);
  }

  if (Number.isFinite(expected.usd)) {
    if (String(baseCurrency).toUpperCase() !== "USD") {
      warnings.push(`${label}: base currency is ${baseCurrency ?? "unknown"}, the app shows international prices in USD.`);
    } else if (baseAmount !== Math.round(expected.usd * 100)) {
      warnings.push(`${label}: base price is ${show(baseAmount, baseCurrency)} but the app shows ${expected.usd} USD (frontend/src/config/pricing.js).`);
    }
  }

  return { summary, warnings };
};
