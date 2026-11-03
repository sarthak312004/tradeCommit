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
