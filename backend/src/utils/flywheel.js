import { AiRangeReview } from "../models/aiRangeReview.models.js";
import { AiReview } from "../models/aiReview.models.js";
import { addDays } from "./tradeStats.js";

// The flywheel only turns if each review is judged against what the previous one asked for. This finds that earlier
// ask: the most recent saved review of the journal (weekly or date range) that ENDED before the period now being
// reviewed, and the one thing it told the trader to carry into their next plan.

const clean = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** What a saved review asked the trader to carry forward. Reviews written before the flywheel existed fall back to their first action. */
export const commitmentOf = (review) => {
  const carry = review?.flywheel?.carryForward;
  if (carry?.rule) {
    return { rule: clean(carry.rule, 400), planLine: clean(carry.planLine, 400), checkpoint: clean(carry.checkpoint, 400), source: "flywheel" };
  }
  const first = Array.isArray(review?.nextWeek) ? clean(review.nextWeek[0], 400) : "";
  return first ? { rule: first, planLine: "", checkpoint: "", source: "next_steps" } : null;
};

/**
 * Latest earlier review of the journal and its commitment, or null.
 * `before` is the first day of the period under review (YYYY-MM-DD): only reviews that ended before it count.
 */
export const findLastCommitment = async ({ journalId, ownerId, before }) => {
  const [range, week] = await Promise.all([
    AiRangeReview.findOne({ journal: journalId, owner: ownerId, rangeEnd: { $lt: before } }).sort({ rangeEnd: -1, updatedAt: -1 }).select("rangeStart rangeEnd review updatedAt").lean(),
    AiReview.findOne({ journal: journalId, owner: ownerId, weekStart: { $lt: addDays(before, -6) } }).sort({ weekStart: -1, updatedAt: -1 }).select("weekStart review updatedAt").lean(),
  ]);

  const candidates = [
    range && { start: range.rangeStart, end: range.rangeEnd, review: range.review },
    week && { start: week.weekStart, end: addDays(week.weekStart, 6), review: week.review },
  ].filter((item) => item && item.end < before);
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.end.localeCompare(a.end));
  for (const candidate of candidates) {
    const commitment = commitmentOf(candidate.review);
    if (commitment) return { start: candidate.start, end: candidate.end, ...commitment };
  }
  return null;
};
