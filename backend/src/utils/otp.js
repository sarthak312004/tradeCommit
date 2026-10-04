import crypto from "node:crypto";

// One-time codes for email verification. Only an HMAC of the code is stored, never the code itself.

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // a code is valid for 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // at most one email per minute
export const OTP_MAX_ATTEMPTS = 5; // wrong guesses before a new code is required

const secret = () => process.env.ACCESS_TOKEN_SECRET ?? process.env.ACCESS_TOKEN_SECRETE;

export const generateOtp = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

const hashOtp = (otp, email) =>
  crypto.createHmac("sha256", secret()).update(`${email}:${otp}`).digest("hex");

export const buildOtpRecord = (otp, email) => ({
  hash: hashOtp(otp, email),
  expiresAt: new Date(Date.now() + OTP_TTL_MS),
  attempts: 0,
  sentAt: new Date(),
});

export const isOtpMatch = (otp, email, storedHash) => {
  const candidate = Buffer.from(hashOtp(otp, email));
  const stored = Buffer.from(storedHash ?? "");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};

export const canSendOtp = (record) =>
  !record?.sentAt || Date.now() - new Date(record.sentAt).getTime() >= OTP_RESEND_COOLDOWN_MS;
