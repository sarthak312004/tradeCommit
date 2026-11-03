import { ApiError } from "./ApiError.js";
import { getEntitlements } from "./entitlements.js";

const idOf = (value) => String(value?._id ?? value?.id ?? value);

/** Oldest resources up to the current entitlement remain writable; later ones stay readable but are locked. */
export const getReadOnlyResourceIds = async ({ user, Model, limitKey }) => {
  const limit = getEntitlements(user)[limitKey];
  if (limit === null || limit === undefined) return new Set();
  const rows = await Model.find({ owner: user._id }).sort({ createdAt: 1, _id: 1 }).select("_id").lean();
  return new Set(rows.slice(Math.max(0, limit)).map(idOf));
};

export const assertOwnedResourceWritable = async ({ user, Model, resource, limitKey, feature }) => {
  const readOnlyIds = await getReadOnlyResourceIds({ user, Model, limitKey });
  if (readOnlyIds.has(idOf(resource))) {
    throw new ApiError(403, "Read-only on Free. Upgrade to edit.", [], "", {
      code: "PLAN_LIMIT",
      feature,
    });
  }
};

/** Same guard for a write that touches several owned resources at once (e.g. an import into many journals). */
export const assertOwnedResourcesWritable = async ({ user, Model, resources, limitKey, feature }) => {
  const readOnlyIds = await getReadOnlyResourceIds({ user, Model, limitKey });
  if (readOnlyIds.size > 0 && resources.some((resource) => readOnlyIds.has(idOf(resource)))) {
    throw new ApiError(403, "Read-only on Free. Upgrade to edit.", [], "", {
      code: "PLAN_LIMIT",
      feature,
    });
  }
};
