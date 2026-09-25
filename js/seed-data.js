// ==========================================================================
// seed-data.js
//
// One-time helper that adds the three default halls to Firestore:
//   - Sir Vishveshwaraiah Conference Hall (capacity 200, Main Block)
//   - Conference Room A (capacity 40)
//   - Conference Room B (capacity 80)
//
// This file is NOT loaded automatically by any page — run it once,
// deliberately, after Firebase is configured and Firestore rules are
// deployed. It is safe to run more than once: it skips any hall whose name
// already exists, matched by exact name.
//
// HOW TO RUN IT (pick one):
//
//   A) Browser console (no file edits needed):
//      1. Open admin-dashboard.html and log in as an admin.
//      2. Open DevTools > Console and paste:
//           import("./js/seed-data.js").then(m => m.seedDefaultHalls());
//
//   B) Temporary script tag:
//      1. Add this line inside <head> of admin-dashboard.html:
//           <script type="module" src="js/seed-data.js"></script>
//      2. Reload the page once while signed in as admin.
//      3. Remove the script tag again — it only needs to run once.
// ==========================================================================

import { db } from "./firebase-config.js";
import {
  collection, getDocs, query, where, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_HALLS = [
  {
    name: "Sir Vishveshwaraiah Conference Hall",
    description: "Main conference hall for large college events, seminars, and functions.",
    capacity: 200,
    location: "Main Block",
    facilities: ["Projector", "Podium", "Sound system", "Air conditioning"],
    image_url: "",
    isActive: true
  },
  {
    name: "Conference Room A",
    description: "Mid-sized room suited to departmental meetings and workshops.",
    capacity: 40,
    location: "Main Block",
    facilities: ["Projector", "Whiteboard"],
    image_url: "",
    isActive: true
  },
  {
    name: "Conference Room B",
    description: "Larger meeting room for seminars and guest lectures.",
    capacity: 80,
    location: "Main Block",
    facilities: ["Projector", "Sound system"],
    image_url: "",
    isActive: true
  }
];

export async function seedDefaultHalls() {
  const hallsRef = collection(db, "halls");
  let added = 0;

  for (const hall of DEFAULT_HALLS) {
    const existing = await getDocs(query(hallsRef, where("name", "==", hall.name)));
    if (existing.empty) {
      await addDoc(hallsRef, hall);
      added += 1;
      console.log(`Added hall: ${hall.name}`);
    } else {
      console.log(`Skipped (already exists): ${hall.name}`);
    }
  }

  console.log(`Done. ${added} hall(s) added.`);
  return added;
}
