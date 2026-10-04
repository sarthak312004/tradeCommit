import mongoose, { model } from "mongoose";

// A sign-up that has not produced a user yet: one row per email address that asked for a code.
// The real User document is only created after the code is accepted AND the form is submitted.
const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hash: String, // HMAC of the 6-digit code (cleared once it has been accepted)
    expiresAt: Date, // when the code stops working
    attempts: { type: Number, default: 0 },
    sentAt: Date,
    verifiedAt: Date, // set when the right code was entered
    tokenHash: String, // sha256 of the one-time signup token handed to the browser at that moment
    // MongoDB deletes the row by itself at this time, so abandoned sign-ups never pile up
    purgeAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export const EmailVerification = model("EmailVerification", emailVerificationSchema);
