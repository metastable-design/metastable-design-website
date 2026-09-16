// src/verify-firebase-token.js
// Confirms a Firebase Auth ID token sent from the browser was genuinely
// issued by Firebase for this project, and returns the user's uid. This is
// the server-side equivalent of Admin SDK's verifyIdToken(), reimplemented
// with Web Crypto because firebase-admin needs Node.js APIs Workers doesn't
// have. Never trust a uid the browser sends you without doing this check —
// anyone can put any uid in a request body.

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwksCache = null;
let jwksCacheExpiry = 0;

export async function verifyFirebaseToken(idToken, projectId) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(base64urlDecodeToString(headerB64));
  const payload = JSON.parse(base64urlDecodeToString(payloadB64));

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("Token expired");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Bad issuer");
  if (payload.aud !== projectId) throw new Error("Bad audience");
  if (!payload.sub) throw new Error("Missing subject");

  const jwks = await fetchJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signature = base64urlDecodeToBuffer(signatureB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!valid) throw new Error("Invalid signature");

  return { uid: payload.sub, email: payload.email || null };
}

async function fetchJwks() {
  if (jwksCache && jwksCacheExpiry > Date.now()) return jwksCache;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Could not fetch Firebase signing keys");
  jwksCache = await res.json();
  jwksCacheExpiry = Date.now() + 60 * 60 * 1000; // Google rotates these infrequently
  return jwksCache;
}

function base64urlDecodeToString(str) {
  return atob(padBase64Url(str));
}

function base64urlDecodeToBuffer(str) {
  const binary = atob(padBase64Url(str));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function padBase64Url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padLength);
}
