import crypto from "node:crypto";
import { EmailVerification } from "../models/emailVerification.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isGoogleAuthConfigured, verifyGoogleCredential } from "../utils/googleAuth.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { clearAuthCookies, setAuthCookies } from "../utils/authCookies.js";
import { DEFAULT_HEADER_SCENE } from "../constants/headerBackdrop.js";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const generateTokens = async (user) => {
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return { accessToken, refreshToken };
};

/** Logs the user in: sets the auth cookies and returns the public user. */
export const sendSession = async (res, user, statusCode, message) => {
  const { accessToken, refreshToken } = await generateTokens(user);
  const publicUser = await User.findById(user._id).select("-password -refreshToken");

  return setAuthCookies(res, accessToken, refreshToken)
    .status(statusCode)
    .json(new ApiResponse(statusCode, { user: publicUser, accessToken, refreshToken }, message));
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const PURGE_GRACE_MS = 5 * 60 * 1000; // keep a spent code row a little longer than the code itself

// GET /api/v1/auth/config  (tells the login page whether to show the Google button)
export const getAuthConfig = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { googleClientId: isGoogleAuthConfigured() ? process.env.GOOGLE_CLIENT_ID : null }, "Auth config")
  );
});

// ---- Sign-up is two steps: email, then the emailed code. No form, no password, no username ----------
//   1. POST /auth/signup/send-otp    { email }        -> emails a 6-digit code
//   2. POST /auth/signup/verify-otp  { email, otp }   -> accepts the code, creates the account if needed, logs in
// The name is taken from the email address and the username is generated from it; the password is optional.
// All of it can be edited later in the Profile section.

// "sarthak.kumar92+trading@gmail.com" -> "Sarthak Kumar". Empty when nothing name-like is in the address.
const nameFromEmail = (email) => {
  const words = email
    .split("@")[0]
    .split("+")[0]
    .split(/[^a-zA-Z]+/)
    .filter((word) => word.length > 1);
  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 80);
};

// A unique username built from the name, e.g. "Sarthak Kumar" -> "sarthak_kumar_4f9a2c" (<= 12 + 1 + 6 = 19 chars).
const generateUsername = (fullname, email) => {
  const fromName = fullname.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 12).replace(/_+$/, "");
  const fromEmail = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const base = [fromName, fromEmail].find((candidate) => candidate.length >= 3) ?? "trader";
  return `${base}_${crypto.randomBytes(3).toString("hex")}`;
};

/**
 * Creates the account for an email whose ownership was just proven, or returns the account that already exists.
 * The unique email index makes this safe when two requests race: the loser's insert fails and it reads the winner's user.
 */
const findOrCreateVerifiedUser = async (email) => {
  const fullname = nameFromEmail(email); // a starting point: the user can correct it in the Profile section
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const user = await User.create({
        username: generateUsername(fullname, email),
        fullname,
        email,
        emailVerified: true,
        onboardingCompleted: false,
        headerBackdrop: { mode: "scene", scene: DEFAULT_HEADER_SCENE, imageUrl: null },
      });
      return { user, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (error.keyPattern?.username) continue; // generated name collided: draw another one
      const existing = await User.findOne({ email });
      if (existing) return { user: existing, created: false };
      throw error;
    }
  }
  throw new ApiError(503, "Could not create your account right now. Please try again.");
};

// POST /api/v1/auth/signup/send-otp  (also used by "Resend code")
export const sendSignupOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Enter a valid email address");

  const existing = await User.findOne({ email }).select("emailVerified");
  if (existing && existing.emailVerified !== false) {
    throw new ApiError(409, "An account with this email already exists. Log in instead.");
  }
  // an unverified leftover from the old register flow must not block the real owner of the address
  if (existing) await User.deleteOne({ _id: existing._id });

  const pending = await EmailVerification.findOne({ email }).select("sentAt");
  if (pending && !canSendOtp(pending)) {
    // a code went out a moment ago: don't send another, just tell the client how long to wait
    return res
      .status(200)
      .json(new ApiResponse(200, { email, sent: false, retryAfter: retryAfterSeconds(pending) }, "A code was just sent"));
  }

  const otp = generateOtp();
  const record = buildOtpRecord(otp, email);
  await EmailVerification.findOneAndUpdate(
    { email },
    {
      $set: { ...record, purgeAt: new Date(record.expiresAt.getTime() + PURGE_GRACE_MS) },
    },
    { upsert: true }
  );

  try {
    await sendOtpEmail({ to: email, otp });
  } catch (error) {
    await EmailVerification.deleteOne({ email }); // no cooldown for an email that never left
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { email, sent: true, retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000) }, "Verification code sent"));
});

// POST /api/v1/auth/signup/verify-otp  { email, otp }  -> account created (or found) + logged in
export const verifySignupOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";

  if (!email) throw new ApiError(400, "Email is required");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const record = await EmailVerification.findOne({ email });
  if (!record?.hash) {
    throw new ApiError(400, "Invalid or expired code. Request a new one.");
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }
  if (!isOtpMatch(code, email, record.hash)) {
    await EmailVerification.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  // Consume the code. Matching on the stored hash makes it single-use even if two requests race:
  // only one of them deletes the row, the other is told the code is no longer valid.
  const consumed = await EmailVerification.findOneAndDelete({ _id: record._id, hash: record.hash });
  if (!consumed) throw new ApiError(400, "Invalid or expired code. Request a new one.");

  // The code proves the address is theirs, so this is the only place a sign-up produces a session.
  const { user, created } = await findOrCreateVerifiedUser(email);

  if (!created && user.emailVerified === false) {
    // an old half-finished signup: the code proves the address, so finish it and drop its unconfirmed password
    user.emailVerified = true;
    user.password = undefined;
  }

  return sendSession(res, user, created ? 201 : 200, created ? "Account created" : "Logged in with email code");
});

// POST /api/v1/auth/login
export const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    throw new ApiError(400, "Email or username and password are required");
  }

  const user = await User.findOne({
    $or: [
      ...(email ? [{ email: normalizeEmail(email) }] : []),
      ...(username ? [{ username: String(username).trim().toLowerCase() }] : []),
    ],
  }).select("+password");

  if (user && !user.password && user.googleId) {
    throw new ApiError(400, "This account uses Google sign-in. Use the Google button instead.");
  }
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid credentials");
  }

  // a signup from the old flow that never confirmed its email: it has to be redone through the code step
  if (user.emailVerified === false) {
    throw new ApiError(403, "This sign-up was never completed. Create your account again to verify your email.");
  }

  return sendSession(res, user, 200, "User logged in successfully");
});

// POST /api/v1/auth/google  { credential }  -> LOGIN ONLY. Accounts are created through the email-code sign-up.
export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body ?? {};
  if (typeof credential !== "string" || !credential) throw new ApiError(400, "Google credential is required");

  const profile = await verifyGoogleCredential(credential);

  const user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });
  if (!user) {
    throw new ApiError(404, "No account found for this Google email. Create an account with your email first.");
  }

  let changed = false;
  if (!user.googleId) {
    user.googleId = profile.googleId; // existing email account: link it (Google has verified the address)
    changed = true;
  }
  if (user.emailVerified === false) {
    // an old half-finished signup: Google proves the address, so finish it and drop its unconfirmed password
    user.emailVerified = true;
    user.password = undefined;
    changed = true;
  }
  if (changed) await user.save({ validateBeforeSave: false });

  return sendSession(res, user, 200, "Signed in with Google");
});

export const checkAuthStatus = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { user: req.user }, "User authenticated"));
});

// POST /api/auth/logout (needs verifyJWT so req.user exists)
export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });

  return clearAuthCookies(res)
    .status(200)
    .json(new ApiResponse(200, null, "User logged out"));
});
