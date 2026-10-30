import mongoose, { model } from "mongoose";

// A sign-up that has not produced a user yet: one row per email address that asked for a code.
// The row is consumed (deleted) the moment the right code is entered; that same request creates the User.
const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hash: String, // HMAC of the 6-digit code
    expiresAt: Date, // when the code stops working
    attempts: { type: Number, default: 0 },
    sentAt: Date,
    // MongoDB deletes the row by itself at this time, so abandoned sign-ups never pile up
    purgeAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export const EmailVerification = model("EmailVerification", emailVerificationSchema);
