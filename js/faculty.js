// ==========================================================================
// faculty.js — logic for faculty-dashboard.html
// Sir Vishveshwaraiah Conference Hall Booking System — MGM CEN
// ==========================================================================

import { requireRole } from "./auth.js";
import {
  db,
  collection, addDoc, onSnapshot, query, where, serverTimestamp
} from "./firebase-config.js";
import {
  showMessage, clearMessage, statusBadge, formatDate, formatTime,
  escapeHtml, bindLogoutButtons, initTabs, sanitizeErrorMessage
} from "./utils.js";
import { sendBookingToGoogleSheet, exportBookingsToCSV } from "./google-sheets.js";

let currentProfile = null;
let hallsCache = [];
let myBookingsCache = [];
let tabs = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentProfile = await requireRole("faculty");

  document.getElementById("sidebar-name").textContent = currentProfile.name || currentProfile.email;
  document.getElementById("sidebar-role").textContent = currentProfile.role;

  bindLogoutButtons();
  tabs = initTabs();

  // Restrict date picker to today or later
  const dateInput = document.getElementById("bk-date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
  }

  const exportBtn = document.getElementById("btn-export-my-bookings");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportBookingsToCSV(myBookingsCache);
    });
  }

  wireBookingForm();
  listenHalls();
  listenMyBookings();
});

/* ---------------------------------------------------------------------- */
/* HALLS                                                                    */
/* ---------------------------------------------------------------------- */

function listenHalls() {
  onSnapshot(collection(db, "halls"), (snap) => {
    hallsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHallsGrid();
    populateHallSelect();
    renderOverviewStats();
  }, () => {});
}

function renderHallsGrid() {
  const grid = document.getElementById("halls-grid");
  if (!grid) return;

  const activeHalls = hallsCache.filter((h) => h.isActive !== false);

  if (activeHalls.length === 0) {
    grid.innerHTML = `<div class="empty-state">No halls currently available.</div>`;
    return;
  }

  grid.innerHTML = activeHalls.map((h) => `
    <div class="hall-card">
      <h3>${escapeHtml(h.name)}</h3>
      <div class="hall-meta">Capacity ${escapeHtml(String(h.capacity ?? "—"))} · ${escapeHtml(h.location || "Main Block")}</div>
      <div class="hall-desc">${escapeHtml(h.description || "")}</div>
      <div class="hall-facilities">
        ${(h.facilities || []).map((f) => `<span class="facility-tag">${escapeHtml(f)}</span>`).join("")}
      </div>
      <div class="hall-actions">
        <button class="btn btn-sm btn-primary" data-book-hall="${h.id}">Book this hall</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-book-hall]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hallId = btn.getAttribute("data-book-hall");
      const select = document.getElementById("bk-hall");
      if (select) select.value = hallId;
      if (tabs) tabs.switchTab("view-book");
    });
  });
}

function populateHallSelect() {
  const select = document.getElementById("bk-hall");
  if (!select) return;

  const currentVal = select.value;
  const activeHalls = hallsCache.filter((h) => h.isActive !== false);

  select.innerHTML = `
    <option value="">Select a hall…</option>
    ${activeHalls.map((h) => `
      <option value="${h.id}">${escapeHtml(h.name)} (Capacity: ${escapeHtml(String(h.capacity ?? "—"))})</option>
    `).join("")}
  `;

  if (currentVal && activeHalls.some((h) => h.id === currentVal)) {
    select.value = currentVal;
  }
}

/* ---------------------------------------------------------------------- */
/* BOOK A HALL                                                            */
/* ---------------------------------------------------------------------- */

function wireBookingForm() {
  const form = document.getElementById("booking-form");
  const messageEl = document.getElementById("booking-message");
  if (!form) return;

  // Wire Quick Slot Presets
  document.querySelectorAll("[data-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parts = btn.getAttribute("data-slot").split("-");
      if (parts.length === 2) {
        const startEl = document.getElementById("bk-start");
        const endEl = document.getElementById("bk-end");
        if (startEl) startEl.value = parts[0];
        if (endEl) endEl.value = parts[1];
      }
    });
  });

  // Enable click to open date picker easily
  const dateInput = document.getElementById("bk-date");
  if (dateInput) {
    dateInput.addEventListener("click", () => {
      try { dateInput.showPicker(); } catch (e) {}
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const hallId = document.getElementById("bk-hall").value;
    const bookingDate = document.getElementById("bk-date").value;
    const startTime = document.getElementById("bk-start").value;
    const endTime = document.getElementById("bk-end").value;
    const eventName = document.getElementById("bk-event-name").value.trim();
    const purpose = document.getElementById("bk-purpose").value.trim();
    const attendees = Number(document.getElementById("bk-attendees").value);

    if (!hallId) {
      showMessage(messageEl, "Please select a conference hall.");
      return;
    }
    if (!bookingDate) {
      showMessage(messageEl, "Please select an event date.");
      return;
    }
    if (!startTime || !endTime) {
      showMessage(messageEl, "Please specify both start and end times.");
      return;
    }
    if (startTime >= endTime) {
      showMessage(messageEl, "End time must be later than start time.");
      return;
    }
    if (!eventName) {
      showMessage(messageEl, "Please enter an event name.");
      return;
    }
    if (!purpose) {
      showMessage(messageEl, "Please provide the purpose of the event.");
      return;
    }
    if (isNaN(attendees) || attendees < 1) {
      showMessage(messageEl, "Expected attendees must be at least 1.");
      return;
    }

    const selectedHall = hallsCache.find((h) => h.id === hallId);
    if (!selectedHall) {
      showMessage(messageEl, "Selected hall is invalid or unavailable.");
      return;
    }

    if (selectedHall.capacity && attendees > selectedHall.capacity) {
      showMessage(
        messageEl,
        `Expected attendees (${attendees}) exceeds this hall's maximum capacity (${selectedHall.capacity}).`
      );
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const bookingData = {
        userId: currentProfile.uid,
        userName: currentProfile.name || currentProfile.email,
        userEmail: currentProfile.email,
        department: currentProfile.department || "",
        hallId: selectedHall.id,
        hallName: selectedHall.name,
        bookingDate,
        startTime,
        endTime,
        eventName,
        purpose,
        expectedAttendees: attendees,
        status: "pending",
        rejectionReason: ""
      };

      const docRef = await addDoc(collection(db, "bookings"), {
        ...bookingData,
        createdAt: serverTimestamp()
      });

      // Asynchronously trigger Google Sheet sync
      sendBookingToGoogleSheet({
        id: docRef?.id || "",
        ...bookingData
      }).catch(() => {});

      showMessage(messageEl, `Booking request submitted for "${selectedHall.name}". Waiting for admin approval.`, "success");
      form.reset();
    } catch (err) {
      showMessage(messageEl, sanitizeErrorMessage(err, "submitting booking request"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit booking request";
    }
  });
}

/* ---------------------------------------------------------------------- */
/* MY BOOKINGS                                                            */
/* ---------------------------------------------------------------------- */

function listenMyBookings() {
  const q = query(
    collection(db, "bookings"),
    where("userId", "==", currentProfile.uid)
  );

  onSnapshot(q, (snap) => {
    myBookingsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sort descending by creation date or booking date in memory
    myBookingsCache.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    renderMyBookingsTable();
    renderOverviewStats();
  }, () => {});
}

function renderMyBookingsTable() {
  const tbody = document.getElementById("my-bookings-tbody");
  if (!tbody) return;

  if (myBookingsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">You have not submitted any booking requests yet.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = myBookingsCache.map((b) => `
    <tr>
      <td class="cell-strong">
        ${escapeHtml(b.eventName)}
        ${b.purpose ? `<div class="cell-muted">${escapeHtml(b.purpose)}</div>` : ""}
      </td>
      <td>${escapeHtml(b.hallName || "—")}</td>
      <td>
        ${formatDate(b.bookingDate)}<br>
        <span class="cell-muted">${formatTime(b.startTime)} – ${formatTime(b.endTime)}</span>
      </td>
      <td>${escapeHtml(String(b.expectedAttendees ?? "—"))}</td>
      <td>${statusBadge(b.status)}</td>
      <td>
        ${b.status === "rejected" && b.rejectionReason
          ? `<span class="cell-muted">${escapeHtml(b.rejectionReason)}</span>`
          : '<span class="cell-muted">—</span>'}
      </td>
    </tr>
  `).join("");
}

/* ---------------------------------------------------------------------- */
/* OVERVIEW STATS                                                         */
/* ---------------------------------------------------------------------- */

function renderOverviewStats() {
  const el = document.getElementById("overview-stats");
  if (!el) return;

  const activeHalls = hallsCache.filter((h) => h.isActive !== false).length;
  const pending = myBookingsCache.filter((b) => b.status === "pending").length;
  const approved = myBookingsCache.filter((b) => b.status === "approved").length;

  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${activeHalls}</div><div class="stat-label">Available halls</div></div>
    <div class="stat-card"><div class="stat-value">${pending}</div><div class="stat-label">Pending requests</div></div>
    <div class="stat-card"><div class="stat-value">${approved}</div><div class="stat-label">Approved bookings</div></div>
  `;
}
