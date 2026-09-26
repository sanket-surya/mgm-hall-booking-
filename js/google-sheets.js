// ==========================================================================
// google-sheets.js — Google Sheets & Excel Export Integration
// Sir Vishveshwaraiah Conference Hall Booking System — MGM CEN
// ==========================================================================

// TODO: Replace this URL with your Google Apps Script Web App URL
// Follow the instructions in README or the setup guide to get your Web App URL.
export const GOOGLE_SHEETS_CONFIG = {
  // Paste your Google Apps Script Web App URL here:
  webhookUrl: "",
  // Paste your Google Sheet view URL here (optional, for direct link):
  sheetViewUrl: ""
};

/**
 * Sends a booking record to Google Sheets asynchronously.
 * Uses no-cors mode to prevent browser cross-origin redirects from blocking execution.
 *
 * @param {Object} booking
 * @returns {Promise<boolean>}
 */
export async function sendBookingToGoogleSheet(booking) {
  const url = GOOGLE_SHEETS_CONFIG.webhookUrl?.trim();
  if (!url) return false;

  const payload = {
    action: "add_booking",
    bookingId: booking.id || "",
    timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    eventName: booking.eventName || "—",
    hallName: booking.hallName || "—",
    bookingDate: booking.bookingDate || "—",
    timeSlot: `${booking.startTime || ""} – ${booking.endTime || ""}`,
    userName: booking.userName || "—",
    userEmail: booking.userEmail || "—",
    department: booking.department || "—",
    attendees: booking.expectedAttendees || "—",
    status: booking.status || "pending",
    purpose: booking.purpose || "—"
  };

  try {
    // Mode 'no-cors' allows sending data to Google Apps Script without preflight rejection
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Updates a booking's status (Approved/Rejected) in Google Sheets if configured.
 *
 * @param {string} bookingId
 * @param {string} newStatus
 * @param {string} [reason=""]
 */
export async function updateGoogleSheetBookingStatus(bookingId, newStatus, reason = "") {
  const url = GOOGLE_SHEETS_CONFIG.webhookUrl?.trim();
  if (!url) return;

  const payload = {
    action: "update_status",
    bookingId,
    status: newStatus,
    reason,
    updatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Silently handled
  }
}

/**
 * Generates and downloads an Excel-compatible CSV file containing all bookings.
 * Includes UTF-8 BOM so Microsoft Excel renders Marathi/English characters flawlessly.
 *
 * @param {Array<Object>} bookings
 */
export function exportBookingsToCSV(bookings) {
  if (!bookings || bookings.length === 0) {
    alert("No bookings to export.");
    return;
  }

  const headers = [
    "Event Name",
    "Conference Hall",
    "Date",
    "Start Time",
    "End Time",
    "Requested By (Faculty/Organizer)",
    "Email",
    "Department",
    "Expected Attendees",
    "Status",
    "Purpose",
    "Remarks / Rejection Reason"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = bookings.map((b) => [
    escapeCSV(b.eventName),
    escapeCSV(b.hallName),
    escapeCSV(b.bookingDate),
    escapeCSV(b.startTime),
    escapeCSV(b.endTime),
    escapeCSV(b.userName),
    escapeCSV(b.userEmail),
    escapeCSV(b.department),
    escapeCSV(b.expectedAttendees),
    escapeCSV(b.status ? b.status.toUpperCase() : "PENDING"),
    escapeCSV(b.purpose),
    escapeCSV(b.rejectionReason || "")
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date().toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `MGM_Conference_Hall_Bookings_${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Registers a new user (Faculty/Organizer) into the Google Sheet "Users" tab.
 *
 * @param {Object} user - { uid, name, email, role, department }
 * @returns {Promise<boolean>}
 */
export async function syncUserToGoogleSheet(user) {
  const url = GOOGLE_SHEETS_CONFIG.webhookUrl?.trim();
  if (!url) return false;

  const payload = {
    action: "add_user",
    userId: user.uid || user.id || "",
    name: user.name || "—",
    email: user.email || "—",
    role: user.role || "faculty",
    department: user.department || "—",
    status: user.isApproved === false ? "PENDING_APPROVAL" : (user.isActive === false ? "DEACTIVATED" : "ACTIVE"),
    timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Updates a user's status in the Google Sheet (ACTIVE / DEACTIVATED).
 *
 * @param {string} userId
 * @param {string} email
 * @param {"ACTIVE"|"DEACTIVATED"} status
 */
export async function updateUserStatusInGoogleSheet(userId, email, status) {
  const url = GOOGLE_SHEETS_CONFIG.webhookUrl?.trim();
  if (!url) return;

  const payload = {
    action: "update_user_status",
    userId: userId || "",
    email: email || "",
    status: status || "ACTIVE",
    timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Silently handled
  }
}

/**
 * Removes a user's row completely from the Google Sheet.
 *
 * @param {string} userId
 * @param {string} email
 */
export async function removeUserFromGoogleSheet(userId, email) {
  const url = GOOGLE_SHEETS_CONFIG.webhookUrl?.trim();
  if (!url) return;

  const payload = {
    action: "remove_user",
    userId: userId || "",
    email: email || "",
    timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Silently handled
  }
}

/**
 * Generates and downloads an Excel-compatible CSV file of registered users.
 *
 * @param {Array<Object>} users
 */
export function exportUsersToCSV(users) {
  if (!users || users.length === 0) {
    alert("No users to export.");
    return;
  }

  const headers = [
    "Full Name",
    "College Email",
    "Role",
    "Department",
    "Account Status"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = users.map((u) => [
    escapeCSV(u.name),
    escapeCSV(u.email),
    escapeCSV((u.role || "").toUpperCase()),
    escapeCSV(u.department || "—"),
    escapeCSV(u.isActive === false ? "DEACTIVATED" : "ACTIVE")
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const now = new Date().toISOString().split("T")[0];
  const a = document.createElement("a");
  a.href = url;
  a.download = `MGM_Conference_Hall_Users_${now}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
