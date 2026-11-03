// Loads the Dodo Payments SDK on first use, so the app still starts if the package is not installed yet
// (billing endpoints then answer with an error instead of the whole server failing to boot).
// The API key and webhook key are read from the environment and are never logged.
let client = null;

export const getDodoClient = async () => {
  if (client) return client;
  const bearerToken = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!bearerToken) return null;
  const { default: DodoPayments } = await import("dodopayments");
  client = new DodoPayments({
    bearerToken,
    environment: process.env.DODO_ENV === "live_mode" ? "live_mode" : "test_mode",
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || null,
  });
  return client;
};

// test helper
export const resetDodoClient = () => {
  client = null;
};
