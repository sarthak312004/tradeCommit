import mongoose from "mongoose";
import { DEFAULT_CURRENCY, isValidCurrency } from "../constants/currency.js";
import { customFieldSchema } from "./customField.schema.js";

export const MAX_STRATEGY_LENGTH = 2000;

// Background about how this journal is traded. Edited from the journal header and read by
// the trade form (default properties) and, later, by AI features (strategy + attributes).
const journalContextSchema = new mongoose.Schema(
  {
    strategy: { type: String, trim: true, maxlength: MAX_STRATEGY_LENGTH, default: "" },
    // properties added to every new trade form in this journal; `value` is the default
    attributes: { type: [customFieldSchema], default: [] },
  },
  { _id: false }
);

const journalSchema = new mongoose.Schema(
  {
    journalName: {
      type: String,
      required: [true, "Journal name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // ISO 4217 code every amount in this journal is expressed in. Chosen when the
    // journal is created and immutable afterwards, so existing P&L never changes meaning.
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: DEFAULT_CURRENCY,
      immutable: true,
      validate: {
        validator: isValidCurrency,
        message: "Unsupported currency code",
      },
    },
    context: {
      type: journalContextSchema,
      default: () => ({}),
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Optional: journal.populate("trades") works without storing an array
journalSchema.virtual("trades", {
  ref: "Trade",
  localField: "_id",
  foreignField: "journal",
});

export const Journal = mongoose.model("Journal", journalSchema);