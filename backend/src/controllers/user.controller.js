import crypto from "node:crypto";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isGoogleAuthConfigured, verifyGoogleCredential } from "../utils/googleAuth.js";
import { clearAuthCookies, setAuthCookies } from "../utils/authCookies.js";
import { DEFAULT_HEADER_SCENE } from "../constants/headerBackdrop.js";

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

// GET /api/v1/auth/config  (tells the login page whether to show the Google button)
export const getAuthConfig = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, { googleClientId: isGoogleAuthConfigured() ? process.env.GOOGLE_CLIENT_ID : null }, "Auth config")
  );
});

// ---- Sign-up is Google only: one click, no form, no emailed code, no password ----------------------
//   POST /auth/google { credential }  -> logs in the existing account, or creates one on the first Google sign-in.
// Name and username come from the Google profile (both editable later in the Profile section);
// the password is optional and is set later through the existing emailed-code flow.

// "sarthak.kumar92+trading@gmail.com" -> "Sarthak Kumar". Fallback when Google sends no display name.
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

const cleanGoogleName = (name) => (typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 80) : "");

/**
 * Creates the account for a Google-verified email. The unique email and googleId indexes make this safe when two
 * requests race: the loser's insert fails with a duplicate-key error and it returns the winner's user instead.
 */
const createGoogleUser = async (profile) => {
  const fullname = cleanGoogleName(profile.name) || nameFromEmail(profile.email);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const user = await User.create({
        username: generateUsername(fullname, profile.email),
        fullname,
        email: profile.email,
        googleId: profile.googleId,
        emailVerified: true,
        onboardingCompleted: false,
        headerBackdrop: { mode: "scene", scene: DEFAULT_HEADER_SCENE, imageUrl: null },
      });
      return { user, created: true };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      if (error.keyPattern?.username) continue; // generated name collided: draw another one
      const existing =
        (await User.findOne({ googleId: profile.googleId })) ?? (await User.findOne({ email: profile.email }));
      if (existing) return { user: existing, created: false };
      throw error;
    }
  }
  throw new ApiError(503, "Could not create your account right now. Please try again.");
};

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

// POST /api/v1/auth/google  { credential }  -> log in, or sign up when no account exists for this Google account/email
export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body ?? {};
  if (typeof credential !== "string" || !credential) throw new ApiError(400, "Google credential is required");

  const profile = await verifyGoogleCredential(credential); // email is lower-cased and Google-verified

  // 1) the same Google account, 2) an existing email account (the email is unique, so never a second account)
  let user = await User.findOne({ googleId: profile.googleId });
  if (!user) user = await User.findOne({ email: profile.email });

  let created = false;
  if (!user) {
    ({ user, created } = await createGoogleUser(profile));
  }

  if (!created) {
    if (user.googleId && user.googleId !== profile.googleId) {
      // same email, different Google account (e.g. a reassigned address): never merge them
      throw new ApiError(409, "This email is linked to a different Google account.");
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
  }

  return sendSession(res, user, created ? 201 : 200, created ? "Account created with Google" : "Signed in with Google");
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
