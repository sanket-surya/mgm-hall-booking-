// ==========================================================================
// auth.js — login form logic + the requireRole() guard used by every
// dashboard page.
// ==========================================================================

import {
  auth, db,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  doc, getDoc
} from "./firebase-config.js";
import { isAllowedCollegeEmail, showMessage, clearMessage } from "./utils.js";

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

/** Wires up the login form on index.html. */
export function initLoginForm() {
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

    // NOTE: this is a client-side convenience check only. A determined user
    // could call the Firebase Auth REST API directly and skip this form
    // entirely — see "Known limitations" in README.md.
    if (!isAllowedCollegeEmail(email)) {
      showMessage(
        messageEl,
        "Please sign in with your college email address (@mgmce.ac.in or @mgmnanded.ac.in)."
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
