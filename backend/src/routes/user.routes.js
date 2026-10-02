import { Router } from "express";
import { checkAuthStatus, loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.get("/check", verifyJWT, checkAuthStatus)
router.post("/register", registerUser)
router.post("/login", loginUser)
router.post("/logout", verifyJWT, logoutUser)


export { router as userRouter }