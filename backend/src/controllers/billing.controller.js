import { User } from "../models/user.models.js";
import { BillingEvent } from "../models/billingEvent.models.js";
import { getDodoClient } from "../utils/dodoClient.js";
import { createCheckoutHandler, createWebhookHandler } from "../utils/billingService.js";

// POST /api/v1/billing/checkout (logged-in users) and POST /api/v1/billing/webhook (signature-verified, mounted in app.js).
export const createCheckout = createCheckoutHandler({ getClient: getDodoClient });
export const handleDodoWebhook = createWebhookHandler({ getClient: getDodoClient, deps: { User, BillingEvent } });
