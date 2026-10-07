import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../utils/mailer.js";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  buildOtpRecord,
  canSendOtp,
  generateOtp,
  isOtpMatch,
  retryAfterSeconds,
} from "../utils/otp.js";
import { sendSession } from "./user.controller.js";

// Log in with an emailed code, no password needed. Same code check as sign-up and forgot-password:
//   1. POST /auth/login/send-otp    { email }       -> emails a 6-digit code
//   2. POST /auth/login/verify-otp  { email, otp }  -> checks the code and logs the user straight in

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CODE = "Invalid or expired code. Request a new one.";

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// POST /api/v1/auth/login/send-otp  (also used by "Resend code")
export const sendLoginOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");

  const user = await User.findOne({ email }).select("+loginOtp");

  // Same answer whether or not the address has an account, so this form can't be used to find out who is registered.
  const generic = new ApiResponse(
    200,
    { email, sent: true, retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) },
    "If an account exists for this email, a login code has been sent"
  );
  if (!user) return res.status(200).json(generic);

  if (!canSendOtp(user.loginOtp)) {
    // a code went out a moment ago: don't send another, just tell the client how long to wait
    return res
      .status(200)
      .json(new ApiResponse(200, { email, sent: false, retryAfter: retryAfterSeconds(user.loginOtp) }, "A code was just sent"));
  }

  const otp = generateOtp();
  await User.updateOne({ _id: user._id }, { $set: { loginOtp: buildOtpRecord(otp, user.email) } });

  try {
    await sendOtpEmail({ to: user.email, name: user.fullname, otp, purpose: "login" });
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $unset: { loginOtp: 1 } }); // no cooldown for an email that never left
    throw error;
  }

  return res.status(200).json(generic);
});

// POST /api/v1/auth/login/verify-otp  { email, otp }
export const verifyLoginOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";

  if (!email) throw new ApiError(400, "Email is required");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const user = await User.findOne({ email }).select("+loginOtp");
  const record = user?.loginOtp;

  if (!record?.hash) throw new ApiError(400, INVALID_CODE);
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }
  if (!isOtpMatch(code, user.email, record.hash)) {
    await User.updateOne({ _id: user._id }, { $inc: { "loginOtp.attempts": 1 } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  // Consume the code. Matching on the stored hash makes it single-use even if two requests race.
  const consumed = await User.updateOne({ _id: user._id, "loginOtp.hash": record.hash }, { $unset: { loginOtp: 1 } });
  if (consumed.modifiedCount !== 1) throw new ApiError(400, INVALID_CODE);

  if (user.emailVerified === false) {
    // an old half-finished signup: the code proves the address, so finish it and drop its unconfirmed password
    user.emailVerified = true;
    user.password = undefined;
  }

  return sendSession(res, user, 200, "Logged in with email code");
});
