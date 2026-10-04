import crypto from "node:crypto";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isGoogleAuthConfigured, verifyGoogleCredential } from "../utils/googleAuth.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, buildOtpRecord, canSendOtp, generateOtp, isOtpMatch } from "../utils/otp.js";

const isProd = process.env.NODE_ENV === "production";
const isCrossSite = isProd && Boolean(
  process.env.CORS_ORIGIN?.split(",").some((origin) => origin.trim())
);

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isCrossSite ? "none" : "lax",
};

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
const sendSession = async (res, user, statusCode, message) => {
  const { accessToken, refreshToken } = await generateTokens(user);
  const publicUser = await User.findById(user._id).select("-password -refreshToken");

  return res
    .status(statusCode)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(statusCode, { user: publicUser, accessToken, refreshToken }, message));
};

/** Tells the client to show the "enter your code" step instead of logging in. */
const sendNeedsVerification = (res, statusCode, email, message) =>
  res.status(statusCode).json(new ApiResponse(statusCode, { needsVerification: true, email }, message));

/**
 * Emails a fresh 6-digit code. Returns false (and sends nothing) while the resend cooldown is running,
 * unless `force` is set. The user document must have been loaded with `+emailOtp`.
 */
const sendVerificationOtp = async (user, { force = false } = {}) => {
  if (!force && !canSendOtp(user.emailOtp)) return false;

  const otp = generateOtp();
  user.emailOtp = buildOtpRecord(otp, user.email);
  await user.save({ validateBeforeSave: false });

  try {
    await sendOtpEmail({ to: user.email, name: user.fullname, otp });
  } catch (error) {
    user.emailOtp = undefined; // don't make the user wait out the cooldown for an email that never left
    await user.save({ validateBeforeSave: false });
    throw error;
  }
  return true;
};

const uniqueUsernameFor = async (email) => {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "trader";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${crypto.randomInt(1000, 10000)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${Date.now().toString(36)}`;
};

// GET /api/v1/auth/config  (tells the login page whether to show the Google button)
export const getAuthConfig = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { googleClientId: isGoogleAuthConfigured() ? process.env.GOOGLE_CLIENT_ID : null }, "Auth config")
  );
});

// POST /api/v1/auth/register  -> creates an unverified account and emails a code (no login yet)
export const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullname, password } = req.body;

  if ([username, email, fullname, password].some((f) => typeof f !== "string" || !f.trim())) {
    throw new ApiError(400, "All fields are required");
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    throw new ApiError(400, "Enter a valid email address");
  }
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username.trim().toLowerCase();

  const matches = await User.find({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
  }).select("emailVerified");

  if (matches.some((match) => match.emailVerified !== false)) {
    throw new ApiError(409, "Username or email already in use");
  }
  // Only abandoned, never-verified signups are in the way: free the name/email so the
  // real owner of the address can register (otherwise anyone could squat an email).
  if (matches.length > 0) {
    await User.deleteMany({ _id: { $in: matches.map((match) => match._id) } });
  }

  let user;
  try {
    user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      fullname: fullname.trim(),
      password,
      emailVerified: false,
    });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "Username or email already in use");
    throw error;
  }

  await sendVerificationOtp(user, { force: true });

  return sendNeedsVerification(res, 201, user.email, "Verification code sent");
});

// POST /api/v1/auth/verify-email  { email, otp }  -> verifies the address and logs the user in
export const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.otp === "string" || typeof req.body?.otp === "number" ? String(req.body.otp).trim() : "";

  if (!email) throw new ApiError(400, "Email is required");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const user = await User.findOne({ email }).select("+emailOtp");
  const record = user?.emailOtp;

  if (!user || user.emailVerified !== false || !record?.hash) {
    throw new ApiError(400, "Invalid or expired code. Request a new one.");
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if ((record.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }
  if (!isOtpMatch(code, user.email, record.hash)) {
    await User.updateOne({ _id: user._id }, { $inc: { "emailOtp.attempts": 1 } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  user.emailVerified = true;
  user.emailOtp = undefined;

  return sendSession(res, user, 200, "Email verified");
});

// POST /api/v1/auth/resend-otp  { email }
export const resendVerificationOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email }).select("+emailOtp");
  // Same answer whether or not the address exists, so this can't be used to probe for accounts.
  if (user && user.emailVerified === false) await sendVerificationOtp(user);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "If this email is waiting for verification, a new code has been sent"));
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
  }).select("+password +emailOtp");

  if (user && !user.password && user.googleId) {
    throw new ApiError(400, "This account uses Google sign-in. Use the Google button instead.");
  }
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Invalid credentials");
  }

  // right password, but the email was never confirmed: send a new code and continue on the code screen
  if (user.emailVerified === false) {
    await sendVerificationOtp(user);
    return sendNeedsVerification(res, 200, user.email, "Please verify your email");
  }

  return sendSession(res, user, 200, "User logged in successfully");
});

// POST /api/v1/auth/google  { credential }  -> sign in or sign up with a Google ID token
export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body ?? {};
  if (typeof credential !== "string" || !credential) throw new ApiError(400, "Google credential is required");

  const profile = await verifyGoogleCredential(credential);

  let user = await User.findOne({ $or: [{ googleId: profile.googleId }, { email: profile.email }] });

  if (!user) {
    user = await User.create({
      email: profile.email,
      fullname: profile.name.trim() || profile.email.split("@")[0],
      username: await uniqueUsernameFor(profile.email),
      googleId: profile.googleId,
      emailVerified: true,
    });
  } else {
    let changed = false;
    if (!user.googleId) {
      user.googleId = profile.googleId; // existing email account: link it (Google has verified the address)
      changed = true;
    }
    if (user.emailVerified === false) {
      // the real owner proved the address, so drop whatever password the unverified signup had set
      user.emailVerified = true;
      user.password = undefined;
      user.emailOtp = undefined;
      changed = true;
    }
    if (changed) await user.save({ validateBeforeSave: false });
  }

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

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, null, "User logged out"));
});
