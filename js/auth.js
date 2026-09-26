// ==========================================================================
// auth.js — login form logic + the requireRole() guard used by every
// dashboard page.
// ==========================================================================

import {
  auth, db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  doc, getDoc, setDoc, serverTimestamp
} from "./firebase-config.js";
import { isAllowedCollegeEmail, showMessage, clearMessage } from "./utils.js";
import { syncUserToGoogleSheet } from "./google-sheets.js";

const ROLE_DASHBOARDS = {
  admin: "admin-dashboard.html",
  faculty: "faculty-dashboard.html",
  organizer: "organizer-dashboard.html"
};

/**
 * Reads the Firestore profile doc (users/{uid}) for a signed-in Auth user.
 * Returns null if no matching profile exists yet — e.g. an Auth account
 * was created straight from the Firebase console without also creating a
 * Firestore users/ doc for it.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** Wires up both login and registration forms on index.html. */
export function initLoginForm() {
  initLoginHandler();
  initRegisterTabs();
  initRegisterHandler();
}

export const initAuthForms = initLoginForm;

function initLoginHandler() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const messageEl = document.getElementById("login-message");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitBtn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(messageEl);

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!isAllowedCollegeEmail(email)) {
      showMessage(
        messageEl,
        "Please sign in with your college email address (@mgmcen.ac.in)."
      );
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(credential.user.uid);

      if (!profile) {
        await signOut(auth);
        showMessage(messageEl, "No profile found for this account. Ask an admin to set up your access.");
        return;
      }
      if (profile.isActive === false) {
        await signOut(auth);
        showMessage(messageEl, "This account has been deactivated. Contact an admin.");
        return;
      }
      const destination = ROLE_DASHBOARDS[profile.role];
      if (!destination) {
        await signOut(auth);
        showMessage(messageEl, "This account has no valid role assigned. Contact an admin.");
        return;
      }

      window.location.href = destination;
    } catch (err) {
      showMessage(messageEl, mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? "Signing in…" : "Log in";
  }
}

function initRegisterTabs() {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const demoBox = document.getElementById("demo-box");
  const footnote = document.getElementById("login-footnote");
  const messageEl = document.getElementById("login-message");

  if (!tabLogin || !tabRegister || !registerForm) return;

  tabLogin.addEventListener("click", () => {
    tabLogin.className = "btn btn-sm btn-primary";
    tabRegister.className = "btn btn-sm btn-secondary";
    loginForm.hidden = false;
    registerForm.hidden = true;
    if (demoBox) demoBox.hidden = false;
    if (footnote) footnote.hidden = false;
    clearMessage(messageEl);
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.className = "btn btn-sm btn-primary";
    tabLogin.className = "btn btn-sm btn-secondary";
    loginForm.hidden = true;
    registerForm.hidden = false;
    if (demoBox) demoBox.hidden = true;
    if (footnote) footnote.hidden = true;
    clearMessage(messageEl);
  });
}

function initRegisterHandler() {
  const form = document.getElementById("register-form");
  if (!form) return;

  const messageEl = document.getElementById("login-message");
  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const roleInput = document.getElementById("reg-role");
  const deptInput = document.getElementById("reg-department");
  const passwordInput = document.getElementById("reg-password");
  const submitBtn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const role = roleInput.value;
    const department = deptInput.value.trim();
    const password = passwordInput.value;

    if (!name) {
      showMessage(messageEl, "Please enter your full name.");
      return;
    }
    if (!isAllowedCollegeEmail(email)) {
      showMessage(messageEl, "Please register with your college email address (@mgmcen.ac.in).");
      return;
    }
    if (password.length < 6) {
      showMessage(messageEl, "Password must be at least 6 characters.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Registering…";

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      await setDoc(doc(db, "users", uid), {
        uid,
        email,
        name,
        role,
        department,
        isActive: true,
        createdAt: serverTimestamp()
      });

      // Instantly sync newly registered user into Google Sheet "Users" tab
      syncUserToGoogleSheet({
        uid,
        email,
        name,
        role,
        department,
        isActive: true
      }).catch(console.warn);

      // Sign-in successful — navigate to dashboard
      const dest = ROLE_DASHBOARDS[role] || "faculty-dashboard.html";
      window.location.href = dest;

    } catch (err) {
      showMessage(messageEl, mapRegisterError(err.code, err.message));
      submitBtn.disabled = false;
      submitBtn.textContent = "Register & Access Dashboard";
    }
  });
}

function mapRegisterError(code, fallback) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please log in.";
    case "auth/invalid-email":
      return "That email address format is not valid.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    default:
      return fallback || "Couldn't complete registration. Please try again.";
  }
}

function mapAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Couldn't sign in. Please try again.";
  }
}

/**
 * Guards a dashboard page. Call at the top of admin.js / faculty.js /
 * organizer.js with the role that page is meant for. Resolves with the
 * caller's profile once confirmed; otherwise redirects away and never
 * resolves.
 */
export function requireRole(expectedRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const profile = await getUserProfile(user.uid);

      if (!profile || profile.isActive === false) {
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }

      if (profile.role !== expectedRole) {
        window.location.href = ROLE_DASHBOARDS[profile.role] || "index.html";
        return;
      }

      resolve(profile);
    });
  });
}
