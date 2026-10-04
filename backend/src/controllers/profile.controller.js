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

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

const SESSION_EXPIRED = "Your verification expired. Please start again.";

// GET /api/v1/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        hasPassword: Boolean(user.password), // false for Google-only accounts: the dialog says "Set" instead of "Reset"
        createdAt: user.createdAt,
      },
      "Profile fetched"
    )
  );
});

// ---- Changing the password is three steps, all for the logged-in user, and the code only ever goes to their own email --------
//   1. POST /auth/password/send-otp    {}                           -> emails a 6-digit code
//   2. POST /auth/password/verify-otp  { otp }                      -> { resetToken } (proof the code was right)
//   3. POST /auth/password/reset       { resetToken, newPassword }  -> updates the password

export const sendPasswordResetOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+passwordReset");
  if (!user) throw new ApiError(404, "User not found");

  if (!canSendOtp(user.passwordReset)) {
    // a code went out a moment ago: don't send another, just tell the client how long to wait
    return res
      .status(200)
      .json(new ApiResponse(200, { email: user.email, sent: false, retryAfter: retryAfterSeconds(user.passwordReset) }, "A code was just sent"));
  }

  const otp = generateOtp();
  await User.updateOne({ _id: user._id }, { $set: { passwordReset: buildOtpRecord(otp, user.email) } });

  try {
    await sendOtpEmail({ to: user.email, name: user.fullname, otp, purpose: "password-reset" });
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $unset: { passwordReset: 1 } }); // no cooldown for an email that never left
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { email: user.email, sent: true, retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) }, "Verification code sent"));
});

export const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const user = await User.findById(req.user._id).select("+passwordReset");
  const record = user?.passwordReset;

  if (!record?.hash || record.verifiedAt) {
    throw new ApiError(400, "Invalid or expired code. Request a new one.");
  }
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
  if (accepted.modifiedCount !== 1) throw new ApiError(400, "Invalid or expired code. Request a new one.");

  return res.status(200).json(new ApiResponse(200, { resetToken }, "Code verified"));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body ?? {};

  if (typeof resetToken !== "string" || !resetToken || typeof newPassword !== "string") {
    throw new ApiError(400, "Verification and new password are required");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password can be at most ${MAX_PASSWORD_LENGTH} characters`);
  }

  const user = await User.findById(req.user._id).select("+password +passwordReset");
  const proof = user?.passwordReset;

  // This is the actual gate: no accepted code for this user means no password change.
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
  await user.save({ validateBeforeSave: false });

  // new cookies for this device, so the person who just changed the password stays logged in
  return sendSession(res, user, 200, "Password updated");
});
