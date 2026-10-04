import { ApiError } from "./ApiError.js";

// Sends email through Brevo's HTTPS API. Render's free tier blocks outbound SMTP ports,
// so a plain HTTP call is the reliable option (no nodemailer / extra dependency needed).

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const buildOtpEmail = ({ name, otp }) => {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return {
    subject: `${otp} is your TradeCommit verification code`,
    text: `${name ? `Hi ${name},` : "Hi,"}\n\nYour TradeCommit verification code is ${otp}. It expires in 10 minutes.\n\nIf you didn't create an account, you can ignore this email.`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#18181b">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 12px;font-size:15px">Use this code to verify your email for TradeCommit:</p>
  <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
  <p style="margin:0 0 8px;font-size:13px;color:#52525b">It expires in 10 minutes.</p>
  <p style="margin:0;font-size:13px;color:#71717a">If you didn't create an account, you can ignore this email.</p>
</div>`,
  };
};

export const sendOtpEmail = async ({ to, name, otp }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;

  if (!apiKey || !senderEmail) {
    if (process.env.NODE_ENV !== "production") {
      // local development without Brevo: read the code from the server console
      console.log(`[mail:dev] verification code for ${to}: ${otp}`);
      return;
    }
    console.error("BREVO_API_KEY and MAIL_FROM_EMAIL must be set to send email");
    throw new ApiError(500, "Email service is not configured");
  }

  const { subject, text, html } = buildOtpEmail({ name, otp });

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
