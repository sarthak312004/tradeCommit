import { Router } from "express";
import {
  getProfile,
  resetPassword,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from "../controllers/profile.controller.js";
import {
  resetForgottenPassword,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
} from "../controllers/forgotPassword.controller.js";
import { sendLoginOtp, verifyLoginOtp } from "../controllers/loginOtp.controller.js";
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
// log in with an emailed code instead of a password
router.post("/login/send-otp", sendLoginOtp)
router.post("/login/verify-otp", verifyLoginOtp)
router.post("/google", googleLogin)
router.post("/logout", verifyJWT, logoutUser)

// forgot password (not logged in): email code -> proof token -> new password
router.post("/forgot-password/send-otp", sendForgotPasswordOtp)
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp)
router.post("/forgot-password/reset", resetForgottenPassword)

// profile + password change (logged-in users only)
router.get("/profile", verifyJWT, getProfile)
router.post("/password/send-otp", verifyJWT, sendPasswordResetOtp)
router.post("/password/verify-otp", verifyJWT, verifyPasswordResetOtp)
router.post("/password/reset", verifyJWT, resetPassword)


export { router as userRouter }
