import { ApiError } from "./ApiError.js";

// Sends email through Brevo's HTTPS API. Render's free tier blocks outbound SMTP ports,
// so a plain HTTP call is the reliable option (no nodemailer / extra dependency needed).

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const COPY = {
  signup: {
    subject: (otp) => `${otp} is your TradeCommit verification code`,
    intro: "Use this code to verify your email for TradeCommit:",
    footer: "If you didn't create an account, you can ignore this email.",
  },
  login: {
    subject: (otp) => `${otp} is your TradeCommit login code`,
    intro: "Use this code to log in to TradeCommit:",
    footer: "If you didn't try to log in, ignore this email. Your account stays safe unless someone else can read your inbox.",
  },
  "password-reset": {
    subject: (otp) => `${otp} is your TradeCommit password reset code`,
    intro: "Use this code to confirm it's you and change your TradeCommit password:",
    footer: "If you didn't ask to change your password, ignore this email and consider changing your password.",
  },
};

const buildOtpEmail = ({ name, otp, purpose }) => {
  const copy = COPY[purpose] ?? COPY.signup;
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return {
    subject: copy.subject(otp),
    text: `${name ? `Hi ${name},` : "Hi,"}\n\n${copy.intro} ${otp}\nIt expires in 10 minutes.\n\n${copy.footer}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#18181b">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 12px;font-size:15px">${copy.intro}</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#52525b">It expires in 10 minutes.</p>
  <p style="margin:0;font-size:13px;color:#71717a">${copy.footer}</p>
</div>`,
  };
};

// purpose: "signup" (default), "login" or "password-reset" selects the wording of the email
export const sendOtpEmail = async ({ to, name, otp, purpose = "signup" }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV !== "production") {
      // local development without Brevo: read the code from the server console
      console.log(`[mail:dev] ${purpose} code for ${to}: ${otp}`);
      return;
    }
    const missing = [!apiKey && "BREVO_API_KEY", !senderEmail && "MAIL_FROM_EMAIL"].filter(Boolean).join(", ");
    console.error(`Cannot send email: missing environment variable(s) ${missing}`);
    throw new ApiError(503, "Email service is not set up yet. Please contact support.");
  }

  const { subject, text, html } = buildOtpEmail({ name, otp, purpose });

  let response;
  try {
    response = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || "TradeCommit", email: senderEmail },
        to: [{ email: to, ...(name ? { name } : {}) }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Brevo request failed:", error.message);
    throw new ApiError(502, "Could not send the verification email. Please try again.");
  }

  if (!response.ok) {
    // 401 = wrong API key, 400/403 = MAIL_FROM_EMAIL is not a verified sender in Brevo
    console.error("Brevo rejected the email:", response.status, await response.text().catch(() => ""));
    throw new ApiError(502, "Could not send the verification email. Please try again in a moment.");
  }
};

/* ------------------------------------------ billing emails ------------------------------------------ */
// Short, plain notices about the subscription. Best effort: a failed email never fails a billing request or a webhook,
// so sendBillingEmail swallows its own errors (and logs only the kind and status, never the address or the body).

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
};

const billingUrl = () => `${(process.env.APP_URL ?? "").trim().replace(/\/+$/, "")}/billing`;

const BILLING_COPY = {
  "cancellation-scheduled": ({ accessUntil }) => ({
    subject: "Your TradeCommit Pro cancellation is scheduled",
    lines: [
      formatDate(accessUntil)
        ? `Your subscription will not renew. You keep Pro until ${formatDate(accessUntil)}.`
        : "Your subscription will not renew. You keep Pro until the end of the period you paid for.",
      "Your data stays. After that, extra journals and planners become read-only.",
      "Changed your mind? You can resume any time before then from the billing page.",
    ],
    cta: "Manage subscription",
  }),
  "payment-failed": () => ({
    subject: "We couldn't take your TradeCommit payment",
    lines: ["Your last payment did not go through. Pro stays on for a few days while we retry.", "To avoid losing Pro, please update your payment method."],
    cta: "Update payment method",
  }),
  "downgrade-complete": () => ({
    subject: "Your TradeCommit plan is now Free",
    lines: ["Your Pro access has ended and your account is on the Free plan.", "Nothing was deleted. Extra journals and planners are read-only, and you can upgrade again any time."],
    cta: "View plans",
  }),
};

const buildBillingEmail = ({ name, kind, accessUntil }) => {
  const build = BILLING_COPY[kind];
  if (!build) return null;
  const { subject, lines, cta } = build({ accessUntil });
  const url = billingUrl();
  const hello = name ? `Hi ${name},` : "Hi,";
  return {
    subject,
    text: `${hello}\n\n${lines.join("\n\n")}\n\n${cta}: ${url}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:460px;margin:0 auto;padding:24px;color:#18181b">
  <p style="margin:0 0 16px;font-size:15px">${name ? `Hi ${escapeHtml(name)},` : "Hi,"}</p>
  ${lines.map((line) => `<p style="margin:0 0 12px;font-size:15px">${escapeHtml(line)}</p>`).join("\n  ")}
  <p style="margin:16px 0 0;font-size:15px"><a href="${escapeHtml(url)}" style="color:#18181b;font-weight:600">${escapeHtml(cta)}</a></p>
</div>`,
  };
};

// kind: "cancellation-scheduled" | "payment-failed" | "downgrade-complete"
export const sendBillingEmail = async ({ to, name, kind, accessUntil = null }) => {
  try {
    const email = to ? buildBillingEmail({ name, kind, accessUntil }) : null;
    if (!email) return false;

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.MAIL_FROM_EMAIL;
    if (!apiKey || !senderEmail) {
      if (process.env.NODE_ENV !== "production") console.log(`[mail:dev] billing email "${kind}" (not sent: Brevo is not configured)`);
      else console.error(`Cannot send billing email "${kind}": Brevo is not configured`);
      return false;
    }

    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || "TradeCommit", email: senderEmail },
        to: [{ email: to, ...(name ? { name } : {}) }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`Billing email "${kind}" rejected by Brevo:`, response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Billing email "${kind}" failed:`, error?.name);
    return false;
  }
};
