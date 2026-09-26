# 📊 Google Sheets & Excel Live Integration Setup Guide
**MGM's College of Engineering, Nanded (mgmcen.ac.in)**  
*Sir Vishveshwaraiah Conference Hall Booking System*

---

## 🎯 What this does (काय फायदा आहे?)
1. **Live Bookings Sync:** Whenever any Faculty or Organizer submits a conference hall booking request, a new row is instantly added to the **"Bookings"** tab in your College's Google Sheet in real-time.
2. **Auto Booking Status Update:** When Admin (Sanket / Authority) approves or rejects a booking, the status in the Google Sheet automatically turns **APPROVED** (Green) or **REJECTED** (Red).
3. **Live User Registration Sync:** When any Faculty or Organizer registers on the website (or Admin creates them), their details (Name, Email, Role, Department) are instantly saved into a **"Users"** tab in the Google Sheet.
4. **Auto User Status & Removal:**
   - When Admin deactivates/reactivates a user, their status updates in the Google Sheet.
   - When Admin clicks **"Remove"**, the user's row is **deleted directly from the Google Sheet**!
5. **1-Click Excel CSV Export:** On the Admin Dashboard, click **"📊 Export to Excel (.csv)"** for Bookings or **"📊 Export Users (.csv)"** to download all records anytime for college records, NAAC inspection, or printouts.

---

## 🚀 5-Minute Setup Steps (कसे सुरू करायचे?)

### Step 1: Create a Google Sheet
1. Go to [sheets.new](https://sheets.new) (logged in with College email or personal Gmail).
2. Name your spreadsheet:  
   `MGM Conference Hall Bookings - 2026`

---

### Step 2: Open Apps Script
1. In the top menu of your Google Sheet, click **Extensions** > **Apps Script**.
2. Delete everything inside the script editor (`function myFunction() {...}`).
3. Open the file [`google-apps-script.js`](./google-apps-script.js) from this project, copy all its code, and paste it into the Apps Script editor.
4. Click the **Save** icon (💾 floppy disk).

---

### Step 3: Deploy as Web App
1. In the top-right corner of Apps Script, click **Deploy** > **New deployment**.
2. Click the gear icon (⚙️) next to *Select type* and choose **Web app**.
3. Fill in the fields:
   - **Description**: `MGM Hall Booking Webhook`
   - **Execute as**: `Me (your email)`
   - **Who has access**: **`Anyone`**  *(महत्वाचे: "Anyone" निवडा जेणेकरून वेबसाइटवरून डेटा शीटमध्ये येऊ शकेल)*
4. Click **Deploy**.
5. Click **Authorize access**, select your Google account:
   - If Google shows *"Google hasn't verified this app"*, click **Advanced** (खाली डाव्या बाजूला), then click **Go to Untitled project (unsafe)**, and click **Allow**.
6. Copy the generated **Web app URL** (it looks like `https://script.google.com/macros/s/AKfycbx.../exec`).

---

### Step 4: Paste URL into the Website
1. Open the project file: [`js/google-sheets.js`](./js/google-sheets.js).
2. At the top (line 8), paste your copied URL into `webhookUrl`:
```javascript
export const GOOGLE_SHEETS_CONFIG = {
  // Your Google Apps Script Web App URL:
  webhookUrl: "https://script.google.com/macros/s/AKfycbx.../exec",
  // Your Google Sheet link (so Admin can click and open the sheet directly):
  sheetViewUrl: "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
};
```
3. Save the file and commit/push to GitHub (`git add . && git commit -m "Configure Google Sheets" && git push origin main`).

---

## 🔒 Privacy & College Handover (काही खाजगी माहिती जाणार का?)
- **Zero personal data leaks:** The Google Sheet can be created directly on the Principal/HOD/College IT's Google Workspace email (`@mgmcen.ac.in`).
- Your personal GitHub credentials or email are **never** stored or visible in the sheet.
- All hall booking records stay completely inside the College's official Google Drive.
