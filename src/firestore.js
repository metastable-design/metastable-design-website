// src/firestore.js
// Talks to Firestore over its REST API using the service-account access
// token from google-auth.js. The Worker only ever writes; the browser
// reads a user's own purchases directly via the Firestore client SDK,
// gated by security rules (see firestore.rules).

import { getGoogleAccessToken } from "./google-auth.js";

function baseUrl(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

// Creates purchases/{orderId} right after a Razorpay order is created, so
// there's a record even if the user closes the tab before paying.
export async function createPurchaseDoc(env, orderId, data) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/purchases?documentId=${orderId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error("Firestore create failed: " + (await res.text()));
}

// Marks purchases/{orderId} as paid once the Razorpay signature is verified.
export async function markPurchasePaid(env, orderId, data) {
  const token = await getGoogleAccessToken(env);
  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/purchases/${orderId}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error("Firestore update failed: " + (await res.text()));
}

// Reads purchases/{orderId} back — used after payment verification to pull
// the trusted items/amount/email for the confirmation emails, rather than
// trusting anything the browser sends at this point.
export async function getPurchaseDoc(env, orderId) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/purchases/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Firestore read failed: ' + (await res.text()));
  const doc = await res.json();
  return fromFirestoreFields(doc.fields || {});
}

// Writes a document to the `mail` collection, which the Firebase
// "Trigger Email from Firestore" extension watches and turns into an
// actual sent email via whatever SMTP provider you configured when
// installing the extension. Letting Firebase send it means we don't need
// a separate email API/secret on the Worker side.
export async function queueMail(env, { to, subject, html }) {
  const token = await getGoogleAccessToken(env);
  const res = await fetch(`${baseUrl(env.FIREBASE_PROJECT_ID)}/mail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: toFirestoreFields({
        to: [to],
        message: { subject, html },
      }),
    }),
  });
  if (!res.ok) throw new Error("Failed to queue email: " + (await res.text()));
}

function fromFirestoreFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromFirestoreValue(v);
  return obj;
}

function fromFirestoreValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

function toFirestoreValue(v) {
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "number") return { integerValue: String(Math.trunc(v)) };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v && typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}
