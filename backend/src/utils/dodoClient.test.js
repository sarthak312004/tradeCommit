import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanEnv, dodoClientProblems, getDodoClient, resetDodoClient } from "./dodoClient.js";

const ENV = ["NODE_ENV", "DODO_ENV", "DODO_PAYMENTS_API_KEY"];
const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));

afterEach(() => {
  resetDodoClient();
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("Dodo does not silently default to test mode", async () => {
  process.env.NODE_ENV = "development";
  process.env.DODO_PAYMENTS_API_KEY = "test-key";
  delete process.env.DODO_ENV;
  assert.equal(await getDodoClient(), null);
});

test("production refuses a test-mode Dodo client", async () => {
  process.env.NODE_ENV = "production";
  process.env.DODO_ENV = "test_mode";
  process.env.DODO_PAYMENTS_API_KEY = "test-key";
  assert.equal(await getDodoClient(), null);
});

test("unknown Dodo environments are rejected", async () => {
  process.env.NODE_ENV = "development";
  process.env.DODO_ENV = "live";
  process.env.DODO_PAYMENTS_API_KEY = "test-key";
  assert.equal(await getDodoClient(), null);
});

/* ---------------- config normalisation + safe diagnostics ---------------- */

const ENV_EXTRA = ["DODO_PAYMENTS_WEBHOOK_KEY"];
const savedExtra = Object.fromEntries(ENV_EXTRA.map((key) => [key, process.env[key]]));
afterEach(() => {
  for (const key of ENV_EXTRA) {
    if (savedExtra[key] === undefined) delete process.env[key];
    else process.env[key] = savedExtra[key];
  }
});

test("quoted dashboard values are accepted, matching how product ids and APP_URL are read", async () => {
  // Root cause: DODO_ENV="live_mode" (quotes kept from a .env paste) used to make getDodoClient() return null -> checkout 503,
  // while the quoted product ids and APP_URL were accepted by billingService.js.
  process.env.NODE_ENV = "production";
  process.env.DODO_ENV = '"live_mode"';
  process.env.DODO_PAYMENTS_API_KEY = "'secret-key-value'";
  assert.deepEqual(dodoClientProblems(), []);
  process.env.DODO_ENV = "  LIVE_MODE \n";
  assert.deepEqual(dodoClientProblems(), []);
  assert.equal(cleanEnv('  "pdt_abc"  '), "pdt_abc");
});

test("dodoClientProblems names the variables only and never echoes their values", () => {
  process.env.NODE_ENV = "production";
  process.env.DODO_ENV = "live-secretish-typo";
  process.env.DODO_PAYMENTS_API_KEY = '""';
  const problems = dodoClientProblems();
  assert.deepEqual(problems, ["DODO_ENV is not test_mode or live_mode", "DODO_PAYMENTS_API_KEY is missing"]);
  assert.ok(!problems.join(" ").includes("secretish"));

  delete process.env.DODO_ENV;
  process.env.DODO_PAYMENTS_API_KEY = "sk_value_should_not_leak";
  assert.deepEqual(dodoClientProblems(), ["DODO_ENV is missing"]);
  assert.ok(!dodoClientProblems().join(" ").includes("sk_value"));

  process.env.DODO_ENV = "test_mode";
  assert.deepEqual(dodoClientProblems(), ["DODO_ENV must be live_mode in production"]);
});

test("quotes or empty quotes still fail closed: production keeps refusing test_mode", async () => {
  process.env.NODE_ENV = "production";
  process.env.DODO_ENV = '"test_mode"';
  process.env.DODO_PAYMENTS_API_KEY = "test-key";
  assert.equal(await getDodoClient(), null);
  process.env.DODO_ENV = "live_mode";
  process.env.DODO_PAYMENTS_API_KEY = "''";
  assert.equal(await getDodoClient(), null);
});
