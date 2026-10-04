import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) throw new ApiError(401, "Unauthorized request");

  let decoded;
  try {
    const accessTokenSecret =
      process.env.ACCESS_TOKEN_SECRET ?? process.env.ACCESS_TOKEN_SECRETE;
    decoded = jwt.verify(token, accessTokenSecret);
  } catch {
    throw new ApiError(401, "Access token expired or invalid");
  }

  const user = await User.findById(decoded._id).select("-password -refreshToken");
  if (!user) throw new ApiError(401, "Invalid access token");

  if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new ApiError(401, "Password was changed. Please log in again.");
  }

  req.user = user;
  next();
});