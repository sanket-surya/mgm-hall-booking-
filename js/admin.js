// ==========================================================================
// admin.js — logic for admin-dashboard.html
// ==========================================================================

import { requireRole } from "./auth.js";
import {
  db, withSecondaryAuth, resetMockStore,
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  createUserWithEmailAndPassword
} from "./firebase-config.js";
import {
  isAllowedCollegeEmail, showMessage, clearMessage, statusBadge,
  formatDate, formatTime, calcDuration, escapeHtml, timesOverlap,
  bindLogoutButtons, initTabs, sanitizeErrorMessage
} from "./utils.js";
import {
  exportBookingsToCSV,
  updateGoogleSheetBookingStatus,
  syncUserToGoogleSheet,
  updateUserStatusInGoogleSheet,
  removeUserFromGoogleSheet,
  exportUsersToCSV,
  sendBookingToGoogleSheet,
  GOOGLE_SHEETS_CONFIG
} from "./google-sheets.js";

let currentProfile = null;
let hallsCache = [];
let usersCache = [];
let bookingsCache = [];
let editingHallId = null; // null = "add hall" mode, otherwise the hall being edited

document.addEventListener("DOMContentLoaded", async () => {
  currentProfile = await requireRole("admin");

  document.getElementById("sidebar-name").textContent = currentProfile.name || currentProfile.email;
  document.getElementById("sidebar-role").textContent = currentProfile.role;

  bindLogoutButtons();
  initTabs();
  wireCreateUserForm();
  wireHallForm();
  wireAdminBookingForm();
  document.getElementById("user-role-filter").addEventListener("change", renderUsersTable);
  document.getElementById("booking-status-filter").addEventListener("change", renderBookingsTable);

  const exportBtn = document.getElementById("btn-export-excel");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const filter = document.getElementById("booking-status-filter").value;
      const rows = bookingsCache.filter((b) => filter === "all" || b.status === filter);
      exportBookingsToCSV(rows.length ? rows : bookingsCache);
    });
  }

  const exportUsersBtn = document.getElementById("btn-export-users-excel");
  if (exportUsersBtn) {
    exportUsersBtn.addEventListener("click", () => {
      const filter = document.getElementById("user-role-filter").value;
      const rows = usersCache.filter((u) => filter === "all" || u.role === filter);
      exportUsersToCSV(rows.length ? rows : usersCache);
    });
  }

  const sheetBtn = document.getElementById("btn-open-google-sheet");
  if (sheetBtn && GOOGLE_SHEETS_CONFIG.sheetViewUrl) {
    sheetBtn.href = GOOGLE_SHEETS_CONFIG.sheetViewUrl;
    sheetBtn.style.display = "inline-flex";
  }

  const resetBtn = document.getElementById("btn-reset-test-data");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all test bookings and test users? The official admin account and conference halls will be preserved.")) {
        resetMockStore();
        window.location.reload();
      }
    });
  }

  listenUsers();
  listenHalls();
  listenBookings();
});

/* ---------------------------------------------------------------------- */
/* USERS                                                                   */
/* ---------------------------------------------------------------------- */

function listenUsers() {
  onSnapshot(collection(db, "users"), (snap) => {
    usersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderUsersTable();
    renderOverviewStats();
  }, () => {});
}

function renderUsersTable() {
  const filter = document.getElementById("user-role-filter").value;
  const tbody = document.getElementById("users-tbody");
  const rows = usersCache
    .filter((u) => filter === "all" || u.role === filter)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No users found.</div></td></tr>`;
    return;
  }

  // Sort pending approval requests to the very top
  const sortedRows = [...rows].sort((a, b) => {
    const aPending = a.isActive === false && a.isApproved === false;
    const bPending = b.isActive === false && b.isApproved === false;
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  tbody.innerHTML = sortedRows.map((u) => {
    let statusBadgeHtml = '';
    let actionBtnHtml = '';

    if (u.isActive === false && u.isApproved === false) {
      statusBadgeHtml = '<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:600;">⏳ Pending Approval</span>';
      actionBtnHtml = `
        <button class="btn btn-sm btn-success" data-approve-user="${u.id}" data-email="${escapeHtml(u.email || "")}" title="Approve account access">
          ✅ Approve
        </button>
      `;
    } else if (u.isActive === false) {
      statusBadgeHtml = '<span class="badge badge-inactive">Deactivated</span>';
      actionBtnHtml = `
        <button class="btn btn-sm btn-success" data-toggle-user="${u.id}" data-email="${escapeHtml(u.email || "")}" data-next="true">
          Reactivate
        </button>
      `;
    } else {
      statusBadgeHtml = '<span class="badge badge-approved">Active</span>';
      actionBtnHtml = `
        <button class="btn btn-sm btn-secondary" data-toggle-user="${u.id}" data-email="${escapeHtml(u.email || "")}" data-next="false">
          Deactivate
        </button>
      `;
    }

    return `
      <tr style="${u.isActive === false && u.isApproved === false ? 'background:#fffdf5;' : ''}">
        <td class="cell-strong">
          ${escapeHtml(u.name || "—")}
          ${u.employeeId ? `<br><span class="badge badge-info" style="font-size:11px; padding:2px 6px; font-weight:600;">ID: ${escapeHtml(u.employeeId)}</span>` : '<br><span style="font-size:11px; color:#9ca3af;">(No Staff ID)</span>'}
        </td>
        <td>${escapeHtml(u.email || "—")}</td>
        <td style="text-transform:capitalize">${escapeHtml(u.role || "—")}</td>
        <td>${escapeHtml(u.department || "—")}</td>
        <td>${statusBadgeHtml}</td>
        <td>
          <div class="inline-actions">
            ${actionBtnHtml}
            ${u.id !== currentProfile.uid ? `
              <button class="btn btn-sm btn-danger" data-delete-user="${u.id}" data-name="${escapeHtml(u.name || "")}" data-email="${escapeHtml(u.email || "")}">
                Remove
              </button>
            ` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-approve-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-approve-user");
      const email = btn.getAttribute("data-email");
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "users", uid), { isActive: true, isApproved: true });
        updateUserStatusInGoogleSheet(uid, email, "ACTIVE").catch(() => {});
      } catch (err) {
        alert(sanitizeErrorMessage(err, "approving this user"));
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll("[data-toggle-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-toggle-user");
      const email = btn.getAttribute("data-email");
      const makeActive = btn.getAttribute("data-next") === "true";
      if (uid === currentProfile.uid && !makeActive) {
        alert("You can't deactivate your own account while signed in.");
        return;
      }
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "users", uid), { isActive: makeActive, isApproved: true });
        // Sync status to Google Sheet
        updateUserStatusInGoogleSheet(uid, email, makeActive ? "ACTIVE" : "DEACTIVATED").catch(() => {});
      } catch (err) {
        alert(sanitizeErrorMessage(err, "updating user status"));
      } finally {
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll("[data-delete-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-delete-user");
      const name = btn.getAttribute("data-name");
      const email = btn.getAttribute("data-email");

      if (uid === currentProfile.uid) {
        alert("You can't delete your own account.");
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to permanently remove "${name}" (${email})?\n\nThis will remove them from the system and delete their row from the Google Sheet.`
      );
      if (!confirmed) return;

      btn.disabled = true;
      try {
        await deleteDoc(doc(db, "users", uid));
        // Remove row directly from Google Sheet
        removeUserFromGoogleSheet(uid, email).catch(() => {});
      } catch (err) {
        alert(sanitizeErrorMessage(err, "removing this user"));
        btn.disabled = false;
      }
    });
  });
}

function wireCreateUserForm() {
  const form = document.getElementById("create-user-form");
  const messageEl = document.getElementById("create-user-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const name = document.getElementById("nu-name").value.trim();
    const email = document.getElementById("nu-email").value.trim();
    const password = document.getElementById("nu-password").value;
    const role = document.getElementById("nu-role").value;
    const department = document.getElementById("nu-department").value.trim();
    const employeeId = (document.getElementById("nu-emp-id")?.value || "").trim();

    if (!name) {
      showMessage(messageEl, "Name is required.");
      return;
    }
    if (!isAllowedCollegeEmail(email)) {
      showMessage(messageEl, "Use a college email address (@mgmcen.ac.in).");
      return;
    }
    if (!department) {
      showMessage(messageEl, "Please select a branch / department.");
      return;
    }
    if (password.length < 6) {
      showMessage(messageEl, "Password must be at least 6 characters (Firebase Auth minimum).");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating…";

    try {
      let createdUid = "";
      // Runs on a temporary secondary Auth session so the admin's own
      // session isn't disturbed — see firebase-config.js for why.
      await withSecondaryAuth(async (secondaryAuth) => {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        createdUid = cred.user.uid;
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          email,
          name,
          role,
          department,
          employeeId,
          isActive: true,
          isApproved: true,
          createdAt: serverTimestamp()
        });
      });

      // Sync new user to Google Sheet
      syncUserToGoogleSheet({
        uid: createdUid,
        email,
        name,
        role,
        department,
        employeeId,
        isActive: true,
        isApproved: true
      }).catch(() => {});

      showMessage(messageEl, `Account created for ${name}. Synced to Google Sheet.`, "success");
      form.reset();
    } catch (err) {
      showMessage(messageEl, mapCreateUserError(err.code, err.message));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
}

function mapCreateUserError(code, fallback) {
  return sanitizeErrorMessage({ code, message: fallback }, "creating account");
}

/* ---------------------------------------------------------------------- */
/* HALLS                                                                    */
/* ---------------------------------------------------------------------- */

function listenHalls() {
  onSnapshot(collection(db, "halls"), (snap) => {
    hallsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderHallsGrid();
    renderOverviewStats();
  }, () => {});
}

function renderHallsGrid() {
  const grid = document.getElementById("halls-grid");
  if (hallsCache.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="padding: 24px; text-align: center;">
        <p style="margin-bottom: 12px; font-size: 15px;">No halls yet in your live database.</p>
        <button type="button" id="btn-seed-halls" class="btn btn-primary">
          🏢 Add Default MGM Conference Halls
        </button>
      </div>`;
    const seedBtn = document.getElementById("btn-seed-halls");
    if (seedBtn) {
      seedBtn.addEventListener("click", async () => {
        seedBtn.disabled = true;
        seedBtn.textContent = "Adding default halls…";
        try {
          const defaultHalls = [
            {
              name: "Sir Vishveshwaraiah Conference Hall",
              description: "Main conference hall for large college events, seminars, and annual functions.",
              capacity: 200,
              location: "Main Block",
              facilities: ["Projector", "Podium", "Sound system", "Air conditioning"],
              isActive: true
            },
            {
              name: "Conference Room A",
              description: "Mid-sized room suited to departmental meetings and technical workshops.",
              capacity: 40,
              location: "Main Block",
              facilities: ["Projector", "Whiteboard"],
              isActive: true
            },
            {
              name: "Conference Room B",
              description: "Larger meeting room for seminars and guest lectures.",
              capacity: 80,
              location: "Main Block",
              facilities: ["Projector", "Sound system"],
              isActive: true
            }
          ];
          for (const hall of defaultHalls) {
            await addDoc(collection(db, "halls"), hall);
          }
        } catch (err) {
          alert("Error adding halls: " + (err.message || err));
          seedBtn.disabled = false;
          seedBtn.textContent = "🏢 Add Default MGM Conference Halls";
        }
      });
    }
    return;
  }
  grid.innerHTML = hallsCache.map((h) => `
    <div class="hall-card">
      <h3>${escapeHtml(h.name)}</h3>
      <div class="hall-meta">Capacity ${escapeHtml(String(h.capacity ?? "—"))} · ${escapeHtml(h.location || "—")}${h.isActive === false ? " · <strong>Inactive</strong>" : ""}</div>
      <div class="hall-desc">${escapeHtml(h.description || "")}</div>
      <div class="hall-facilities">
        ${(h.facilities || []).map((f) => `<span class="facility-tag">${escapeHtml(f)}</span>`).join("")}
      </div>
      <div class="hall-actions">
        <button class="btn btn-sm btn-secondary" data-edit-hall="${h.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-delete-hall="${h.id}">Delete</button>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-edit-hall]").forEach((btn) => {
    btn.addEventListener("click", () => startEditHall(btn.getAttribute("data-edit-hall")));
  });
  grid.querySelectorAll("[data-delete-hall]").forEach((btn) => {
    btn.addEventListener("click", () => deleteHall(btn.getAttribute("data-delete-hall")));
  });

  const adminHallSelect = document.getElementById("admin-bk-hall");
  if (adminHallSelect) {
    const activeHalls = hallsCache.filter((h) => h.isActive !== false);
    adminHallSelect.innerHTML = activeHalls.length
      ? activeHalls.map((h) => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.name)} (Capacity: ${h.capacity})</option>`).join("")
      : '<option value="">No active halls available</option>';
  }
}

function startEditHall(hallId) {
  const hall = hallsCache.find((h) => h.id === hallId);
  if (!hall) return;
  editingHallId = hallId;

  document.getElementById("hall-form-title").textContent = `Edit hall — ${hall.name}`;
  document.getElementById("h-name").value = hall.name || "";
  document.getElementById("h-description").value = hall.description || "";
  document.getElementById("h-capacity").value = hall.capacity ?? "";
  document.getElementById("h-location").value = hall.location || "";
  document.getElementById("h-facilities").value = (hall.facilities || []).join(", ");
  document.getElementById("h-active").checked = hall.isActive !== false;
  document.getElementById("hall-cancel-edit").classList.remove("hidden");

  document.getElementById("hall-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetHallForm() {
  editingHallId = null;
  document.getElementById("hall-form").reset();
  document.getElementById("h-active").checked = true;
  document.getElementById("hall-form-title").textContent = "Add a hall";
  document.getElementById("hall-cancel-edit").classList.add("hidden");
}

function wireHallForm() {
  const form = document.getElementById("hall-form");
  const messageEl = document.getElementById("hall-form-message");

  document.getElementById("hall-cancel-edit").addEventListener("click", resetHallForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const payload = {
      name: document.getElementById("h-name").value.trim(),
      description: document.getElementById("h-description").value.trim(),
      capacity: Number(document.getElementById("h-capacity").value) || 0,
      location: document.getElementById("h-location").value.trim(),
      facilities: document.getElementById("h-facilities").value
        .split(",").map((s) => s.trim()).filter(Boolean),
      isActive: document.getElementById("h-active").checked
    };

    if (!payload.name) {
      showMessage(messageEl, "Hall name is required.");
      return;
    }

    try {
      if (editingHallId) {
        await updateDoc(doc(db, "halls", editingHallId), payload);
        showMessage(messageEl, "Hall updated.", "success");
      } else {
        await addDoc(collection(db, "halls"), { ...payload, image_url: "" });
        showMessage(messageEl, "Hall added.", "success");
      }
      resetHallForm();
    } catch (err) {
      showMessage(messageEl, sanitizeErrorMessage(err, "saving the hall"));
    }
  });
}

async function deleteHall(hallId) {
  const hall = hallsCache.find((h) => h.id === hallId);
  if (!hall) return;
  if (!confirm(`Delete "${hall.name}"? This can't be undone. Existing bookings will keep their records, but the hall will no longer be bookable.`)) return;
  try {
    await deleteDoc(doc(db, "halls", hallId));
  } catch (err) {
    alert(sanitizeErrorMessage(err, "deleting this hall"));
  }
}

function wireAdminBookingForm() {
  const form = document.getElementById("admin-booking-form");
  if (!form) return;
  const messageEl = document.getElementById("admin-booking-message");

  const dateInput = document.getElementById("admin-bk-date");
  if (dateInput) {
    dateInput.min = new Date().toISOString().split("T")[0];
    dateInput.addEventListener("click", () => {
      try { dateInput.showPicker(); } catch (e) {}
    });
  }

  document.querySelectorAll("[data-admin-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [start, end] = btn.dataset.adminSlot.split("-");
      const sSelect = document.getElementById("admin-bk-start");
      const eSelect = document.getElementById("admin-bk-end");
      if (sSelect && eSelect) {
        sSelect.value = start;
        eSelect.value = end;
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage(messageEl);

    const hallId = document.getElementById("admin-bk-hall").value;
    const bookingDate = document.getElementById("admin-bk-date").value;
    const startTime = document.getElementById("admin-bk-start").value;
    const endTime = document.getElementById("admin-bk-end").value;
    const eventName = document.getElementById("admin-bk-event-name").value.trim();
    const purpose = document.getElementById("admin-bk-purpose").value.trim();
    const attendees = Number(document.getElementById("admin-bk-attendees").value);

    if (!hallId) return showMessage(messageEl, "Please select a conference hall.");
    if (!bookingDate) return showMessage(messageEl, "Please select a date.");
    if (!startTime || !endTime) return showMessage(messageEl, "Please specify both start and end times.");
    if (startTime >= endTime) return showMessage(messageEl, "End time must be after start time.");
    if (!eventName) return showMessage(messageEl, "Please enter an event name.");
    if (!purpose) return showMessage(messageEl, "Please enter event purpose.");
    if (isNaN(attendees) || attendees < 1) return showMessage(messageEl, "Attendees must be at least 1.");

    const hall = hallsCache.find((h) => h.id === hallId);
    if (!hall) return showMessage(messageEl, "Selected hall is unavailable.");

    // Conflict check against already approved bookings
    const conflict = bookingsCache.find((b) =>
      b.hallId === hallId &&
      b.bookingDate === bookingDate &&
      b.status === "approved" &&
      timesOverlap(startTime, endTime, b.startTime, b.endTime)
    );
    if (conflict) {
      return showMessage(
        messageEl,
        `Conflict: "${conflict.eventName}" already booked on ${formatDate(bookingDate)} from ${formatTime(conflict.startTime)} to ${formatTime(conflict.endTime)}.`
      );
    }

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Booking hall…";

    try {
      const bookingData = {
        userId: currentProfile.uid,
        userName: currentProfile.name || currentProfile.email,
        userEmail: currentProfile.email,
        department: currentProfile.department || "Administration",
        hallId: hall.id,
        hallName: hall.name,
        bookingDate,
        startTime,
        endTime,
        eventName,
        purpose,
        expectedAttendees: attendees,
        status: "approved",
        rejectionReason: ""
      };

      const docRef = await addDoc(collection(db, "bookings"), {
        ...bookingData,
        createdAt: serverTimestamp()
      });

      sendBookingToGoogleSheet({
        id: docRef?.id || "",
        ...bookingData
      }).catch(() => {});

      showMessage(messageEl, `Booking confirmed and approved for "${hall.name}"!`, "success");
      form.reset();

      setTimeout(() => {
        const bookingsBtn = document.querySelector('button[data-tab-target="view-bookings"]');
        if (bookingsBtn) bookingsBtn.click();
      }, 700);
    } catch (err) {
      showMessage(messageEl, sanitizeErrorMessage(err, "booking hall"));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Book Hall Now (Direct Approval)";
    }
  });
}

/* ---------------------------------------------------------------------- */
/* BOOKINGS                                                                 */
/* ---------------------------------------------------------------------- */

function listenBookings() {
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    bookingsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderBookingsTable();
    renderOverviewStats();
  }, () => {});
}

function renderBookingsTable() {
  const filter = document.getElementById("booking-status-filter").value;
  const tbody = document.getElementById("bookings-tbody");
  const rows = bookingsCache.filter((b) => filter === "all" || b.status === filter);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No bookings match this filter.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((b) => `
    <tr>
      <td class="cell-strong">${escapeHtml(b.eventName)}</td>
      <td>${escapeHtml(b.hallName)}</td>
      <td>${formatDate(b.bookingDate)}<br><span class="cell-muted">${formatTime(b.startTime)} – ${formatTime(b.endTime)}</span></td>
      <td><span class="badge badge-info" style="font-weight:600;">${calcDuration(b.startTime, b.endTime)}</span></td>
      <td>${escapeHtml(b.userName)}<br><span class="cell-muted">${escapeHtml(b.userEmail)}</span></td>
      <td>${escapeHtml(String(b.expectedAttendees ?? "—"))}</td>
      <td>${statusBadge(b.status)}${b.status === "rejected" && b.rejectionReason ? `<div class="cell-muted">${escapeHtml(b.rejectionReason)}</div>` : ""}</td>
      <td>
        ${b.status === "pending" ? `
          <div class="inline-actions">
            <button class="btn btn-sm btn-success" data-approve="${b.id}">Approve</button>
            <button class="btn btn-sm btn-danger" data-reject="${b.id}">Reject</button>
          </div>
        ` : `<span class="cell-muted">—</span>`}
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", () => approveBooking(btn.getAttribute("data-approve")));
  });
  tbody.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => rejectBooking(btn.getAttribute("data-reject")));
  });
}

async function approveBooking(bookingId) {
  const booking = bookingsCache.find((b) => b.id === bookingId);
  if (!booking) return;

  // Two pending requests can both target the same slot, so this overlap
  // check runs again right here, immediately before approval — not just
  // once at booking time.
  const conflict = bookingsCache.find((b) =>
    b.id !== bookingId &&
    b.hallId === booking.hallId &&
    b.bookingDate === booking.bookingDate &&
    b.status === "approved" &&
    timesOverlap(booking.startTime, booking.endTime, b.startTime, b.endTime)
  );

  if (conflict) {
    alert(`Can't approve — "${conflict.eventName}" already has this hall booked on ${formatDate(booking.bookingDate)} from ${formatTime(conflict.startTime)} to ${formatTime(conflict.endTime)}.`);
    return;
  }

  try {
    await updateDoc(doc(db, "bookings", bookingId), { status: "approved", rejectionReason: "" });
    updateGoogleSheetBookingStatus(bookingId, "approved").catch(() => {});
  } catch (err) {
    alert(sanitizeErrorMessage(err, "approving this booking"));
  }
}

async function rejectBooking(bookingId) {
  const reason = prompt("Reason for rejecting this booking (shown to the requester):");
  if (reason === null) return; // admin cancelled the prompt
  const cleanReason = reason.trim() || "No reason given.";
  try {
    await updateDoc(doc(db, "bookings", bookingId), {
      status: "rejected",
      rejectionReason: cleanReason
    });
    updateGoogleSheetBookingStatus(bookingId, "rejected", cleanReason).catch(() => {});
  } catch (err) {
    alert(sanitizeErrorMessage(err, "rejecting this booking"));
  }
}

/* ---------------------------------------------------------------------- */
/* OVERVIEW                                                                 */
/* ---------------------------------------------------------------------- */

function renderOverviewStats() {
  const el = document.getElementById("overview-stats");
  if (!el) return;
  const pending = bookingsCache.filter((b) => b.status === "pending").length;
  const approved = bookingsCache.filter((b) => b.status === "approved").length;
  const activeUsers = usersCache.filter((u) => u.isActive !== false).length;
  const pendingApprovals = usersCache.filter((u) => u.isActive === false && u.isApproved === false).length;

  el.innerHTML = `
    <div class="stat-card"><div class="stat-value">${hallsCache.length}</div><div class="stat-label">Conference halls</div></div>
    <div class="stat-card"><div class="stat-value">${pending}</div><div class="stat-label">Pending bookings</div></div>
    <div class="stat-card"><div class="stat-value">${approved}</div><div class="stat-label">Approved bookings</div></div>
    <div class="stat-card"><div class="stat-value">${activeUsers}</div><div class="stat-label">Active users</div></div>
    ${pendingApprovals > 0 ? `
      <div class="stat-card" style="border: 2px solid #f59e0b; background: #fffbeb;">
        <div class="stat-value" style="color: #b45309;">${pendingApprovals}</div>
        <div class="stat-label" style="font-weight:600; color:#92400e;">⏳ Pending User Requests</div>
      </div>
    ` : ""}
  `;

  // Update Users sidebar button with red badge if any pending approvals
  const usersNavBtn = document.querySelector('button[data-tab-target="view-users"]');
  if (usersNavBtn) {
    usersNavBtn.innerHTML = pendingApprovals > 0 
      ? `Users <span style="background:#ef4444; color:#fff; border-radius:10px; padding:1px 7px; font-size:11px; margin-left:6px; font-weight:700;">${pendingApprovals}</span>`
      : 'Users';
  }

  // Update Bookings sidebar button with badge if any pending requests
  const bookingsNavBtn = document.getElementById("nav-bookings-btn") || document.querySelector('button[data-tab-target="view-bookings"]');
  if (bookingsNavBtn) {
    bookingsNavBtn.innerHTML = pending > 0
      ? `Bookings <span style="background:#2563eb; color:#fff; border-radius:10px; padding:1px 7px; font-size:11px; margin-left:6px; font-weight:700;">${pending}</span>`
      : 'Bookings';
  }

  // Render pending bookings on Overview tab
  const pendingTbody = document.getElementById("overview-pending-tbody");
  if (pendingTbody) {
    const pendingList = bookingsCache.filter((b) => b.status === "pending");
    if (pendingList.length === 0) {
      pendingTbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">No pending booking requests.</div></td></tr>`;
    } else {
      pendingTbody.innerHTML = pendingList.map((b) => `
        <tr data-booking-id="${escapeHtml(b.id)}">
          <td class="cell-strong">${escapeHtml(b.eventName)}</td>
          <td>${escapeHtml(b.hallName)}</td>
          <td>${formatDate(b.bookingDate)}<br><span class="cell-muted">${formatTime(b.startTime)} – ${formatTime(b.endTime)}</span></td>
          <td><span class="badge badge-info" style="font-weight:600;">${calcDuration(b.startTime, b.endTime)}</span></td>
          <td>${escapeHtml(b.userName)}<br><span class="cell-muted">${escapeHtml(b.userEmail)}</span></td>
          <td>${escapeHtml(String(b.expectedAttendees ?? "—"))}</td>
          <td>
            <div class="inline-actions">
              <button type="button" class="btn btn-sm btn-primary" data-overview-approve="${escapeHtml(b.id)}">Approve</button>
              <button type="button" class="btn btn-sm btn-danger" data-overview-reject="${escapeHtml(b.id)}">Reject</button>
            </div>
          </td>
        </tr>
      `).join("");

      pendingTbody.querySelectorAll("[data-overview-approve]").forEach((btn) => {
        btn.addEventListener("click", () => approveBooking(btn.dataset.overviewApprove));
      });
      pendingTbody.querySelectorAll("[data-overview-reject]").forEach((btn) => {
        btn.addEventListener("click", () => rejectBooking(btn.dataset.overviewReject));
      });
    }
  }
}
