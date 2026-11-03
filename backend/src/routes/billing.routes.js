import { Router } from "express";
import { billingPortal, billingStatus, cancelSubscription, createCheckout, resumeSubscription, syncSubscription } from "../controllers/billing.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { rateLimit } from "../middlewares/rateLimit.middleware.js";

const router = Router()

// Per signed-in user (these run after verifyJWT). Failed calls to the provider are given back.
const perUser = (req) => (req.user?._id ? `u:${req.user._id}` : null)
const syncLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, refundFailed: true, keyBy: perUser, message: "You have refreshed billing a few times already. Please try again in an hour." })
const changeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, refundFailed: true, keyBy: perUser })

// Starts a hosted checkout for the logged-in user. The webhook is mounted separately in app.js (it needs the raw body).
router.post("/checkout", verifyJWT, createCheckout)

// Self-service management. Ownership comes from req.user only; Dodo ids are read from the user document, never from the request.
router.get("/status", verifyJWT, billingStatus)
router.post("/portal", verifyJWT, changeLimiter, billingPortal)
router.post("/cancel", verifyJWT, changeLimiter, cancelSubscription)
router.post("/resume", verifyJWT, changeLimiter, resumeSubscription)
router.post("/sync", verifyJWT, syncLimiter, syncSubscription)

export { router as billingRouter }
