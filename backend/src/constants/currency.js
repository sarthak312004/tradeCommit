// Journals carry one ISO 4217 currency. We validate against the runtime's own
// ISO list instead of hard-coding one, so supporting a new currency never needs
// a backend change; only the picker in the frontend decides what is offered.
export const DEFAULT_CURRENCY = "USD";

const knownCurrencies =
  typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;

export const normalizeCurrency = (value) => String(value ?? "").trim().toUpperCase();

export const isValidCurrency = (code) =>
  /^[A-Z]{3}$/.test(code) && (knownCurrencies ? knownCurrencies.has(code) : true);
