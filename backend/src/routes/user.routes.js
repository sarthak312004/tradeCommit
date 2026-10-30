import { Router } from "express";
import {
  getProfile,
  updateProfile,
  completeOnboarding,
  setHeaderBackdrop,
  setFocusPreferences,
  uploadHeaderBackdropImage,
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
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router()

router.get("/config", getAuthConfig)
router.get("/check", verifyJWT, checkAuthStatus)
router.post("/login", loginUser)
// log in with an emailed code instead of a password
router.post("/login/send-otp", sendLoginOtp)
router.post("/login/verify-otp", verifyLoginOtp)
// Google is both log in and sign up (creates the account on first use)
router.post("/google", googleLogin)
router.post("/logout", verifyJWT, logoutUser)

// forgot password (not logged in): email code -> proof token -> new password
router.post("/forgot-password/send-otp", sendForgotPasswordOtp)
router.post("/forgot-password/verify-otp", verifyForgotPasswordOtp)
router.post("/forgot-password/reset", resetForgottenPassword)

// profile + password change (logged-in users only)
router.get("/profile", verifyJWT, getProfile)
// add / edit the display name and username (sign-up no longer asks for them)
router.patch("/profile", verifyJWT, updateProfile)
router.post("/onboarding/complete", verifyJWT, completeOnboarding)
// header background: a built-in scene / none (JSON), or the user's own picture (multipart)
router.put("/header-backdrop", verifyJWT, setHeaderBackdrop)
router.put("/focus-preferences", verifyJWT, setFocusPreferences)
router.post("/header-backdrop/image", verifyJWT, upload.single("image"), uploadHeaderBackdropImage)
router.post("/password/send-otp", verifyJWT, sendPasswordResetOtp)
router.post("/password/verify-otp", verifyJWT, verifyPasswordResetOtp)
router.post("/password/reset", verifyJWT, resetPassword)


export { router as userRouter }
