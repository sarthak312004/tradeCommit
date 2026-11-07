// Dev check: do the two Pro products in Dodo (TEST mode) match the prices the app displays?
//
//   cd backend && node scripts/check-dodo-products.js
//
// Needs DODO_PAYMENTS_API_KEY (a TEST-mode key), DODO_PRODUCT_PRO_MONTHLY and DODO_PRODUCT_PRO_YEARLY in backend/.env.
// Read-only: it only fetches the two products and their localized price rules (GET /products/{id} and
// GET /products/{id}/localized-prices, see docs.dodopayments.com/features/localized-pricing). It prints no keys.
// Exit code 1 when any warning is raised, so it can also run in a checklist.
import "dotenv/config";
import { analyzeProduct, ruleList } from "../src/utils/dodoProductCheck.js";

const HOSTS = { test_mode: "https://test.dodopayments.com", live_mode: "https://live.dodopayments.com" };
const env = process.env.DODO_ENV === "live_mode" ? "live_mode" : "test_mode";

if (env === "live_mode" && !process.argv.includes("--allow-live")) {
  console.error("DODO_ENV is live_mode. This check is meant for test keys; pass --allow-live to run it against live products.");
  process.exit(2);
}

const apiKey = process.env.DODO_PAYMENTS_API_KEY?.trim();
const products = [
  ["monthly", process.env.DODO_PRODUCT_PRO_MONTHLY?.trim()],
  ["yearly", process.env.DODO_PRODUCT_PRO_YEARLY?.trim()],
];
const missing = [!apiKey && "DODO_PAYMENTS_API_KEY", ...products.filter(([, id]) => !id).map(([name]) => `DODO_PRODUCT_PRO_${name.toUpperCase()}`)].filter(Boolean);
if (missing.length) {
  console.error(`Missing in backend/.env: ${missing.join(", ")}`);
  process.exit(2);
}

// The prices the app displays (frontend/src/config/pricing.js). Optional: skipped if the frontend folder is not there.
let displayed = null;
try {
  displayed = (await import("../../frontend/src/config/pricing.js")).PRICES;
} catch {
  console.warn("Could not load frontend/src/config/pricing.js; amounts are not compared with the app.");
}

const get = async (path) => {
  const response = await fetch(`${HOSTS[env]}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`GET ${path.replace(/pdt_[A-Za-z0-9]+/, "pdt_…")} answered ${response.status}`);
  return response.json();
};

let warnings = 0;
console.log(`Checking Dodo products in ${env}\n`);
for (const [interval, id] of products) {
  try {
    const [product, rules] = await Promise.all([get(`/products/${id}`), get(`/products/${id}/localized-prices`).catch(() => [])]);
    const result = analyzeProduct({ label: interval, product, rules: ruleList(rules), expected: displayed?.[interval] });
    console.log(result.summary.join("\n"));
    for (const warning of result.warnings) console.warn(`  WARNING ${warning}`);
    warnings += result.warnings.length;
  } catch (error) {
    console.error(`${interval}: ${error.message}`);
    warnings += 1;
  }
  console.log("");
}
console.log(warnings === 0 ? "All good: products match the displayed prices." : `${warnings} warning(s). Fix the product in the Dodo dashboard, or update frontend/src/config/pricing.js.`);
process.exit(warnings === 0 ? 0 : 1);
