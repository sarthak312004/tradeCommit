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
    console.error("BREVO_API_KEY and MAIL_FROM_EMAIL must be set to send email");
    throw new ApiError(500, "Email service is not configured");
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
    console.error("Brevo rejected the email:", response.status, await response.text().catch(() => ""));
    throw new ApiError(502, "Could not send the verification email. Please try again.");
  }
};
