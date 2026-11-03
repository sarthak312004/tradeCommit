import { Router } from "express";
import { createCheckout } from "../controllers/billing.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

// Starts a hosted checkout for the logged-in user. The webhook is mounted separately in app.js (it needs the raw body).
router.post("/checkout", verifyJWT, createCheckout)

export { router as billingRouter }
