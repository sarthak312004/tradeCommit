import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getDodoClient, resetDodoClient } from "./dodoClient.js";

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
