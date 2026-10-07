import { EmailVerification } from "../models/emailVerification.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isGoogleAuthConfigured, verifyGoogleCredential } from "../utils/googleAuth.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { clearAuthCookies, setAuthCookies } from "../utils/authCookies.js";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  SIGNUP_TOKEN_TTL_MS,
  buildOtpRecord,
  canSendOtp,
  generateOtp,
  generateSignupToken,
  hashSignupToken,
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

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const PURGE_GRACE_MS = 5 * 60 * 1000; // keep a spent code row a little longer than the code itself

// GET /api/v1/auth/config  (tells the login page whether to show the Google button)
export const getAuthConfig = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { googleClientId: isGoogleAuthConfigured() ? process.env.GOOGLE_CLIENT_ID : null }, "Auth config")
  );
});

// ---- Sign-up is three steps, and no User document exists until the last one ---------------------
//   1. POST /auth/signup/send-otp    { email }                       -> emails a 6-digit code
//   2. POST /auth/signup/verify-otp  { email, otp }                  -> { signupToken } (proof the address is theirs)
//   3. POST /auth/register           { email, signupToken, fullname, username, password } -> creates the account + logs in

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
      $unset: { verifiedAt: 1, tokenHash: 1 },
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

// POST /api/v1/auth/signup/verify-otp  { email, otp }
export const verifySignupOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const raw = req.body?.otp;
  const code = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";

  if (!email) throw new ApiError(400, "Email is required");
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) {
    throw new ApiError(400, `Enter the ${OTP_LENGTH}-digit code`);
  }

  const record = await EmailVerification.findOne({ email });
  if (!record?.hash || record.verifiedAt) {
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

  const signupToken = generateSignupToken();
  // the verifiedAt guard makes the code single-use even if two requests race
  const accepted = await EmailVerification.findOneAndUpdate(
    { _id: record._id, verifiedAt: { $exists: false } },
    {
      $set: {
        verifiedAt: new Date(),
        tokenHash: hashSignupToken(signupToken),
        purgeAt: new Date(Date.now() + SIGNUP_TOKEN_TTL_MS),
      },
      $unset: { hash: 1 },
    }
  );
  if (!accepted) throw new ApiError(400, "Invalid or expired code. Request a new one.");

  return res.status(200).json(new ApiResponse(200, { email, signupToken }, "Email verified"));
});

// POST /api/v1/auth/register -> creates the account (only possible with the proof from verify-otp) and logs in
export const registerUser = asyncHandler(async (req, res) => {
  const { email, signupToken, username, fullname, password } = req.body ?? {};

  if ([email, signupToken, username, fullname, password].some((f) => typeof f !== "string" || !f.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = username.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    throw new ApiError(400, "Username must be 3-20 characters: letters, numbers or underscores");
  }
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
  if (fullname.trim().length > 80) throw new ApiError(400, "Name is too long");

  // This is the actual gate: without a code that was accepted for THIS email, nothing is created.
  const proof = await EmailVerification.findOne({
    email: normalizedEmail,
    tokenHash: hashSignupToken(signupToken),
  });
  if (!proof?.verifiedAt || Date.now() - new Date(proof.verifiedAt).getTime() > SIGNUP_TOKEN_TTL_MS) {
    // 410 tells the client to send the user back to the email step
    throw new ApiError(410, "Your email verification expired. Please verify your email again.");
  }

  if (await User.exists({ username: normalizedUsername })) {
    throw new ApiError(409, "That username is taken. Try another one.");
  }

  let user;
  try {
    user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      fullname: fullname.trim(),
      password,
      emailVerified: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(
        409,
        error.keyPattern?.username ? "That username is taken. Try another one." : "An account with this email already exists. Log in instead."
      );
    }
    throw error;
  }

  await EmailVerification.deleteOne({ _id: proof._id }); // the proof is single-use

  return sendSession(res, user, 201, "Account created");
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
