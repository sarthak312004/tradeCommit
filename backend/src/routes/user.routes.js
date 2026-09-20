import { Router } from "express";
import { registerHandler } from "../controllers/user.controllers.js";
import { asyncHandler } from "../utils/asynHandler.js"

const router = Router()

router.post("/register", asyncHandler(registerHandler))

export { router as userRouter }