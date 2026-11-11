import { EmailVerification } from "../models/emailVerification.models.js";
import { User } from "../models/user.models.js";
import { DEFAULT_HEADER_SCENE } from "../constants/headerBackdrop.js";
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
import { generateUsername, sendSession } from "./user.controller.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CODE = "Invalid or expired code. Request a new one.";

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const codeResponse = (res, email, sent = true, retryAfter = OTP_RESEND_COOLDOWN_MS / 1000) =>
  res.status(200).json(
    new ApiResponse(
      200,
      { email, sent, retryAfter },
      "If this email can be used, a code has been sent"
    )
  );

const sendCode = async ({ email, user = null, verification = null }) => {
  const otp = generateOtp();
  const record = buildOtpRecord(otp, email);

  if (user) {
    await User.updateOne({ _id: user._id }, { $set: { loginOtp: record } });
  } else if (verification) {
    await EmailVerification.updateOne(
      { _id: verification._id },
      { $set: { ...record, purgeAt: record.expiresAt } }
    );
  } else {
    await EmailVerification.create({ email, ...record, purgeAt: record.expiresAt });
  }

  try {
    await sendOtpEmail({
      to: email,
      name: user?.fullname || undefined,
      otp,
      purpose: user ? "login" : "signup",
    });
  } catch (error) {
    if (user) {
      await User.updateOne({ _id: user._id, "loginOtp.hash": record.hash }, { $unset: { loginOtp: 1 } });
    } else {
      await EmailVerification.deleteOne({ email, hash: record.hash });
    }
    throw error;
  }
};

// POST /api/v1/auth/signup/send-otp. Existing accounts receive a login code through the same email-first flow.
export const sendSignupOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");

  const user = await User.findOne({ email }).select("+loginOtp");
  if (user) {
    if (!canSendOtp(user.loginOtp)) {
      return codeResponse(res, email, false, retryAfterSeconds(user.loginOtp));
    }
    await sendCode({ email, user });
    return codeResponse(res, email);
  }

  let verification = await EmailVerification.findOne({ email });
  if (verification && !canSendOtp(verification)) {
    return codeResponse(res, email, false, retryAfterSeconds(verification));
  }

  try {
    await sendCode({ email, verification });
  } catch (error) {
    if (error?.code === 11000) {
      verification = await EmailVerification.findOne({ email });
      if (verification && !canSendOtp(verification)) {
        return codeResponse(res, email, false, retryAfterSeconds(verification));
      }
    }
    throw error;
  }

  return codeResponse(res, email);
});

const validateCode = async (record, email, code, onWrongAttempt) => {
  if (!record?.hash) throw new ApiError(400, INVALID_CODE);
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }
  if (!isOtpMatch(code, email, record.hash)) {
    await onWrongAttempt();
    throw new ApiError(400, "Incorrect code. Please try again.");
  }
};

const markEmailVerified = async (user) => {
  if (user.emailVerified === false) {
    user.emailVerified = true;
    user.password = undefined;
    await user.save({ validateBeforeSave: false });
  }
};

const createEmailUser = async (email) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const user = await User.create({
        username: generateUsername("", email),
        email,
        fullname: "",
        emailVerified: true,
        onboardingCompleted: false,
        headerBackdrop: { mode: "scene", scene: DEFAULT_HEADER_SCENE, imageUrl: null },
      });
      return { user, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (error.keyPattern?.username) continue;

      const existing = await User.findOne({ email }).select("+loginOtp");
      if (existing) {
        await markEmailVerified(existing);
        return { user: existing, created: false };
      }
      throw error;
    }
  }
  throw new ApiError(503, "Could not create your account right now. Please try again.");
};

// POST /api/v1/auth/signup/verify-otp. A new User is created only after the email code is accepted.
export const verifySignupOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";

  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const user = await User.findOne({ email }).select("+loginOtp");
  if (user?.loginOtp?.hash) {
    const record = user.loginOtp;
    await validateCode(record, email, code, () =>
      User.updateOne({ _id: user._id, "loginOtp.hash": record.hash }, { $inc: { "loginOtp.attempts": 1 } })
    );

    const consumed = await User.updateOne(
      { _id: user._id, "loginOtp.hash": record.hash },
      { $unset: { loginOtp: 1 } }
    );
    if (consumed.modifiedCount !== 1) throw new ApiError(400, INVALID_CODE);
    await markEmailVerified(user);
    return sendSession(res, user, 200, "Email verified");
  }

  const verification = await EmailVerification.findOne({ email });
  const record = verification;
  await validateCode(record, email, code, () =>
    EmailVerification.updateOne({ _id: verification._id, hash: record.hash }, { $inc: { attempts: 1 } })
  );

  const consumed = await EmailVerification.findOneAndDelete({ _id: verification._id, hash: record.hash });
  if (!consumed) throw new ApiError(400, INVALID_CODE);

  const { user: createdUser, created } = await createEmailUser(email);
  return sendSession(res, createdUser, created ? 201 : 200, created ? "Account created" : "Email verified");
});