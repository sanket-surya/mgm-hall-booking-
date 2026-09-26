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
import {
  isAllowedCollegeEmail,
  showMessage,
  clearMessage,
  setSessionCookie,
  getCookie,
  deleteCookie,
  sanitizeErrorMessage
} from "./utils.js";
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
  const activeUid = getCookie("mgm_session_uid") || getCookie("mgm_current_user_id");
  const activeRole = getCookie("mgm_session_role");
  const messageEl = document.getElementById("login-message");

  if (activeUid && activeRole && ROLE_DASHBOARDS[activeRole] && messageEl) {
    messageEl.className = "form-message info";
    messageEl.hidden = false;
    messageEl.innerHTML = `You are currently signed in as <strong>${escapeHtml(activeRole.toUpperCase())}</strong>. <a href="${ROLE_DASHBOARDS[activeRole]}" style="font-weight:600; text-decoration:underline; margin-left:6px;">Go to Dashboard →</a>`;
  }

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
        deleteCookie("mgm_session_uid");
        deleteCookie("mgm_session_role");
        if (profile.isApproved === false) {
          showMessage(
            messageEl,
            "⏳ Your account is pending Admin approval. Please contact the Admin to approve your account.",
            "warning"
          );
        } else {
          showMessage(
            messageEl,
            "🚫 This account has been deactivated. Please contact the Admin.",
            "error"
          );
        }
        return;
      }
      const destination = ROLE_DASHBOARDS[profile.role];
      if (!destination) {
        await signOut(auth);
        showMessage(messageEl, "This account has no valid role assigned. Contact an admin.");
        return;
      }

      setSessionCookie("mgm_session_uid", credential.user.uid);
      setSessionCookie("mgm_session_role", profile.role);
      window.location.replace(destination);
    } catch (err) {
      showMessage(messageEl, sanitizeErrorMessage(err, "signing in"));
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
    const empId = (document.getElementById("reg-emp-id")?.value || "").trim();

    if (!name) {
      showMessage(messageEl, "Please enter your full name.");
      return;
    }
    if (!isAllowedCollegeEmail(email)) {
      showMessage(messageEl, "Please register with your college email address (@mgmcen.ac.in).");
      return;
    }
    if (!department) {
      showMessage(messageEl, "Please select your branch / department.");
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
        employeeId: empId,
        isActive: false, // Requires Admin Approval before login
        isApproved: false,
        createdAt: serverTimestamp()
      });

      // Instantly sync newly registered user into Google Sheet "Users" tab as PENDING_APPROVAL
      syncUserToGoogleSheet({
        uid,
        email,
        name,
        role,
        department,
        isActive: false,
        isApproved: false
      }).catch(() => {});

      // Sign out from immediate auth state so unapproved user cannot access dashboards
      await signOut(auth);
      deleteCookie("mgm_session_uid");
      deleteCookie("mgm_session_role");

      // Reset form and switch to login tab
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = "Register & Access Dashboard";

      const tabLogin = document.getElementById("tab-login");
      const tabRegister = document.getElementById("tab-register");
      const loginForm = document.getElementById("login-form");
      if (tabLogin && tabRegister && loginForm) {
        tabLogin.className = "btn btn-sm btn-primary";
        tabRegister.className = "btn btn-sm btn-secondary";
        loginForm.hidden = false;
        form.hidden = true;
      }

      showMessage(
        messageEl,
        "✅ Registration submitted! Your account is pending Admin approval. You can log in once the College Admin approves your account.",
        "success"
      );

    } catch (err) {
      showMessage(messageEl, sanitizeErrorMessage(err, "registration"));
      submitBtn.disabled = false;
      submitBtn.textContent = "Register Account";
    }
  });
}

function mapRegisterError(code, fallback) {
  return sanitizeErrorMessage({ code, message: fallback }, "registration");
}

function mapAuthError(code) {
  return sanitizeErrorMessage({ code }, "signing in");
}

/**
 * Guards a dashboard page. Call at the top of admin.js / faculty.js /
 * organizer.js with the role that page is meant for. Resolves with the
 * caller's profile once confirmed; otherwise redirects away and never
 * resolves.
 */
export function requireRole(expectedRole) {
  return new Promise((resolve) => {
    // Fast path: if session cookie role mismatches expected dashboard, redirect (unless admin)
    const cookieRole = getCookie("mgm_session_role");
    if (cookieRole && cookieRole !== expectedRole && cookieRole !== "admin" && ROLE_DASHBOARDS[cookieRole]) {
      window.location.replace(ROLE_DASHBOARDS[cookieRole]);
      return;
    }

    // Trap browser back button so back navigation doesn't fall back to login screen
    try {
      history.pushState(null, document.title, window.location.href);
      window.addEventListener("popstate", () => {
        history.pushState(null, document.title, window.location.href);
      });
    } catch (e) {
      // Ignore if history API restricted
    }

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        deleteCookie("mgm_session_uid");
        deleteCookie("mgm_session_role");
        window.location.replace("index.html");
        return;
      }

      const profile = await getUserProfile(user.uid);

      if (!profile || profile.isActive === false) {
        deleteCookie("mgm_session_uid");
        deleteCookie("mgm_session_role");
        await signOut(auth);
        window.location.replace("index.html");
        return;
      }

      if (profile.role !== expectedRole && profile.role !== "admin") {
        setSessionCookie("mgm_session_role", profile.role);
        window.location.replace(ROLE_DASHBOARDS[profile.role] || "index.html");
        return;
      }

      // Sync active session cookies
      setSessionCookie("mgm_session_uid", user.uid);
      setSessionCookie("mgm_session_role", profile.role);

      // --- Session timeout: auto-logout after 30 min inactivity ---
      let inactivityTimer;
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(async () => {
          deleteCookie("mgm_session_uid");
          deleteCookie("mgm_session_role");
          await signOut(auth);
          window.location.replace("index.html?timeout=true");
        }, SESSION_TIMEOUT);
      }
      ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evt => {
        document.addEventListener(evt, resetTimer, { passive: true });
      });
      resetTimer();

      resolve(profile);
    });
  });
}
