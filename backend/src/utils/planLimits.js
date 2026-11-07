// Creating something that counts against a plan limit (journals, planners): check, create, then re-check.
// The limit itself always comes from the user's entitlements; nothing here knows a plan name.
import { ApiError } from "./ApiError.js";
import { getEntitlements } from "./entitlements.js";

export const PLAN_LIMIT_CODE = "PLAN_LIMIT";

/** 403 { code: "PLAN_LIMIT", feature } where `feature` is the entitlement key that blocked the request. */
export const planLimitError = (feature, limit, noun) =>
  new ApiError(
    403,
    `Your plan includes ${limit} ${noun}${limit === 1 ? "" : "s"}. Upgrade to create more.`,
    [],
    "",
    { code: PLAN_LIMIT_CODE, feature }
  );

/**
 * Runs `create()` only while the user is under the entitlement `limitKey` (null = unlimited).
 *
 * Race safety: the first count is a cheap early exit; the real guard is the count AFTER the insert. Two simultaneous
 * requests can both pass the first count, but each then counts again and a request that finds the owner over the limit
 * removes its own new document and fails. Whatever the interleaving, the number of documents never stays above the
 * limit; in the rare case that both requests insert before either re-counts, both are rolled back and the user simply
 * retries. Nothing the user already owns is ever deleted: existing documents over a lowered limit are left alone and
 * only new creation is blocked.
 *
 * @param {object}   options
 * @param {object}   options.user       the authenticated user (req.user)
 * @param {string}   options.limitKey   entitlement key holding the limit, e.g. "maxJournals"
 * @param {string}   options.noun       singular name used in the message, e.g. "journal"
 * @param {Function} options.countOwned async () => number of documents this user already owns
 * @param {Function} options.create     async () => the newly created document
 * @param {Function} options.remove     async (document) => deletes that document (rollback)
 */
export const createWithinPlanLimit = async ({ user, limitKey, noun, countOwned, create, remove }) => {
  const limit = getEntitlements(user)[limitKey];
  if (limit === null) return create(); // unlimited

  if ((await countOwned()) >= limit) throw planLimitError(limitKey, limit, noun);

  const created = await create();
  if ((await countOwned()) > limit) {
    await remove(created);
    throw planLimitError(limitKey, limit, noun);
  }
  return created;
};

/** 403 { code: "PLAN_LIMIT", feature: "import", limit, total }: a file or request holds more trades than one import may save. */
export const importLimitError = (limit, total) =>
  new ApiError(
    403,
    `Your plan imports up to ${limit} trade${limit === 1 ? "" : "s"} at a time and this file has ${total}. Upgrade to import more.`,
    [],
    "",
    { code: PLAN_LIMIT_CODE, feature: "import", limit, total }
  );

/**
 * Throws importLimitError when `total` trades are more than entitlements.importMaxPerCommit (null = unlimited).
 * Used by both import preview and commit, so the two can never disagree.
 */
export const assertWithinImportLimit = (entitlements, total) => {
  const limit = entitlements?.importMaxPerCommit;
  if (limit === null || limit === undefined) return;
  if (total > limit) throw importLimitError(limit, total);
};

/**
 * 403 { code: "PLAN_LIMIT", feature } unless the entitlement `feature` (a boolean key such as "aiRangeReviews") is on.
 * Reads the entitlement only, never a plan name, so moving a feature between plans is a config change.
 */
export const assertEntitled = (entitlements, feature, message) => {
  if (entitlements?.[feature] === true) return;
  throw new ApiError(403, message, [], "", { code: PLAN_LIMIT_CODE, feature });
};
