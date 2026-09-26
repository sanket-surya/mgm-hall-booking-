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
 * 4. Delete any code in the editor, and paste this entire code.
 * 5. Click "Save" (floppy disk icon).
 * 6. Click "Deploy" > "New deployment"
 * 7. Click the gear icon next to "Select type" and choose "Web app"
 * 8. Set:
 *    - Description: "MGM Hall Booking Webhook"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"  <-- (VERY IMPORTANT so bookings can sync)
 * 9. Click "Deploy" -> Click "Authorize access" -> Choose your Google Account -> Click "Advanced" -> "Go to (unsafe)" -> Click "Allow".
 * 10. Copy the "Web app URL" (ends in /exec).
 * 11. Paste that URL into js/google-sheets.js in the "webhookUrl" field!
 * ==============================================================================
 */

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Bookings");
    if (!sheet) {
      sheet = ss.getSheets()[0];
      sheet.setName("Bookings");
    }

    // Auto-create headers if sheet is empty
    ensureHeaders(sheet);

    if (data.action === "add_booking") {
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

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Booking appended" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "update_status") {
      var bookingId = data.bookingId;
      var newStatus = (data.status || "PENDING").toUpperCase();
      var reason = data.reason || "";

      var dataRange = sheet.getDataRange().getValues();
      for (var i = 1; i < dataRange.length; i++) {
        if (String(dataRange[i][0]) === String(bookingId)) {
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

      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Status updated" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    college: "MGM's College of Engineering, Nanded",
    system: "Sir Vishveshwaraiah Conference Hall Booking System",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function ensureHeaders(sheet) {
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

    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1e293b"); // Slate dark
    headerRange.setFontColor("#ffffff");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function formatStatusCell(cell, status) {
  cell.setFontWeight("bold");
  cell.setHorizontalAlignment("center");
  if (status === "APPROVED") {
    cell.setBackground("#dcfce7"); // Light green
    cell.setFontColor("#166534"); // Dark green
  } else if (status === "REJECTED") {
    cell.setBackground("#fee2e2"); // Light red
    cell.setFontColor("#991b1b"); // Dark red
  } else {
    cell.setBackground("#fef9c3"); // Light yellow
    cell.setFontColor("#854d0e"); // Dark yellow / amber
  }
}
