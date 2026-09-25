# Sir Vishveshwaraiah Conference Hall Booking System

A minimal hall-booking system for **MGM's College of Engineering, Nanded** — Admin, Faculty, and Organizer roles only. No backend server: everything runs in the browser against Firebase (Authentication + Firestore).

---

## 1. Project structure

```
index.html                  Login page
admin-dashboard.html        Admin: users, halls, bookings
faculty-dashboard.html      Faculty: book a hall, view own bookings
organizer-dashboard.html    Organizer: same as faculty
css/style.css               All styling
js/firebase-config.js       Firebase init — EDIT THIS FILE with your config
js/auth.js                  Login + role-based route guard
js/admin.js                 Admin dashboard logic
js/faculty.js               Faculty dashboard logic
js/organizer.js             Organizer dashboard logic (identical to faculty.js, role swapped)
js/utils.js                 Shared helpers
js/seed-data.js             One-time script to add the three default halls
firestore.rules             Firestore security rules
images/college-logo.png     MGM CEN logo
run.bat                     Windows: starts a local server and opens the app
run.sh                      macOS/Linux: starts a local server and opens the app
```

---

## 2. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `svch-booking-system`) → finish the wizard.
2. In the project, click the **`</>` (Web)** icon to register a web app. Give it a nickname; you don't need Firebase Hosting yet.
3. Firebase shows a `firebaseConfig` object. Copy it.

## 3. Enable Email/Password Authentication

1. In the console: **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

## 4. Create the Firestore database

1. **Build → Firestore Database → Create database**.
2. Choose a region close to Nanded (e.g. `asia-south1`).
3. Start in **production mode** (the rules file in this repo replaces the default deny-all rules — don't leave it in test mode long-term).

## 5. Paste your config into the code

Open `js/firebase-config.js` and replace the placeholder object:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

with the values Firebase gave you in step 2. This is the only file you need to edit to point the app at your project.

If the college uses a different email domain, also edit `ALLOWED_EMAIL_DOMAINS` in the same file.

## 6. Deploy the Firestore security rules

**Easiest — paste directly:**
Firebase Console → Firestore Database → **Rules** tab → paste the contents of `firestore.rules` → **Publish**.

**Or with the CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore     # point it at this project, keep the default rules filename or point it at firestore.rules
firebase deploy --only firestore:rules
```

## 7. Create the first admin account (manual, one-time)

Because the rules say "only an admin can create users," there is a chicken-and-egg problem for the very first account. Do this once, by hand:

1. Firebase Console → **Authentication → Users → Add user**. Enter an `@mgmce.ac.in` email and a password.
2. Copy the **User UID** it generates.
3. Firebase Console → **Firestore Database → Start collection** → collection ID `users` → **Document ID**: paste the UID from step 2 → add these fields:

   | Field | Type | Value |
   |---|---|---|
   | uid | string | (same UID) |
   | email | string | the email you used |
   | name | string | Admin's full name |
   | role | string | `admin` |
   | department | string | e.g. `Administration` |
   | isActive | boolean | `true` |
   | createdAt | timestamp | now |

4. Save. You can now log in at `index.html` with that email/password — you'll land on the admin dashboard, and can create every other account (faculty, organizer, more admins) from there.

## 8. Add the default halls

Once you're logged in as admin, run the seed script once — see the instructions at the top of `js/seed-data.js`. Quickest path: open `admin-dashboard.html`, sign in, open the browser DevTools console, and paste:

```js
import("./js/seed-data.js").then(m => m.seedDefaultHalls());
```

This adds:
- **Sir Vishveshwaraiah Conference Hall** — capacity 200, Main Block
- **Conference Room A** — capacity 40
- **Conference Room B** — capacity 80

(You can also add/edit/delete halls anytime from the admin dashboard's Halls tab — the script is just a shortcut for the initial three.)

## 9. Logo

The real MGM's College of Engineering, Nanded logo is already in place at `images/college-logo.png`. Nothing to do here unless you want to swap in a different file later — just keep the same filename, or update the `src` in `index.html`, `admin-dashboard.html`, `faculty-dashboard.html`, and `organizer-dashboard.html` if you rename it.

## 10. Run it

The app uses ES module `import`/`export`, which browsers block from loading over a plain double-clicked `file://` path. It has to be served over `http://localhost`. Two launchers are included so you don't have to remember a command:

- **Windows:** double-click `run.bat`
- **macOS/Linux:** run `./run.sh` (first time only: `chmod +x run.sh`)

Both need Python 3 (already on most machines; if not, [python.org/downloads](https://www.python.org/downloads/) — on Windows, tick "Add Python to PATH" during install). Either script starts a local server on port 8000 and opens `index.html` in your default browser. Leave that terminal/command window open while you use the app — closing it stops the server.

No Python available? Any static file server works instead, e.g. `npx serve .` — just don't open the HTML files by double-clicking them directly.

## 11. Host it on Firebase Hosting (optional)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # public directory: . (this folder)
firebase deploy --only hosting
```

## 12. Demo login (after you've completed step 7)

| Role | Email | Password |
|---|---|---|
| Admin | whatever you set in step 7 | whatever you set in step 7 |

Every other account is created by that admin from the Admin Dashboard → Users tab.

College email domains enforced at login: **@mgmce.ac.in**, **@mgmnanded.ac.in**.

---

## 13. Known limitations — read this before treating it as production-ready

This was built to the brief's constraints (no backend server, everything client-side). That constraint has real consequences worth knowing about rather than glossing over:

- **Admin creating users signs no one out, but only because of a workaround.** Firebase's client SDK normally signs the browser in as whoever `createUserWithEmailAndPassword()` just created — meaning an admin creating a faculty account would otherwise be booted from their own session mid-task. This project routes account creation through a second, temporary Firebase App instance (`withSecondaryAuth()` in `firebase-config.js`) to avoid that. It works, but it's a client-side workaround for something the Firebase Admin SDK (server-side, via Cloud Functions) does natively and more robustly. If you ever add a backend, move user creation there.

- **Domain restriction (`@mgmce.ac.in`) is enforced only in the browser UI, not by Firebase itself.** Firebase Auth's client SDK has no concept of "allowed domains." Someone who calls the Auth REST API directly, bypassing `index.html` entirely, could sign up with any email address unless you also add Identity Platform blocking functions or a Cloud Function trigger — both of which are backend, and both excluded by this brief. As shipped, the domain check is a UX guard, not a security boundary.

- **Double-booking prevention is best-effort, not race-condition-proof.** Firestore security rules validate one document at a time; they cannot scan the rest of the `bookings` collection to check for time overlaps. This app checks for conflicts in JavaScript — once when a booking is submitted, and again right before an admin approves it — which closes the realistic case (two people trying to book the same slot on different days is rare and the check runs at the moment that matters, approval). It does not close a true simultaneous-click race between two admins approving two overlapping pending requests at the exact same instant. A airtight guarantee needs a server-side transaction (Cloud Function), which is out of scope here.

- **The first admin account must be created by hand** in the Firebase console (step 7 above), because "only an admin can create users" has to start somewhere. This is normal for this kind of app, just not automatic.

- **Any signed-in user can read the full `users` collection** (names, emails, roles, departments of everyone) — that's what the brief's rule "only authenticated users can read" literally specifies for that collection. If that's more exposure than the college wants faculty and organizers to have, tighten `firestore.rules` to restrict reads to admins plus each user's own document.

- **Passwords set by the admin are temporary and sent out-of-band** (verbally, over a call, etc. — there's no email-invite flow here). Encourage new users to use Firebase's "forgot password" flow to set their own password on first login; this project doesn't wire up a reset-password page, since it wasn't in the brief, but Firebase Auth supports it if you add one later.

None of these are bugs — they're the direct, unavoidable tradeoffs of "no backend server, no Java, no MySQL." If any of them are a dealbreaker for the college's actual security requirements, the fix in every case is the same: add a minimal backend (even a single Cloud Function) for that one operation.
