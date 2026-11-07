// Fails when code outside config/ and entitlements.js decides anything from the plan NAME or reads the plan tables
// directly. Every limit must come from the user's entitlements, so features can move between plans in
// config/plans.config.js alone.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const NAME = String.raw`["'\`](?:free|pro)["'\`]`;
const RULES = [
  { why: "compares something to a plan name", pattern: new RegExp(String.raw`(?:[!=]==?)\s*${NAME}`) },
  { why: "compares a plan name to something", pattern: new RegExp(String.raw`${NAME}\s*[!=]==?`) },
  { why: "switches on a plan name", pattern: new RegExp(String.raw`\bcase\s+${NAME}\s*:`) },
  { why: "tests a plan name with includes/indexOf", pattern: new RegExp(String.raw`\[[^\]]*${NAME}[^\]]*\]\s*\.\s*(?:includes|indexOf)\s*\(`) },
  { why: "compares a variable called plan", pattern: /\b(?:plan|planName|effectivePlan|userPlan)\s*[!=]==?\s*[\w"'`]/ },
  { why: "reads the metric tiers directly", pattern: /\bMETRIC_TIERS\b/ },
  { why: "reads the plan tables directly", pattern: /\bPLANS(?:\.[A-Za-z]|\[)/ },
];

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

export const findViolations = (source) =>
  stripComments(source)
    .split(/\r?\n/)
    .flatMap((line, index) => RULES.filter(({ pattern }) => pattern.test(line)).map(({ why }) => ({ line: index + 1, why, text: line.trim() })));

const listSourceFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listSourceFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });

const isExempt = (relative) =>
  relative.startsWith("config/") || relative === "utils/entitlements.js" || relative.endsWith(".test.js");

test("no code outside config/ and entitlements.js compares plan names or reads the plan tables", () => {
  const files = listSourceFiles(SRC).map((file) => path.relative(SRC, file).split(path.sep).join("/"));
  assert.ok(files.length > 20, "the scan found suspiciously few files");

  const offences = files
    .filter((relative) => !isExempt(relative))
    .flatMap((relative) =>
      findViolations(readFileSync(path.join(SRC, relative), "utf8")).map(({ line, why, text }) => `${relative}:${line} ${why}: ${text}`)
    );

  assert.deepEqual(offences, [], `Read an entitlement key instead (see config/plans.config.js):\n${offences.join("\n")}`);
});

test("the scanner catches the patterns it exists for", () => {
  const bad = [
    "if (user.plan === 'pro') {}",
    'if (plan !== "free") {}',
    "const isPro = req.user.planName == `pro`;",
    "if ('pro' === plan) {}",
    "switch (p) { case 'pro': break }",
    "if (['pro', 'team'].includes(user.plan)) {}",
    "if (plan === PLAN_PRO) {}",
    "const limit = PLANS.free.maxJournals;",
    "const limits = PLANS[plan];",
    "import { METRIC_TIERS } from '../config/plans.config.js';",
  ];
  for (const line of bad) assert.ok(findViolations(line).length > 0, `should flag: ${line}`);
});

test("the scanner leaves ordinary code and comments alone", () => {
  const fine = [
    "if (entitlements.maxJournals !== null && count >= entitlements.maxJournals) {}",
    "const mode = journal.mode === 'live' ? 1 : 2; // not plan === 'pro'",
    "/* never write plan === 'pro' here */",
    "const planner = await Planner.findById(id); if (planner === null) {}",
    "if (scope === 'week') {}",
    "export const PLAN_SCOPES = ['day', 'week'];",
    "const url = 'https://example.com/pro'; if (x) {}",
    "\"=== TRADER'S TRADE PLANS vs WHAT WAS EXECUTED ===\"; // prompt text, not code",
    "Do not mention planning, planners or plans at all when no TRADER'S TRADE PLANS block is present.",
  ];
  for (const line of fine) assert.deepEqual(findViolations(line), [], `should not flag: ${line}`);
});
