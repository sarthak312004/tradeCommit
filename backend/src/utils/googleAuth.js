import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { ApiError } from "./ApiError.js";

// Verifies a Google Identity Services ID token (the `credential` the Google button returns)
// against Google's published signing keys, using only jsonwebtoken + Node's crypto.

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const DEFAULT_KEY_TTL_MS = 60 * 60 * 1000;

let keyCache = { keys: [], expiresAt: 0 };

const loadGoogleKeys = async ({ force = false } = {}) => {
  if (!force && keyCache.expiresAt > Date.now()) return keyCache.keys;

  let response;
  try {
    response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new ApiError(502, "Could not reach Google. Please try again.");
  }
  if (!response.ok) throw new ApiError(502, "Could not reach Google. Please try again.");

  const { keys = [] } = await response.json();
  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1];
  keyCache = { keys, expiresAt: Date.now() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_KEY_TTL_MS) };
  return keys;
};

export const isGoogleAuthConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

/** @returns {{ googleId: string, email: string, name: string }} */
export const verifyGoogleCredential = async (credential) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, "Google sign-in is not configured");

  const failure = () => new ApiError(401, "Google sign-in failed. Please try again.");

  const kid = jwt.decode(credential, { complete: true })?.header?.kid;
  if (!kid) throw failure();

  let jwk = (await loadGoogleKeys()).find((key) => key.kid === kid);
  if (!jwk) jwk = (await loadGoogleKeys({ force: true })).find((key) => key.kid === kid); // keys rotate
  if (!jwk) throw failure();

  let payload;
  try {
    payload = jwt.verify(credential, crypto.createPublicKey({ key: jwk, format: "jwk" }), {
      algorithms: ["RS256"],
      audience: clientId,
      issuer: ISSUERS,
    });
  } catch {
    throw failure();
  }

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!payload.email || !emailVerified) throw new ApiError(401, "Your Google email address is not verified");

  return { googleId: payload.sub, email: String(payload.email).toLowerCase(), name: payload.name ?? "" };
};
