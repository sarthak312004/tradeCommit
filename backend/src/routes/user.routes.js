import { Router } from "express";
import { loginUser, logoutUser, registerUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.post("/api/v1/auth/register", registerUser)
router.post("/api/v1/auth/login", loginUser)
router.post("/api/v1/auth/logout", verifyJWT, logoutUser)


export { router as userRouter }