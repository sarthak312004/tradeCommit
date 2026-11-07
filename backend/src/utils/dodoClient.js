// Loads the Dodo Payments SDK on first use, so the app still starts if the package is not installed yet
// (billing endpoints then answer with an error instead of the whole server failing to boot).
// The API key and webhook key are read from the environment and are never logged.
let client = null;

const MODES = ["test_mode", "live_mode"];

// Same normalisation as the product ids and APP_URL in billingService.js / billingManage.js: dashboard values pasted
// from a .env file often keep their surrounding quotes (DODO_ENV="live_mode"), which must not silently disable billing.
export const cleanEnv = (value) => (value ?? "").trim().replace(/^['"]+|['"]+$/g, "").trim();

const dodoEnvironment = () => cleanEnv(process.env.DODO_ENV).toLowerCase();

/**
 * Why the Dodo client cannot be created, as safe messages that name variables only (never their values).
 * Empty when the client can be built.
 */
export const dodoClientProblems = () => {
  const problems = [];
  const environment = dodoEnvironment();
  if (!environment) problems.push("DODO_ENV is missing");
  else if (!MODES.includes(environment)) problems.push("DODO_ENV is not test_mode or live_mode");
  else if (process.env.NODE_ENV === "production" && environment !== "live_mode") problems.push("DODO_ENV must be live_mode in production");
  if (!cleanEnv(process.env.DODO_PAYMENTS_API_KEY)) problems.push("DODO_PAYMENTS_API_KEY is missing");
  return problems;
};

export const getDodoClient = async () => {
  if (client) return client;
  if (dodoClientProblems().length > 0) return null;
  const { default: DodoPayments } = await import("dodopayments");
  client = new DodoPayments({
    bearerToken: cleanEnv(process.env.DODO_PAYMENTS_API_KEY),
    environment: dodoEnvironment(),
    webhookKey: cleanEnv(process.env.DODO_PAYMENTS_WEBHOOK_KEY) || null,
  });
  return client;
};

// test helper
export const resetDodoClient = () => {
  client = null;
};
