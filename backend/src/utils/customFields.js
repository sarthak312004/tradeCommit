import { ApiError } from "./ApiError.js";
import { CUSTOM_FIELD_TYPES } from "../models/customField.schema.js";

export const MAX_CUSTOM_FIELDS = 20;

// Applies the journal's default properties to one existing trade's custom fields:
//  - a default the trade doesn't have yet is added with the default value
//  - a property the trade already has (same key, or same name and type) keeps the trade's own value;
//    only its name is brought in line with the context if it was renamed
//  - properties that are not in the context are never removed, so no trade data is lost
// Returns { fields, changed } where `changed` says whether the trade needs saving.
export const applyContextToFields = (tradeFields, contextAttributes) => {
  const fields = (tradeFields ?? []).map(({ key, label, type, value }) => ({ key, label, type, value }));
  let changed = false;

  for (const attribute of contextAttributes) {
    const sameKey = fields.find((field) => field.key === attribute.key);
    if (sameKey) {
      if (sameKey.label !== attribute.label) {
        sameKey.label = attribute.label;
        changed = true;
      }
      continue;
    }

    const sameName = fields.some(
      (field) => field.type === attribute.type && field.label.trim().toLowerCase() === attribute.label.toLowerCase()
    );
    if (sameName || fields.length >= MAX_CUSTOM_FIELDS) continue;

    fields.push({ key: attribute.key, label: attribute.label, type: attribute.type, value: attribute.value });
    changed = true;
  }

  return { fields, changed };
};

// validates and normalises user-defined fields so only clean name/type/value triples are stored
export const parseCustomFields = (raw) => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ApiError(400, "Custom fields must be a list");
  if (raw.length > MAX_CUSTOM_FIELDS) {
    throw new ApiError(400, `You can add up to ${MAX_CUSTOM_FIELDS} custom fields`);
  }

  return raw.map((field, index) => {
    const label = String(field?.label ?? "").trim().slice(0, 40);
    const type = field?.type;
    const input = field?.value;

    if (!label) throw new ApiError(400, "Custom fields need a name");
    if (!CUSTOM_FIELD_TYPES.includes(type)) {
      throw new ApiError(400, `Unsupported custom field type: ${type}`);
    }

    let value = null;
    if (type === "text") {
      value = typeof input === "string" && input.trim() ? input.trim().slice(0, 500) : null;
    } else if (type === "number") {
      if (input !== "" && input !== null && input !== undefined) {
        value = Number(input);
        if (!Number.isFinite(value)) throw new ApiError(400, `"${label}" must be a number`);
      }
    } else if (type === "date") {
      if (input) {
        if (Number.isNaN(Date.parse(input))) throw new ApiError(400, `"${label}" must be a valid date`);
        value = String(input).slice(0, 10);
      }
    } else if (type === "checkbox") {
      value = input === true || input === "true";
    }

    return { key: String(field?.key || `field-${index}`).slice(0, 64), label, type, value };
  });
};
