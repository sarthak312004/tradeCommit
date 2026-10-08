import { ApiError } from "./ApiError.js";
import { CUSTOM_FIELD_TYPES } from "../models/customField.schema.js";

export const MAX_CUSTOM_FIELDS = 20;

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
