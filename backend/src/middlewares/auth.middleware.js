import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { setAuthCookies } from "../utils/authCookies.js";

const accessSecret = () => process.env.ACCESS_TOKEN_SECRET ?? process.env.ACCESS_TOKEN_SECRETE;

/** Returns the decoded token, or null when it is missing, malformed, tampered with or expired. */
const decode = (token, secret) => {
  if (!token) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

// sessions issued before the last password change are rejected, so a password change logs out other devices
const issuedBeforePasswordChange = (user, decoded) =>
  Boolean(user.passwordChangedAt) && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  const decoded = decode(token, accessSecret());

  if (decoded) {
    const user = await User.findById(decoded._id).select("-password -refreshToken");
    if (!user) throw new ApiError(401, "Invalid access token");
    if (issuedBeforePasswordChange(user, decoded)) {
      throw new ApiError(401, "Password was changed. Please log in again.");
    }
    req.user = user;
    return next();
  }

  // The access token is missing or expired. If the browser still holds a valid refresh token
  // (the "remember me" cookie that survives closing the browser), renew the session silently.
  const refreshDecoded = decode(req.cookies?.refreshToken, process.env.REFRESH_TOKEN_SECRET);
  if (!refreshDecoded) {
    throw new ApiError(401, token ? "Access token expired or invalid" : "Unauthorized request");
  }

  const user = await User.findById(refreshDecoded._id).select("-password -refreshToken");
  if (!user || issuedBeforePasswordChange(user, refreshDecoded)) {
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  // fresh pair: the session keeps sliding forward while the user keeps coming back
  setAuthCookies(res, user.generateAccessToken(), user.generateRefreshToken());

  req.user = user;
  next();
});
