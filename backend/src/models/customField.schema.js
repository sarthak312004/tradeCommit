import mongoose from "mongoose";

// user-defined extra property (name + type + value). Used on trades and, as defaults, on journal context.
export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "checkbox"];

export const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);
