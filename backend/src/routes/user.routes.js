import { Router } from "express";
import {
  getProfile,
  resetPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "../controllers/profile.controller.js";
import {
  checkAuthStatus,
  getAuthConfig,
  googleLogin,
  loginUser,
  logoutUser,
  registerUser,
  sendSignupOtp,
  verifySignupOtp,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.get("/config", getAuthConfig)
router.get("/check", verifyJWT, checkAuthStatus)
router.post("/signup/send-otp", sendSignupOtp)
router.post("/signup/verify-otp", verifySignupOtp)
router.post("/register", registerUser)
router.post("/login", loginUser)
router.post("/google", googleLogin)
router.post("/logout", verifyJWT, logoutUser)

// profile + password change (logged-in users only)
router.get("/profile", verifyJWT, getProfile)
router.post("/password/send-otp", verifyJWT, sendPasswordResetOtp)
router.post("/password/verify-otp", verifyJWT, verifyPasswordResetOtp)
router.post("/password/reset", verifyJWT, resetPassword)


export { router as userRouter }
