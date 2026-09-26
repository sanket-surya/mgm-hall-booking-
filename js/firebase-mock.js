// ==========================================================================
// firebase-mock.js — Complete offline mock for Firebase Auth & Firestore
// Used when real Firebase credentials are not yet configured.
// Provides localStorage-persisted data, instant login, and full reactivity.
// ==========================================================================

const STORAGE_KEY = "svch_database_v1";
const SESSION_KEY = "svch_session_uid_v1";

// Active listeners for collection changes: collectionName -> Set of callbacks
const listeners = new Map();

function notifyListeners(collectionName) {
  const set = listeners.get(collectionName);
  if (!set) return;
  const store = getStore();
  const items = store[collectionName] || [];
  set.forEach((cb) => {
    try {
      cb({
        docs: items.map((item) => ({
          id: item.id,
          data: () => ({ ...item })
        }))
      });
    } catch (e) {
      console.error("Mock onSnapshot listener error:", e);
    }
  });
}

const authListeners = new Set();
function notifyAuthListeners(user) {
  authListeners.forEach((cb) => {
    try {
      cb(user ? { uid: user.uid, email: user.email } : null);
    } catch (e) {
      console.error("Mock auth listener error:", e);
    }
  });
}

function getInitialData() {
  return {
    users: [
      {
        id: "usr_admin_sanket",
        uid: "usr_admin_sanket",
        name: "Sanket Suryawanshi",
        email: "s25_suryawanshi_sanket@mgmcen.ac.in",
        password: "sanket@mgm2026",
        role: "admin",
        department: "Information Technology",
        isActive: true,
        createdAt: { toMillis: () => Date.now() - 86400000 * 7 }
      }
    ],
    halls: [
      {
        id: "hall_svch_01",
        name: "Sir Vishveshwaraiah Conference Hall",
        description: "Main conference hall for large college events, seminars, and annual functions.",
        capacity: 200,
        location: "Main Block",
        facilities: ["Projector", "Podium", "Sound system", "Air conditioning"],
        image_url: "",
        isActive: true
      },
      {
        id: "hall_cr_a_02",
        name: "Conference Room A",
        description: "Mid-sized room suited to departmental meetings and technical workshops.",
        capacity: 40,
        location: "Main Block",
        facilities: ["Projector", "Whiteboard"],
        image_url: "",
        isActive: true
      },
      {
        id: "hall_cr_b_03",
        name: "Conference Room B",
        description: "Larger meeting room for seminars, project reviews, and guest lectures.",
        capacity: 80,
        location: "Main Block",
        facilities: ["Projector", "Sound system"],
        image_url: "",
        isActive: true
      }
    ],
    bookings: []
  };
}

function getStore() {
  if (typeof localStorage === "undefined") return getInitialData();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const init = getInitialData();
    saveStore(init);
    return init;
  }
  try {
    const data = JSON.parse(raw);
    // Ensure admin user always has correct details
    const admin = data.users?.find((u) => u.role === "admin");
    if (admin) {
      admin.name = "Sanket Suryawanshi";
      admin.email = "s25_suryawanshi_sanket@mgmcen.ac.in";
      saveStore(data);
    }
    return data;
  } catch (e) {
    const init = getInitialData();
    saveStore(init);
    return init;
  }
}

function saveStore(data) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

// --------------------------------------------------------------------------
// Session Cookie Helpers (Standard browser session cookies)
// --------------------------------------------------------------------------

function setSessionCookie(name, value) {
  if (typeof document !== "undefined") {
    // Cookie without expires or max-age is a true SESSION COOKIE
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
  }
}

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

function getCurrentSessionUid() {
  // 1. Session Cookie (highest priority)
  const cookieUid = getCookie(SESSION_KEY) || getCookie("mgm_session_uid");
  if (cookieUid) return cookieUid;

  // 2. sessionStorage (same tab / window session)
  if (typeof sessionStorage !== "undefined") {
    const sUid = sessionStorage.getItem(SESSION_KEY);
    if (sUid) return sUid;
  }

  // 3. Fallback to localStorage
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

function setCurrentSessionUid(uid) {
  if (uid) {
    setSessionCookie(SESSION_KEY, uid);
    setSessionCookie("mgm_session_uid", uid);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, uid);
    }
  } else {
    deleteCookie(SESSION_KEY);
    deleteCookie("mgm_session_uid");
    deleteCookie("mgm_session_role");
    deleteCookie("mgm_auth_session");
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(SESSION_KEY);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}

// --------------------------------------------------------------------------
// Mock Auth
// --------------------------------------------------------------------------

export const mockAuth = {
  get currentUser() {
    const uid = getCurrentSessionUid();
    if (!uid) return null;
    const store = getStore();
    const user = store.users.find((u) => u.uid === uid);
    return user ? { uid: user.uid, email: user.email } : null;
  }
};

export async function mockSignInWithEmailAndPassword(auth, email, password) {
  const store = getStore();
  const normalizedEmail = email.trim().toLowerCase();

  // Find user by exact email or alias
  let user = store.users.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail
  );

  // If typed admin@mgmcen.ac.in / sanket@mgmcen.ac.in etc., match correctly
  if (!user && (normalizedEmail.startsWith("admin@") || normalizedEmail.startsWith("sanket@"))) {
    user = store.users.find((u) => u.role === "admin");
  }
  if (!user && normalizedEmail.startsWith("faculty@")) {
    user = store.users.find((u) => u.role === "faculty");
  }
  if (!user && normalizedEmail.startsWith("organizer@")) {
    user = store.users.find((u) => u.role === "organizer");
  }

  if (!user) {
    const err = new Error("User not found");
    err.code = "auth/user-not-found";
    throw err;
  }

  // Allow password flexibility in mock mode
  const validPasswords = [user.password, "sanket123", "admin123", "123456"];
  if (user.password && !validPasswords.includes(password)) {
    const err = new Error("Wrong password");
    err.code = "auth/wrong-password";
    throw err;
  }

  setCurrentSessionUid(user.uid);
  notifyAuthListeners(user);
  return { user: { uid: user.uid, email: user.email } };
}

export function mockOnAuthStateChanged(auth, callback) {
  authListeners.add(callback);
  // Asynchronously trigger with current status
  setTimeout(() => {
    callback(mockAuth.currentUser);
  }, 10);
  return () => authListeners.delete(callback);
}

export async function mockSignOut(auth) {
  setCurrentSessionUid(null);
  notifyAuthListeners(null);
}

export async function mockCreateUserWithEmailAndPassword(auth, email, password) {
  const store = getStore();
  const exists = store.users.some(
    (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase()
  );
  if (exists) {
    const err = new Error("Email already in use");
    err.code = "auth/email-already-in-use";
    throw err;
  }
  const uid = "usr_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
  // Note: Secondary auth does NOT change current session
  return { user: { uid, email } };
}

// --------------------------------------------------------------------------
// Mock Firestore
// --------------------------------------------------------------------------

export const mockDb = { name: "MockFirestore" };

export function mockCollection(db, name) {
  return { type: "collection", name };
}

export function mockDoc(db, collectionName, id) {
  return { type: "doc", collection: collectionName, id };
}

export async function mockGetDoc(docRef) {
  const store = getStore();
  const list = store[docRef.collection] || [];
  const item = list.find((x) => x.id === docRef.id || x.uid === docRef.id);
  return {
    exists: () => !!item,
    data: () => (item ? { ...item } : null)
  };
}

export async function mockGetDocs(queryOrCol) {
  const store = getStore();
  const colName = queryOrCol.name || (queryOrCol.col && queryOrCol.col.name);
  let list = [...(store[colName] || [])];

  if (queryOrCol.constraints) {
    for (const c of queryOrCol.constraints) {
      if (c.type === "where") {
        if (c.op === "==") list = list.filter((item) => item[c.field] === c.val);
        if (c.op === "in") list = list.filter((item) => (c.val || []).includes(item[c.field]));
      }
    }
  }

  return {
    empty: list.length === 0,
    docs: list.map((item) => ({
      id: item.id,
      data: () => ({ ...item })
    }))
  };
}

export async function mockAddDoc(colRef, data) {
  const store = getStore();
  const colName = colRef.name;
  if (!store[colName]) store[colName] = [];
  const id = "doc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
  const newItem = { id, ...data };
  store[colName].push(newItem);
  saveStore(store);
  notifyListeners(colName);
  return { id };
}

export async function mockSetDoc(docRef, data) {
  const store = getStore();
  const colName = docRef.collection;
  if (!store[colName]) store[colName] = [];
  const id = docRef.id;
  const idx = store[colName].findIndex((x) => x.id === id || x.uid === id);
  const item = { id, ...data };
  if (idx >= 0) {
    store[colName][idx] = item;
  } else {
    store[colName].push(item);
  }
  saveStore(store);
  notifyListeners(colName);
}

export async function mockUpdateDoc(docRef, updates) {
  const store = getStore();
  const colName = docRef.collection;
  const list = store[colName] || [];
  const item = list.find((x) => x.id === docRef.id || x.uid === docRef.id);
  if (!item) throw new Error("Document not found");
  Object.assign(item, updates);
  saveStore(store);
  notifyListeners(colName);
}

export async function mockDeleteDoc(docRef) {
  const store = getStore();
  const colName = docRef.collection;
  store[colName] = (store[colName] || []).filter((x) => x.id !== docRef.id && x.uid !== docRef.id);
  saveStore(store);
  notifyListeners(colName);
}

export function mockOnSnapshot(queryOrCol, callback, errCallback) {
  const colName = queryOrCol.name || (queryOrCol.col && queryOrCol.col.name);

  function execute() {
    const store = getStore();
    let list = [...(store[colName] || [])];

    if (queryOrCol.constraints) {
      for (const c of queryOrCol.constraints) {
        if (c.type === "where") {
          if (c.op === "==") list = list.filter((item) => item[c.field] === c.val);
          if (c.op === "in") list = list.filter((item) => (c.val || []).includes(item[c.field]));
        } else if (c.type === "orderBy") {
          list.sort((a, b) => {
            const valA = a[c.field];
            const valB = b[c.field];
            const tA = valA && typeof valA.toMillis === "function" ? valA.toMillis() : valA;
            const tB = valB && typeof valB.toMillis === "function" ? valB.toMillis() : valB;
            if (c.dir === "desc") {
              return tA < tB ? 1 : tA > tB ? -1 : 0;
            }
            return tA > tB ? 1 : tA < tB ? -1 : 0;
          });
        }
      }
    }

    try {
      callback({
        docs: list.map((item) => ({
          id: item.id || item.uid,
          data: () => ({ ...item })
        }))
      });
    } catch (e) {
      if (errCallback) errCallback(e);
      else console.error(e);
    }
  }

  // Register listener for future updates
  if (!listeners.has(colName)) {
    listeners.set(colName, new Set());
  }
  const handler = () => execute();
  listeners.get(colName).add(handler);

  // Trigger immediately
  setTimeout(execute, 0);

  // Return unsubscribe
  return () => {
    const set = listeners.get(colName);
    if (set) set.delete(handler);
  };
}

export function mockQuery(col, ...constraints) {
  return { type: "query", col, constraints };
}

export function mockWhere(field, op, val) {
  return { type: "where", field, op, val };
}

export function mockOrderBy(field, dir = "asc") {
  return { type: "orderBy", field, dir };
}

export function mockServerTimestamp() {
  const now = Date.now();
  return {
    toMillis: () => now,
    toDate: () => new Date(now)
  };
}

export async function mockWithSecondaryAuth(action) {
  return await action(mockAuth);
}
