import { User } from "../models/user.models.js";
import { BillingEvent } from "../models/billingEvent.models.js";
import { getDodoClient } from "../utils/dodoClient.js";
import { createCheckoutHandler, createWebhookHandler } from "../utils/billingService.js";
import { createBillingManageHandlers } from "../utils/billingManage.js";
import { sendBillingEmail } from "../utils/mailer.js";

// POST /api/v1/billing/checkout (logged-in users) and POST /api/v1/billing/webhook (signature-verified, mounted in app.js).
export const createCheckout = createCheckoutHandler({ getClient: getDodoClient });
// Billing emails are best effort and sent after the state change (see sendBillingEmail), so they never fail a webhook or a request.
const notify = (kind, user, update) =>
  sendBillingEmail({ to: user.email, name: user.fullname || user.username, kind, accessUntil: update?.planAccessUntil ?? user.planAccessUntil });
export const handleDodoWebhook = createWebhookHandler({ getClient: getDodoClient, deps: { User, BillingEvent, notify } });

// Self-service management (all behind verifyJWT in billing.routes.js): GET status, POST portal | cancel | resume | sync.
export const { status: billingStatus, portal: billingPortal, cancel: cancelSubscription, resume: resumeSubscription, sync: syncSubscription } =
  createBillingManageHandlers({ User, getClient: getDodoClient, sendEmail: sendBillingEmail });
