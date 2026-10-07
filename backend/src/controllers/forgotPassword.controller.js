import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../utils/mailer.js";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  RESET_TOKEN_TTL_MS,
  buildOtpRecord,
  canSendOtp,
  generateOtp,
  generateProofToken,
  hashProofToken,
  isOtpMatch,
  isProofTokenMatch,
  retryAfterSeconds,
} from "../utils/otp.js";
import { sendSession } from "./user.controller.js";

// "Forgot password" for someone who is NOT logged in. It is the same flow as the in-app password change
// (profile.controller.js) and reuses the same `passwordReset` record on the user and the same email code:
//   1. POST /auth/forgot-password/send-otp    { email }                           -> emails a 6-digit code
//   2. POST /auth/forgot-password/verify-otp  { email, otp }                      -> { resetToken }
//   3. POST /auth/forgot-password/reset       { email, resetToken, newPassword }  -> sets the password + logs in

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes
const SESSION_EXPIRED = "Your verification expired. Please start again.";
const INVALID_CODE = "Invalid or expired code. Request a new one.";

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// POST /api/v1/auth/forgot-password/send-otp  (also used by "Resend code")
export const sendForgotPasswordOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");

  const user = await User.findOne({ email }).select("+passwordReset");

  // Same answer whether or not the address has an account, so this form can't be used to find out who is registered.
  const generic = new ApiResponse(
    200,
    { email, sent: true, retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) },
    "If an account exists for this email, a code has been sent"
  );
  if (!user) return res.status(200).json(generic);

  if (!canSendOtp(user.passwordReset)) {
    // a code went out a moment ago: don't send another, just tell the client how long to wait
    return res
      .status(200)
      .json(new ApiResponse(200, { email, sent: false, retryAfter: retryAfterSeconds(user.passwordReset) }, "A code was just sent"));
  }

  const otp = generateOtp();
  await User.updateOne({ _id: user._id }, { $set: { passwordReset: buildOtpRecord(otp, user.email) } });

  try {
    await sendOtpEmail({ to: user.email, name: user.fullname, otp, purpose: "password-reset" });
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $unset: { passwordReset: 1 } }); // no cooldown for an email that never left
    throw error;
  }

  return res.status(200).json(generic);
});

// POST /api/v1/auth/forgot-password/verify-otp  { email, otp }
export const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";

  if (!email) throw new ApiError(400, "Email is required");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const user = await User.findOne({ email }).select("+passwordReset");
  const record = user?.passwordReset;

  if (!record?.hash || record.verifiedAt) throw new ApiError(400, INVALID_CODE);
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }
  if (!isOtpMatch(code, user.email, record.hash)) {
    await User.updateOne({ _id: user._id }, { $inc: { "passwordReset.attempts": 1 } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  const resetToken = generateProofToken();
  // matching on the stored hash makes the code single-use even if two requests race
  const accepted = await User.updateOne(
    { _id: user._id, "passwordReset.hash": record.hash, "passwordReset.verifiedAt": { $exists: false } },
    {
      $set: {
        "passwordReset.verifiedAt": new Date(),
        "passwordReset.tokenHash": hashProofToken(resetToken),
        "passwordReset.tokenExpiresAt": new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
      $unset: { "passwordReset.hash": 1 },
    }
  );
  if (accepted.modifiedCount !== 1) throw new ApiError(400, INVALID_CODE);

  return res.status(200).json(new ApiResponse(200, { email, resetToken }, "Code verified"));
});

// POST /api/v1/auth/forgot-password/reset  { email, resetToken, newPassword }
export const resetForgottenPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { resetToken, newPassword } = req.body ?? {};

  if (!email || typeof resetToken !== "string" || !resetToken || typeof newPassword !== "string") {
    throw new ApiError(400, "Verification and new password are required");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password can be at most ${MAX_PASSWORD_LENGTH} characters`);
  }

  const user = await User.findOne({ email }).select("+password +passwordReset");
  const proof = user?.passwordReset;

  // This is the actual gate: no accepted code for this email means no password change.
  if (
    !proof?.verifiedAt ||
    !proof.tokenHash ||
    new Date(proof.tokenExpiresAt).getTime() <= Date.now() ||
    !isProofTokenMatch(resetToken, proof.tokenHash)
  ) {
    // 410 tells the client to send the user back to the first step
    throw new ApiError(410, SESSION_EXPIRED);
  }

  if (user.password && (await user.isPasswordCorrect(newPassword))) {
    throw new ApiError(400, "Choose a password different from your current one");
  }

  user.password = newPassword; // hashed by the model's pre-save hook
  user.passwordChangedAt = new Date(); // signs out every other device
  user.passwordReset = undefined; // the proof is single-use
  user.emailVerified = true; // they just proved they own this inbox
  await user.save({ validateBeforeSave: false });

  // the code already proved who they are, so log them straight in
  return sendSession(res, user, 200, "Password updated");
});
