/**
 * ==============================================================================
 * MGM's College of Engineering, Nanded (mgmcen.ac.in)
 * Sir Vishveshwaraiah Conference Hall Booking System
 * Google Sheets Auto-Sync Webhook Script (Google Apps Script)
 * ==============================================================================
 *
 * HOW TO INSTALL:
 * 1. Open Google Sheets (https://sheets.new) using your college Google account or personal Gmail.
 * 2. Name your spreadsheet: "MGM Conference Hall Bookings - 2026"
 * 3. In the top menu, click: Extensions > Apps Script
 * 4. Delete any existing code, and paste this entire code.
 * 5. Click "Save" (💾 icon).
 * 6. Click "Deploy" > "New deployment"
 * 7. Click the gear icon (⚙️) next to "Select type" and choose "Web app"
 * 8. Set:
 *    - Description: "MGM Hall Booking Webhook"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"  <-- (CRITICAL for receiving data from website)
 * 9. Click "Deploy" -> Click "Authorize access" -> Choose account -> "Advanced" -> "Go to Untitled project (unsafe)" -> "Allow".
 * 10. Copy the generated Web app URL (ends with /exec).
 * 11. Paste that URL into js/google-sheets.js in the "webhookUrl" field!
 * ==============================================================================
 */

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // --------------------------------------------------------------------------
    // 1. ADD BOOKING
    // --------------------------------------------------------------------------
    if (data.action === "add_booking") {
      var sheet = getOrCreateSheet(ss, "Bookings");
      ensureBookingHeaders(sheet);

      var row = [
        data.bookingId || ("BK-" + new Date().getTime()),
        data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        data.eventName || "—",
        data.hallName || "—",
        data.bookingDate || "—",
        data.timeSlot || "—",
        data.userName || "—",
        data.userEmail || "—",
        data.department || "—",
        data.attendees || 0,
        (data.status || "PENDING").toUpperCase(),
        data.purpose || "—",
        "" // Remarks / Rejection reason
      ];

      sheet.appendRow(row);
      var lastRow = sheet.getLastRow();
      formatStatusCell(sheet.getRange(lastRow, 11), (data.status || "PENDING").toUpperCase());

      return jsonResponse({ success: true, message: "Booking added successfully" });
    }

    // --------------------------------------------------------------------------
    // 2. UPDATE BOOKING STATUS (Approve / Reject)
    // --------------------------------------------------------------------------
    if (data.action === "update_status") {
      var sheet = getOrCreateSheet(ss, "Bookings");
      var bookingId = String(data.bookingId || "").trim();
      var newStatus = (data.status || "PENDING").toUpperCase();
      var reason = data.reason || "";

      var dataRange = sheet.getDataRange().getValues();
      for (var i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][0]).trim() === bookingId) {
          var rowIndex = i + 1;
          var statusCell = sheet.getRange(rowIndex, 11);
          statusCell.setValue(newStatus);
          formatStatusCell(statusCell, newStatus);

          if (reason) {
            sheet.getRange(rowIndex, 13).setValue(reason);
          }
          break;
        }
      }

      return jsonResponse({ success: true, message: "Booking status updated" });
    }

    // --------------------------------------------------------------------------
    // 3. ADD REGISTERED USER
    // --------------------------------------------------------------------------
    if (data.action === "add_user") {
      var userSheet = getOrCreateSheet(ss, "Users");
      ensureUserHeaders(userSheet);

      var userRow = [
        data.userId || ("USR-" + new Date().getTime()),
        data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        data.name || "—",
        data.email || "—",
        (data.role || "faculty").toUpperCase(),
        data.department || "—",
        (data.status || "ACTIVE").toUpperCase(),
        data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      ];

      userSheet.appendRow(userRow);
      var userLastRow = userSheet.getLastRow();
      formatUserStatusCell(userSheet.getRange(userLastRow, 7), (data.status || "ACTIVE").toUpperCase());

      return jsonResponse({ success: true, message: "User registered in Google Sheet" });
    }

    // --------------------------------------------------------------------------
    // 4. UPDATE USER STATUS (Active / Deactivated)
    // --------------------------------------------------------------------------
    if (data.action === "update_user_status") {
      var userSheet = getOrCreateSheet(ss, "Users");
      var targetId = String(data.userId || "").trim();
      var targetEmail = String(data.email || "").trim().toLowerCase();
      var newStatus = (data.status || "ACTIVE").toUpperCase();
      var updatedAt = data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      var values = userSheet.getDataRange().getValues();
      for (var j = 1; j < values.length; j++) {
        var rowId = String(values[j][0]).trim();
        var rowEmail = String(values[j][3]).trim().toLowerCase();

        if ((targetId && rowId === targetId) || (targetEmail && rowEmail === targetEmail)) {
          var rIdx = j + 1;
          var uStatusCell = userSheet.getRange(rIdx, 7);
          uStatusCell.setValue(newStatus);
          formatUserStatusCell(uStatusCell, newStatus);
          userSheet.getRange(rIdx, 8).setValue(updatedAt);
          break;
        }
      }

      return jsonResponse({ success: true, message: "User status updated" });
    }

    // --------------------------------------------------------------------------
    // 5. REMOVE USER (Delete from Google Sheet)
    // --------------------------------------------------------------------------
    if (data.action === "remove_user") {
      var userSheet = getOrCreateSheet(ss, "Users");
      var delId = String(data.userId || "").trim();
      var delEmail = String(data.email || "").trim().toLowerCase();

      var uValues = userSheet.getDataRange().getValues();
      var found = false;
      for (var k = 1; k < uValues.length; k++) {
        var curId = String(uValues[k][0]).trim();
        var curEmail = String(uValues[k][3]).trim().toLowerCase();

        if ((delId && curId === delId) || (delEmail && curEmail === delEmail)) {
          var delRowIdx = k + 1;
          // Delete row directly from Google Sheet
          userSheet.deleteRow(delRowIdx);
          found = true;
          break;
        }
      }

      return jsonResponse({ success: true, removed: found, message: found ? "User row deleted" : "User not found" });
    }

    return jsonResponse({ success: false, error: "Unknown action" });

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  return jsonResponse({
    status: "active",
    college: "MGM's College of Engineering, Nanded",
    system: "Sir Vishveshwaraiah Conference Hall Booking System",
    timestamp: new Date().toISOString()
  });
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // If the first default sheet is "Sheet1" and empty, rename it
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getName().toLowerCase().indexOf("sheet") >= 0 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName(sheetName);
    } else {
      sheet = ss.insertSheet(sheetName);
    }
  }
  return sheet;
}

function ensureBookingHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = [
      "Booking ID",
      "Submitted On",
      "Event Name",
      "Conference Hall",
      "Date",
      "Time Slot",
      "Requested By",
      "Email",
      "Department",
      "Attendees",
      "Status",
      "Purpose",
      "Admin Remarks"
    ];
    sheet.appendRow(headers);

    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight("bold");
    hRange.setBackground("#1e293b"); // Slate dark
    hRange.setFontColor("#ffffff");
    hRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function ensureUserHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = [
      "User ID",
      "Registered On",
      "Full Name",
      "College Email",
      "Role",
      "Department",
      "Account Status",
      "Last Updated"
    ];
    sheet.appendRow(headers);

    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight("bold");
    hRange.setBackground("#0f172a"); // Midnight blue
    hRange.setFontColor("#38bdf8"); // Sky blue text
    hRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function formatStatusCell(cell, status) {
  cell.setFontWeight("bold");
  cell.setHorizontalAlignment("center");
  if (status === "APPROVED") {
    cell.setBackground("#dcfce7");
    cell.setFontColor("#166534");
  } else if (status === "REJECTED") {
    cell.setBackground("#fee2e2");
    cell.setFontColor("#991b1b");
  } else {
    cell.setBackground("#fef9c3");
    cell.setFontColor("#854d0e");
  }
}

function formatUserStatusCell(cell, status) {
  cell.setFontWeight("bold");
  cell.setHorizontalAlignment("center");
  if (status === "ACTIVE") {
    cell.setBackground("#dcfce7");
    cell.setFontColor("#166534");
  } else {
    cell.setBackground("#fee2e2");
    cell.setFontColor("#991b1b");
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
