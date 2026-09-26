// ==========================================================================
// firebase-config.js — Firebase configuration and initialization
// Sir Vishveshwaraiah Conference Hall Booking System — MGM CEN
// ==========================================================================

import * as mock from "./firebase-mock.js";

// ==========================================================================
// FIREBASE CONFIGURATION
// To connect to your real Firebase project:
// 1. Go to Firebase Console (https://console.firebase.google.com)
// 2. Project Settings > General > Your apps > Web app
// 3. Paste your credentials below.
// When apiKey is "YOUR_API_KEY", Demo/Mock Mode runs automatically.
// ==========================================================================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// College email domains permitted to log in
export const ALLOWED_EMAIL_DOMAINS = ["mgmcen.ac.in", "mgmce.ac.in", "mgmnanded.ac.in"];

// Detect if we should use Offline Demo/Mock Mode
export const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

// Real Firebase references (lazily loaded when not in mock mode)
let realAppInstance = null;
let realAuthInstance = null;
let realDbInstance = null;

if (!isMockMode) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  realAppInstance = initializeApp(firebaseConfig);
  realAuthInstance = getAuth(realAppInstance);
  realDbInstance = getFirestore(realAppInstance);
}

export const auth = isMockMode ? mock.mockAuth : realAuthInstance;
export const db = isMockMode ? mock.mockDb : realDbInstance;

// Secondary Auth Helper
export async function withSecondaryAuth(action) {
  if (isMockMode) {
    return mock.mockWithSecondaryAuth(action);
  }
  const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const secondaryAppName = `SecondaryAuth_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    return await action(secondaryAuth);
  } finally {
    try {
      await deleteApp(secondaryApp);
    } catch (err) {
      // Silently handled in production
    }
  }
}

// --------------------------------------------------------------------------
// Auth Delegation
// --------------------------------------------------------------------------

export async function signInWithEmailAndPassword(authInst, email, password) {
  if (isMockMode) return mock.mockSignInWithEmailAndPassword(authInst, email, password);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  return mod.signInWithEmailAndPassword(authInst, email, password);
}

export function onAuthStateChanged(authInst, callback) {
  if (isMockMode) return mock.mockOnAuthStateChanged(authInst, callback);
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").then((mod) => {
    mod.onAuthStateChanged(authInst, callback);
  });
  return () => {};
}

export async function signOut(authInst) {
  if (isMockMode) return mock.mockSignOut(authInst);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  return mod.signOut(authInst);
}

export async function createUserWithEmailAndPassword(authInst, email, password) {
  if (isMockMode) return mock.mockCreateUserWithEmailAndPassword(authInst, email, password);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  return mod.createUserWithEmailAndPassword(authInst, email, password);
}

// --------------------------------------------------------------------------
// Firestore Delegation
// --------------------------------------------------------------------------

export function collection(dbInst, path) {
  if (isMockMode) return mock.mockCollection(dbInst, path);
  return { _realCol: path };
}

export function doc(dbInst, path, id) {
  if (isMockMode) return mock.mockDoc(dbInst, path, id);
  return { _realDoc: { path, id } };
}

export async function getDoc(docRef) {
  if (isMockMode) return mock.mockGetDoc(docRef);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.getDoc(mod.doc(db, docRef._realDoc.path, docRef._realDoc.id));
}

export async function getDocs(queryOrCol) {
  if (isMockMode) return mock.mockGetDocs(queryOrCol);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.getDocs(queryOrCol);
}

export async function addDoc(colRef, data) {
  if (isMockMode) return mock.mockAddDoc(colRef, data);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.addDoc(mod.collection(db, colRef._realCol), data);
}

export async function setDoc(docRef, data) {
  if (isMockMode) return mock.mockSetDoc(docRef, data);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.setDoc(mod.doc(db, docRef._realDoc.path, docRef._realDoc.id), data);
}

export async function updateDoc(docRef, data) {
  if (isMockMode) return mock.mockUpdateDoc(docRef, data);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.updateDoc(mod.doc(db, docRef._realDoc.path, docRef._realDoc.id), data);
}

export async function deleteDoc(docRef) {
  if (isMockMode) return mock.mockDeleteDoc(docRef);
  const mod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return mod.deleteDoc(mod.doc(db, docRef._realDoc.path, docRef._realDoc.id));
}

export function onSnapshot(queryOrCol, callback, errCallback) {
  if (isMockMode) return mock.mockOnSnapshot(queryOrCol, callback, errCallback);
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then((mod) => {
    let target = queryOrCol;
    if (queryOrCol._realCol) target = mod.collection(db, queryOrCol._realCol);
    mod.onSnapshot(target, callback, errCallback);
  });
  return () => {};
}

export function query(col, ...constraints) {
  if (isMockMode) return mock.mockQuery(col, ...constraints);
  return { col, constraints };
}

export function where(field, op, val) {
  if (isMockMode) return mock.mockWhere(field, op, val);
  return { type: "where", field, op, val };
}

export function orderBy(field, dir = "asc") {
  if (isMockMode) return mock.mockOrderBy(field, dir);
  return { type: "orderBy", field, dir };
}

export function serverTimestamp() {
  if (isMockMode) return mock.mockServerTimestamp();
  return { toMillis: () => Date.now(), toDate: () => new Date() };
}
