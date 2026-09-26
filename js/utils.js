// ==========================================================================
// utils.js — Shared helper utilities
// Sir Vishveshwaraiah Conference Hall Booking System — MGM CEN
// ==========================================================================

import { auth, ALLOWED_EMAIL_DOMAINS, signOut } from "./firebase-config.js";

/**
 * Validates whether an email belongs to an allowed college domain.
 * @param {string} email
 * @returns {boolean}
 */
export function isAllowedCollegeEmail(email) {
  if (!email || typeof email !== "string") return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/**
 * Displays a styled message inside a target element.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {"error" | "success" | "warning"} [type="error"]
 */
export function showMessage(el, text, type = "error") {
  if (!el) return;
  el.textContent = text;
  el.className = `form-message ${type}`;
  el.hidden = false;
}

/**
 * Clears and hides a message element.
 * @param {HTMLElement} el
 */
export function clearMessage(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "form-message";
  el.hidden = true;
}

/**
 * Returns HTML markup for a booking status badge.
 * @param {string} status
 * @returns {string}
 */
export function statusBadge(status) {
  switch (status) {
    case "approved":
      return '<span class="badge badge-approved">Approved</span>';
    case "rejected":
      return '<span class="badge badge-rejected">Rejected</span>';
    case "pending":
    default:
      return '<span class="badge badge-pending">Pending</span>';
  }
}

/**
 * Formats a YYYY-MM-DD date string into a friendly localized format (e.g. 25 Sep 2026).
 * @param {string} isoDateStr
 * @returns {string}
 */
export function formatDate(isoDateStr) {
  if (!isoDateStr) return "—";
  const parts = String(isoDateStr).split("-");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }
  }
  return String(isoDateStr);
}

/**
 * Formats a 24-hour time string (HH:MM) to 12-hour AM/PM format (e.g. 2:30 PM).
 * @param {string} timeStr
 * @returns {string}
 */
export function formatTime(timeStr) {
  if (!timeStr) return "—";
  const parts = String(timeStr).split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    if (isNaN(hours)) return timeStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

/**
 * Safely escapes characters for HTML insertion.
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Checks whether two time intervals on the same day overlap.
 * Intervals are given as "HH:MM" 24h strings.
 * Overlap formula: startA < endB && endA > startB
 * @param {string} startA
 * @param {string} endA
 * @param {string} startB
 * @param {string} endB
 * @returns {boolean}
 */
export function timesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const sA = toMinutes(startA);
  const eA = toMinutes(endA);
  const sB = toMinutes(startB);
  const eB = toMinutes(endB);
  return sA < eB && eA > sB;
}

/**
 * Sets a session cookie (cleared when browser session ends).
 * @param {string} name
 * @param {string} value
 */
export function setSessionCookie(name, value) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  }
}

/**
 * Retrieves a cookie value by name.
 * @param {string} name
 * @returns {string|null}
 */
export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Deletes a cookie by name.
 * @param {string} name
 */
export function deleteCookie(name) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

/**
 * Binds click events to all elements with [data-logout] attribute
 * to sign out the user, clear session cookies, and redirect to login page.
 */
export function bindLogoutButtons() {
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        deleteCookie("mgm_session_uid");
        deleteCookie("mgm_session_role");
        deleteCookie("mgm_auth_session");
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.clear();
        }
        await signOut(auth);
      } catch (err) {
        // Silently handled
      } finally {
        window.location.href = "index.html";
      }
    });
  });
}

/**
 * Sets up tab switching logic for the dashboard views.
 * Looks for buttons with data-tab-target="view-id" and sections with id="view-id".
 * @param {string} [initialTarget]
 * @returns {{ switchTab: (targetId: string) => void }}
 */
export function initTabs(initialTarget) {
  const tabButtons = document.querySelectorAll("[data-tab-target]");
  const views = document.querySelectorAll(".view");

  function switchTab(targetId) {
    views.forEach((view) => {
      if (view.id === targetId) {
        view.classList.add("active");
      } else {
        view.classList.remove("active");
      }
    });

    tabButtons.forEach((btn) => {
      if (btn.getAttribute("data-tab-target") === targetId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab-target");
      if (target) switchTab(target);
    });
  });

  if (initialTarget) {
    switchTab(initialTarget);
  }

  return { switchTab };
}

/**
 * Transforms technical exceptions, database failures, and network errors into clean, 
 * user-friendly generic messages. Never exposes raw database names, internal traces,
 * or raw technical jargon to the end user.
 * 
 * @param {any} err - The error object or string
 * @param {string} [action="processing your request"] - Optional description of the action being attempted
 * @returns {string} Clean user-facing error message
 */
export function sanitizeErrorMessage(err, action = "processing your request") {
  if (!err) return `System issue: An unexpected error occurred while ${action}. Please try again later.`;

  const msg = typeof err === "string" ? err : (err.message || "");
  const code = (err.code || "").toLowerCase();
  const lowerMsg = (msg + " " + code).toLowerCase();

  // 1. Network / Connectivity Issues
  if (
    lowerMsg.includes("network") ||
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("connection") ||
    lowerMsg.includes("offline") ||
    lowerMsg.includes("timeout") ||
    code === "auth/network-request-failed" ||
    code === "unavailable"
  ) {
    return "Network issue: Unable to connect to server. Please check your internet connection and try again.";
  }

  // 2. Permission / Authorization Issues
  if (
    lowerMsg.includes("permission-denied") ||
    lowerMsg.includes("permission") ||
    lowerMsg.includes("unauthorized")
  ) {
    return "Access issue: You do not have permission to perform this action. Please contact the administrator.";
  }

  // 3. User Authentication & Input Issues
  if (
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential" ||
    lowerMsg.includes("wrong password") ||
    lowerMsg.includes("user not found")
  ) {
    return "Invalid credentials: Incorrect email address or password. Please try again.";
  }

  if (code === "auth/email-already-in-use" || lowerMsg.includes("already in use")) {
    return "Account exists: An account with this college email already exists. Please log in.";
  }

  if (code === "auth/too-many-requests" || lowerMsg.includes("too many attempts")) {
    return "Security notice: Too many attempts. Please wait a moment before trying again.";
  }

  if (code === "auth/invalid-email") {
    return "Email format issue: Please provide a valid @mgmcen.ac.in college email address.";
  }

  if (code === "auth/weak-password") {
    return "Password requirement: Password must be at least 6 characters long.";
  }

  // 4. College Hall Conflict or Explicit Business Logic
  if (lowerMsg.includes("already has this hall booked")) {
    return msg;
  }
  if (lowerMsg.includes("pending admin approval") || lowerMsg.includes("deactivated")) {
    return msg;
  }
  if (lowerMsg.includes("can't deactivate your own account") || lowerMsg.includes("can't delete your own account")) {
    return msg;
  }

  // 5. Default Generic System Issue (masks MongoDB, Firestore, SQL, fetch errors)
  return `System issue: Unable to complete ${action}. Please try again in a few moments.`;
}
