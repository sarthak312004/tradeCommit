import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProduct, ruleList } from "./dodoProductCheck.js";

const expected = { usd: 119, inr: 4999 };
const product = (overrides = {}) => ({ price: { currency: "USD", price: 11900 }, pricing_mode: "by_country", ...overrides });
const indiaRule = (amount = 499900) => ({ mode: "by_country", country_code: "IN", currency: "INR", amount });

test("a by_country product with the right base and India rule has no warnings", () => {
  const { warnings, summary } = analyzeProduct({ label: "yearly", product: product(), rules: [indiaRule()], expected });
  assert.deepEqual(warnings, []);
  assert.ok(summary[0].includes("119 USD") && summary[0].includes("by_country"));
});

test("warns when pricing_mode is not by_country", () => {
  for (const mode of ["by_currency", null, undefined]) {
    const { warnings } = analyzeProduct({ label: "monthly", product: product({ pricing_mode: mode }), rules: [indiaRule(49900)], expected: { usd: 119, inr: 499 } });
    assert.ok(warnings.some((warning) => warning.includes("not by_country")));
  }
});

test("warns when there is no India rule", () => {
  const { warnings } = analyzeProduct({ label: "yearly", product: product(), rules: [{ mode: "by_country", country_code: "GB", currency: "GBP", amount: 9900 }], expected });
  assert.ok(warnings.some((warning) => warning.includes("no India price rule")));
  assert.ok(analyzeProduct({ label: "yearly", product: product(), rules: [], expected }).warnings.length > 0);
});

test("an INR currency rule counts as an India rule", () => {
  const rules = [{ mode: "by_currency", currency: "INR", amount: 499900 }];
  const { warnings } = analyzeProduct({ label: "yearly", product: product(), rules, expected });
  assert.ok(!warnings.some((warning) => warning.includes("no India price rule")));
});

test("warns when amounts differ from what the app displays", () => {
  const { warnings } = analyzeProduct({ label: "yearly", product: product({ price: { currency: "USD", price: 9900 } }), rules: [indiaRule(399900)], expected });
  assert.ok(warnings.some((warning) => warning.includes("India rule is")));
  assert.ok(warnings.some((warning) => warning.includes("base price is")));
});

test("warns when the base currency is not USD", () => {
  const { warnings } = analyzeProduct({ label: "yearly", product: product({ price: { currency: "EUR", price: 11900 } }), rules: [indiaRule()], expected });
  assert.ok(warnings.some((warning) => warning.includes("base currency")));
});

test("without displayed prices only the mode and India rule are checked", () => {
  assert.deepEqual(analyzeProduct({ label: "yearly", product: product(), rules: [indiaRule()] }).warnings, []);
});

test("ruleList accepts an array or an items / data wrapper", () => {
  assert.deepEqual(ruleList([1]), [1]);
  assert.deepEqual(ruleList({ items: [2] }), [2]);
  assert.deepEqual(ruleList({ data: [3] }), [3]);
  assert.deepEqual(ruleList(null), []);
});
