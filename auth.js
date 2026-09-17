/* =========================================
   METASTABLE DESIGN — Firebase Authentication
   Loaded as a module on every page. Injects the sign-in modal and the
   header account button, and exposes window.getIdToken() for checkout.js
   to attach to /api/create-order and /api/verify-payment calls.
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

window._firebaseAuth = auth;

/* ── Modal markup ── */
function injectModal() {
  if (document.getElementById("auth-modal")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="auth-modal">
      <div class="auth-card">
        <button class="auth-close" onclick="closeAuthModal()" aria-label="Close">&times;</button>

        <div class="auth-tabs">
          <button id="tab-signin" class="auth-tab active" onclick="switchAuthTab('signin')">Sign In</button>
          <button id="tab-signup" class="auth-tab" onclick="switchAuthTab('signup')">Create Account</button>
        </div>

        <div id="auth-error" class="auth-error"></div>

        <div id="form-signin">
          <label>Email</label>
          <input id="signin-email" type="email" placeholder="you@example.com" autocomplete="email">
          <label>Password</label>
          <input id="signin-password" type="password" placeholder="Your password" autocomplete="current-password"
                 onkeydown="if(event.key==='Enter') handleSignIn()">
          <div class="auth-forgot">
            <button onclick="handleForgotPassword()">Forgot password?</button>
          </div>
          <button class="auth-submit" id="signin-btn" onclick="handleSignIn()">Sign In</button>
          <p class="auth-switch">Don't have an account? <button onclick="switchAuthTab('signup')">Create one</button></p>
        </div>

        <div id="form-signup" style="display:none;">
          <label>Full Name</label>
          <input id="signup-name" type="text" placeholder="Your full name" autocomplete="name">
          <label>Email</label>
          <input id="signup-email" type="email" placeholder="you@example.com" autocomplete="email">
          <label>Password</label>
          <input id="signup-password" type="password" placeholder="Min. 6 characters" autocomplete="new-password"
                 onkeydown="if(event.key==='Enter') handleSignUp()">
          <button class="auth-submit" id="signup-btn" onclick="handleSignUp()">Create Account</button>
          <p class="auth-switch">Already have an account? <button onclick="switchAuthTab('signin')">Sign in</button></p>
        </div>
      </div>
    </div>
    `
  );

  document.getElementById("auth-modal").addEventListener("click", function (e) {
    if (e.target === this) closeAuthModal();
  });
}

window.openAuthModal = function (tab = "signin") {
  injectModal();
  switchAuthTab(tab);
  document.getElementById("auth-modal").style.display = "flex";
  clearAuthError();
};

window.closeAuthModal = function () {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.style.display = "none";
  clearAuthError();
};

window.switchAuthTab = function (tab) {
  document.getElementById("form-signin").style.display = tab === "signin" ? "block" : "none";
  document.getElementById("form-signup").style.display = tab === "signup" ? "block" : "none";
  document.getElementById("tab-signin").classList.toggle("active", tab === "signin");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  clearAuthError();
};

function showAuthError(msg, success = false) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.classList.toggle("success", success);
  el.style.display = "block";
}

function clearAuthError() {
  const el = document.getElementById("auth-error");
  if (el) el.style.display = "none";
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : label;
}

/* ── Auth actions ── */
window.handleSignIn = async function () {
  const email = document.getElementById("signin-email").value.trim();
  const password = document.getElementById("signin-password").value;
  if (!email || !password) return showAuthError("Please enter your email and password.");

  setLoading("signin-btn", true);
  clearAuthError();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
  } catch (e) {
    console.error("Firebase sign-in error code:", e.code, e.message);
    showAuthError(friendlyError(e.code));
  } finally {
    setLoading("signin-btn", false, "Sign In");
  }
};

window.handleSignUp = async function () {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name) return showAuthError("Please enter your full name.");
  if (!email) return showAuthError("Please enter your email.");
  if (password.length < 6) return showAuthError("Password must be at least 6 characters.");

  setLoading("signup-btn", true);
  clearAuthError();
  try {
    await createUserWithEmailAndPassword(auth, email, password).then(async (cred) => {
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
    });
    closeAuthModal();
    showVerificationBanner();
  } catch (e) {
    console.error("Firebase sign-up error code:", e.code, e.message);
    showAuthError(friendlyError(e.code));
  } finally {
    setLoading("signup-btn", false, "Create Account");
  }
};

window.handleSignOut = async function () {
  await signOut(auth);
};

window.handleForgotPassword = async function () {
  const email = document.getElementById("signin-email").value.trim();
  if (!email) return showAuthError("Enter your email above first, then click Forgot password.");
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError("Reset email sent — check your inbox.", true);
  } catch (e) {
    showAuthError(friendlyError(e.code));
  }
};

function friendlyError(code) {
  switch (code) {
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password": return "Incorrect password. Try again.";
    case "auth/email-already-in-use": return "An account with this email already exists.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/too-many-requests": return "Too many attempts. Please try again later.";
    case "auth/invalid-credential": return "Incorrect email or password.";
    default: return "Something went wrong. Please try again.";
  }
}

function showVerificationBanner() {
  const banner = document.createElement("div");
  banner.className = "auth-verify-banner";
  banner.innerHTML = `
    A verification email has been sent to your inbox.
    <button onclick="this.parentElement.remove()">Dismiss</button>
  `;
  document.body.prepend(banner);
}

/* ── Header account UI ── */
onAuthStateChanged(auth, (user) => {
  window._currentUser = user;
  renderHeaderAuth(user);
  prefillCheckoutFields(user);
});

function renderHeaderAuth(user) {
  const el = document.getElementById("auth-header-btn");
  if (!el) return;

  if (user) {
    const name = user.displayName ? user.displayName.split(" ")[0] : user.email;
    el.innerHTML = `
      <div class="auth-user-menu">
        <button class="auth-user-btn" onclick="toggleAuthMenu()">Hi, ${escapeHtml(name)} ▾</button>
        <div class="auth-dropdown" id="auth-dropdown">
          <a href="purchases.html">My Purchases</a>
          <button onclick="handleSignOut()">Sign Out</button>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `<button class="auth-signin-btn" onclick="openAuthModal('signin')">Sign In</button>`;
  }
}

window.toggleAuthMenu = function () {
  document.getElementById("auth-dropdown")?.classList.toggle("open");
};

document.addEventListener("click", (e) => {
  const menu = document.querySelector(".auth-user-menu");
  const dropdown = document.getElementById("auth-dropdown");
  if (menu && dropdown && !menu.contains(e.target)) dropdown.classList.remove("open");
});

function prefillCheckoutFields(user) {
  if (!user) return;
  const nameEl = document.getElementById("custName");
  const emailEl = document.getElementById("custEmail");
  if (nameEl && !nameEl.value && user.displayName) nameEl.value = user.displayName;
  if (emailEl && !emailEl.value && user.email) emailEl.value = user.email;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/* ── Public helpers for other scripts (checkout.js / purchases.js) ── */
window.getCurrentUser = function () {
  return auth.currentUser;
};

// Returns a fresh Firebase ID token for the logged-in user, or null.
// checkout.js sends this as "Authorization: Bearer <token>" so the Worker
// can verify who's paying and attach the purchase to the right account.
window.getIdToken = async function () {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};

// Resolves once Firebase has checked localStorage/session for an existing
// login, so callers don't race the initial null state. Used by purchases.js.
window.waitForAuthReady = function () {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
};
