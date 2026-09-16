/* =========================================
   METASTABLE DESIGN — Purchase history page
   Reads Firestore directly from the browser (no Worker endpoint needed for
   this part) — Firestore security rules ensure a user can only ever read
   documents where doc.uid matches their own signed-in uid.
   ========================================= */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// auth.js (loaded first) already calls initializeApp — reuse that instance
// rather than initializing Firebase twice.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const content = document.getElementById("purchases-content");

async function render() {
  const user = await window.waitForAuthReady();

  if (!user) {
    content.innerHTML = `
      <div class="purchases-signedout">
        <p>Sign in to see your purchase history.</p>
        <button onclick="openAuthModal('signin')">Sign In</button>
      </div>
    `;
    return;
  }

  try {
    const q = query(
      collection(db, "purchases"),
      where("uid", "==", user.uid),
      where("status", "==", "paid"),
      orderBy("paidAt", "desc")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      content.innerHTML = `<div class="purchases-empty">No purchases yet — check out the <a href="webinars.html">webinars</a>.</div>`;
      return;
    }

    content.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      content.appendChild(renderRow(data));
    });
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="purchases-empty">Couldn't load your purchases right now. Please refresh, or email metastable01@gmail.com if this keeps happening.</div>`;
  }
}

function renderRow(data) {
  const row = document.createElement("div");
  row.className = "purchase-row";

  const itemNames = (data.items || []).map(slugToName).join(", ");
  const date = data.paidAt?.toDate ? data.paidAt.toDate() : null;
  const dateStr = date
    ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "";
  const amountStr = formatAmount(data.amount, data.currency);

  row.innerHTML = `
    <div>
      <div class="purchase-items">${escapeHtml(itemNames)}</div>
      <div class="purchase-meta">${escapeHtml(dateStr)}${data.paymentId ? " · " + escapeHtml(data.paymentId) : ""}</div>
    </div>
    <div class="purchase-amount">${amountStr}</div>
  `;
  return row;
}

function slugToName(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAmount(amount, currency) {
  if (typeof amount !== "number") return "";
  const value = amount / 100; // stored in paise/cents
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${value.toLocaleString()}`;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

render();
