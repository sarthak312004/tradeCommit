import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOtpEmail } from "../utils/mailer.js";
import { deleteImagesFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { HEADER_SCENE_IDS, headerBackdropFolder } from "../constants/headerBackdrop.js";
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
import { USERNAME_PATTERN, sendSession } from "./user.controller.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes

const MAX_FULLNAME_LENGTH = 80;

const SESSION_EXPIRED = "Your verification expired. Please start again.";
const FOCUS_THEMES = new Set(["sage", "ocean", "amber"]);
const SPOTIFY_URL_PATTERN = /^\/(playlist|album|track|episode|show)\/[A-Za-z0-9]+\/?$/;

// What the client gets for the header picture: always a complete, valid object.
const toHeaderBackdrop = (user) => {
  const saved = user?.headerBackdrop;
  if (saved?.mode === "scene" && HEADER_SCENE_IDS.includes(saved.scene)) return { mode: "scene", scene: saved.scene, imageUrl: null };
  if (saved?.mode === "image" && saved.imageUrl) return { mode: "image", scene: null, imageUrl: saved.imageUrl };
  return { mode: "none", scene: null, imageUrl: null };
};

const toFocusPreferences = (user) => ({
  spotifyUrl: user?.focusPreferences?.spotifyUrl ?? "",
  focusTheme: FOCUS_THEMES.has(user?.focusPreferences?.focusTheme) ? user.focusPreferences.focusTheme : "sage",
});

// the old picture is only removed after the new choice is saved, and a failed delete never fails the request
const discardHeaderImage = (imageUrl, userId) => {
  if (imageUrl) void deleteImagesFromCloudinary([imageUrl], headerBackdropFolder(userId));
};

// PUT /api/v1/auth/header-backdrop   { mode: "none" } | { mode: "scene", scene }
// (a picture goes through POST /header-backdrop/image instead)
export const setHeaderBackdrop = asyncHandler(async (req, res) => {
  const mode = req.body?.mode;
  let next;
  if (mode === "none") {
    next = { mode: "none", scene: null, imageUrl: null };
  } else if (mode === "scene") {
    if (!HEADER_SCENE_IDS.includes(req.body?.scene)) throw new ApiError(400, "Choose one of the available scenes");
    next = { mode: "scene", scene: req.body.scene, imageUrl: null };
  } else {
    throw new ApiError(400, "Choose a scene, or remove the background");
  }

  const user = await User.findById(req.user._id).select("headerBackdrop");
  if (!user) throw new ApiError(404, "User not found");
  const previousImage = user.headerBackdrop?.imageUrl;

  await User.updateOne({ _id: user._id }, { $set: { headerBackdrop: next } });
  discardHeaderImage(previousImage, user._id);

  return res.status(200).json(new ApiResponse(200, { headerBackdrop: next }, "Header background saved"));
});

// PUT /api/v1/auth/focus-preferences { spotifyUrl, focusTheme }
export const setFocusPreferences = asyncHandler(async (req, res) => {
  const spotifyUrl = typeof req.body?.spotifyUrl === "string" ? req.body.spotifyUrl.trim() : null;
  const focusTheme = req.body?.focusTheme;

  if (spotifyUrl === null || spotifyUrl.length > 500) {
    throw new ApiError(400, "Enter a valid Spotify link");
  }
  if (spotifyUrl) {
    let parsed;
    try {
      parsed = new URL(spotifyUrl);
    } catch {
      throw new ApiError(400, "Enter a valid Spotify link");
    }
    if (
      parsed.protocol !== "https:" ||
      !["open.spotify.com", "spotify.com", "www.spotify.com"].includes(parsed.hostname) ||
      !SPOTIFY_URL_PATTERN.test(parsed.pathname)
    ) {
      throw new ApiError(400, "Enter a Spotify playlist, album, track, episode, or show link");
    }
  }
  if (!FOCUS_THEMES.has(focusTheme)) throw new ApiError(400, "Choose a valid focus theme");

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        "focusPreferences.spotifyUrl": spotifyUrl,
        "focusPreferences.focusTheme": focusTheme,
      },
    },
    { new: true, projection: "focusPreferences" }
  );
  if (!updated) throw new ApiError(404, "User not found");

  const preferences = { spotifyUrl, focusTheme };
  return res.status(200).json(new ApiResponse(200, { focusPreferences: preferences }, "Focus preferences saved"));
});

// POST /api/v1/auth/header-backdrop/image   multipart, field "image"
export const uploadHeaderBackdropImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Choose an image to upload");

  const user = await User.findById(req.user._id).select("headerBackdrop");
  if (!user) throw new ApiError(404, "User not found");
  const previousImage = user.headerBackdrop?.imageUrl;

  const uploaded = await uploadOnCloudinary(req.file.buffer, headerBackdropFolder(user._id));
  const next = { mode: "image", scene: null, imageUrl: uploaded.secure_url };

  try {
    await User.updateOne({ _id: user._id }, { $set: { headerBackdrop: next } });
  } catch (error) {
    discardHeaderImage(uploaded.secure_url, user._id); // don't leave an orphan behind
    throw error;
  }
  discardHeaderImage(previousImage, user._id);

  return res.status(201).json(new ApiResponse(201, { headerBackdrop: next }, "Header picture saved"));
});

// GET /api/v1/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        fullname: user.fullname ?? "",
        username: user.username,
        email: user.email,
        hasPassword: Boolean(user.password), // false for Google-only accounts: the dialog says "Set" instead of "Reset"
        onboardingCompleted: user.onboardingCompleted !== false,
        onboardingTradingStyle: user.onboardingTradingStyle ?? null,
        createdAt: user.createdAt,
        headerBackdrop: toHeaderBackdrop(user),
        focusPreferences: toFocusPreferences(user),
      },
      "Profile fetched"
    )
  );
});


// PATCH /api/v1/auth/profile   { fullname?, username? }
// Sign-up no longer asks for these, so this is where they are added and edited. Only the signed-in user's own
// document is touched (the id comes from req.user, never from the body).
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullname, username } = req.body ?? {};
  const changes = {};

  if (fullname !== undefined) {
    if (typeof fullname !== "string") throw new ApiError(400, "Enter a valid name");
    const cleaned = fullname.trim().replace(/\s+/g, " ");
    if (cleaned.length > MAX_FULLNAME_LENGTH) throw new ApiError(400, "Name is too long");
    changes.fullname = cleaned;
  }

  if (username !== undefined) {
    const cleaned = typeof username === "string" ? username.trim().toLowerCase() : "";
    if (!USERNAME_PATTERN.test(cleaned)) {
      throw new ApiError(400, "Username must be 3-20 characters: letters, numbers or underscores");
    }
    changes.username = cleaned;
  }

  if (!Object.keys(changes).length) throw new ApiError(400, "Nothing to update");

  if (changes.username && (await User.exists({ username: changes.username, _id: { $ne: req.user._id } }))) {
    throw new ApiError(409, "That username is taken. Try another one.");
  }

  let updated;
  try {
    updated = await User.findByIdAndUpdate(req.user._id, { $set: changes }, { new: true, projection: "fullname username" });
  } catch (error) {
    // two people picking the same name at once: the unique index decides
    if (error?.code === 11000) throw new ApiError(409, "That username is taken. Try another one.");
    throw error;
  }
  if (!updated) throw new ApiError(404, "User not found");

  return res
    .status(200)
    .json(new ApiResponse(200, { fullname: updated.fullname ?? "", username: updated.username }, "Profile updated"));
});


// POST /api/v1/auth/onboarding/complete
export const completeOnboarding = asyncHandler(async (req, res) => {
  const allowedStyles = new Set(["intraday", "swing", "position", "hybrid"])
  const tradingStyle = typeof req.body?.tradingStyle === "string" ? req.body.tradingStyle : ""
  if (!allowedStyles.has(tradingStyle)) throw new ApiError(400, "Choose a valid trading style")

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { onboardingCompleted: true, onboardingTradingStyle: tradingStyle } },
    { new: true }
  )
  if (!user) throw new ApiError(404, "User not found")

  return res.status(200).json(new ApiResponse(200, { onboardingCompleted: true, tradingStyle }, "Onboarding completed"))
})

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
