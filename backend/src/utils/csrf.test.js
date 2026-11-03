import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requireTrustedOrigin } from "../middlewares/csrf.middleware.js";

const previous = process.env.CORS_ORIGIN;
afterEach(() => {
  if (previous === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = previous;
});

const invoke = ({ method = "POST", origin, host = "api.example.test", protocol = "https" }) => {
  let error;
  let continued = false;
  const req = {
    method,
    protocol,
    get: (name) => (name.toLowerCase() === "origin" ? origin : host),
  };
  requireTrustedOrigin(req, {}, (nextError) => {
    error = nextError;
    continued = !nextError;
  });
  return { error, continued };
};

test("allows a configured frontend origin for state-changing requests", () => {
  process.env.CORS_ORIGIN = "https://app.example.test";
  assert.deepEqual(invoke({ origin: "https://app.example.test" }), { error: undefined, continued: true });
});

test("rejects unconfigured, missing, and opaque origins", () => {
  process.env.CORS_ORIGIN = "https://app.example.test";
  for (const origin of ["https://attacker.example", undefined, "null"]) {
    const result = invoke({ origin });
    assert.equal(result.continued, false);
    assert.equal(result.error.statusCode, 403);
    assert.equal(result.error.message, "Request origin is not allowed");
  }
});

test("falls back to an exact same-origin check when no allowlist is configured", () => {
  delete process.env.CORS_ORIGIN;
  assert.deepEqual(invoke({ origin: "https://api.example.test" }), { error: undefined, continued: true });
  assert.equal(invoke({ origin: "https://attacker.example" }).error.statusCode, 403);
});

test("does not block safe methods", () => {
  delete process.env.CORS_ORIGIN;
  assert.deepEqual(invoke({ method: "GET" }), { error: undefined, continued: true });
});
