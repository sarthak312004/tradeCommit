import { htmlToPlainText } from "./richText.js";

const plain = (value = "") => htmlToPlainText(String(value)).toLowerCase();

/** Conservative data-quality checks. These flag uncertainty; they never rewrite user data. */
export const inspectMentorData = ({ journal, trades = [] }) => {
  const warnings = [];
  const mode = journal?.mode === "backtest" ? "backtest" : "live";
  const attributes = Array.isArray(journal?.context?.attributes) ? journal.context.attributes : [];
  const checkboxAttributes = attributes.filter((field) => field.type === "checkbox");
  const missingCheckboxes = [];
  const contradictions = [];

  for (const trade of trades) {
    const fields = Array.isArray(trade.customFields) ? trade.customFields : [];
    for (const attr of checkboxAttributes) {
      const found = fields.find((field) => field.key === attr.key || field.label?.toLowerCase() === attr.label?.toLowerCase());
      if (!found || found.value === null || found.value === undefined || found.value === "") {
        missingCheckboxes.push(`${trade.assetName ?? "trade"}: ${attr.label}`);
        continue;
      }
      // Flag only obvious text/property contradictions. Do not decide which source is correct.
      const note = plain(trade.analysis);
      const label = String(attr.label ?? "").toLowerCase();
      if (!note || !label) continue;
      if (found.value === false) {
        const positiveTerms = label.includes("volume")
          ? /volume (was |is )?(above|strong|confirmed|increased|high|supportive)|above.average volume|volume confirmation/.test(note)
          : label.includes("stoch")
            ? /stochastics? (is |was )?(curling up|rising|oversold|bullish|positive)|stochastics? confirmation/.test(note)
            : false;
        if (positiveTerms) contradictions.push(`${trade.assetName ?? "trade"}: notes may conflict with ${attr.label} marked no`);
      }
    }
  }

  if (mode === "backtest") {
    const dateCounts = new Map();
    for (const trade of trades) {
      const parsedDate = trade.date ? new Date(trade.date) : null;
      const key = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : "missing";
      dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
    }
    const largestSameDate = Math.max(0, ...dateCounts.values());
    if (trades.length >= 5 && largestSameDate / trades.length >= 0.7) {
      warnings.push(`${largestSameDate} of ${trades.length} backtest trades share one recorded trade date; this may reflect batch-import dates rather than actual historical execution dates. The T-numbers only show the order the trades were logged. Do not call trades consecutive, repeated or re-entries, do not infer chronology or same-day behavior, and mention this date issue once in the review, not in every section.`);
    }
  }
  if (missingCheckboxes.length) warnings.push(`${missingCheckboxes.length} expected checkbox values are missing/unknown across trade records; do not treat these as negative observations.`);
  if (contradictions.length) warnings.push(`${contradictions.length} possible note/property contradictions require trader verification: ${contradictions.slice(0, 8).join("; ")}. Do not silently choose either source.`);
  if (!trades.length) warnings.push("No trade records available for data-quality assessment.");

  return {
    mode,
    label: mode === "backtest" ? "BACKTEST / HISTORICAL SIMULATION" : "LIVE TRADING JOURNAL",
    warnings,
    lines: warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- No high-priority issues detected by the basic automated checks; this is not a guarantee that all data is complete or correct."],
  };
};

export const MODE_SPECIFIC_MENTOR_INSTRUCTIONS = {
  live: `LIVE JOURNAL MODE: Review actual execution and ongoing trading behavior. Distinguish realized outcomes from open positions; focus on risk management, execution quality, adherence to plan, and process. Do not treat the logged trade date as proof of exact intraday sequence unless timestamps support it. Do not give investment advice or claim live market knowledge.`,
  backtest: `BACKTEST MODE: Treat records as historical/simulated strategy observations, not necessarily live executed trades. Prioritize rule consistency, setup quality, sample selection, market-regime coverage, out-of-sample validation, survivorship/look-ahead bias, and realistic fees/slippage when the data supports assessment. Do not describe a loss as revenge trading, emotional execution, or live discipline failure unless the trader explicitly documented that behavior and it is relevant. Batch-import/creation dates are not historical execution chronology. Do not infer same-day re-entries from shared dates unless verified. Small samples produce hypotheses, not validated edge claims.`,
};
