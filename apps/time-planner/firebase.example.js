// firebase.example.js — committed, placeholder-only template.
// Copy this file to firebase.js and replace the placeholder values with your
// project's config. firebase.js is gitignored and must never be committed.
//
// The browser app uses ES module imports from gstatic CDN so no bundler is
// required.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

function isPlaceholderConfig(config) {
  return Object.values(config || {}).some(v => typeof v === "string" && v.startsWith("YOUR_"));
}

let app = null;
let db = null;
let auth = null;
let googleProvider = null;

if (!isPlaceholderConfig(firebaseConfig)) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export const firebaseReady = !!app;

// ─── Note intake (existing) ─────────────────────────────────────────────
export async function submitNoteIntake(note) {
  if (!db) throw new Error("Firebase not configured.");
  const now = serverTimestamp();
  const noteRef = await addDoc(collection(db, "notes"), {
    ...note,
    source: "time-planner",
    status: "submitted",
    createdAt: now,
    updatedAt: now
  });
  const syncRef = await addDoc(collection(db, "syncQueue"), {
    type: "note.create",
    status: "pending",
    noteId: noteRef.id,
    projectName: note.projectName || null,
    title: note.title,
    createdAt: now,
    updatedAt: now
  });
  return { noteId: noteRef.id, syncQueueId: syncRef.id };
}

export async function submitSyncQueueAction(actionPayload) {
  if (!db) throw new Error("Firebase not configured.");
  const now = serverTimestamp();
  const syncRef = await addDoc(collection(db, "syncQueue"), {
    type: `${actionPayload.type || "task"}.create`,
    payload: actionPayload,
    status: "pending",
    createdAt: now,
    updatedAt: now
  });
  return { syncQueueId: syncRef.id };
}

// ─── Auth ───────────────────────────────────────────────────────────────
function projectAuthUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || (user.isAnonymous ? "Guest" : ""),
    photoURL: user.photoURL || "",
    email: user.email || "",
    isAnonymous: !!user.isAnonymous
  };
}

export async function signInWithGoogle() {
  if (!auth || !googleProvider) throw new Error("Firebase auth not configured.");
  const result = await signInWithPopup(auth, googleProvider);
  return projectAuthUser(result.user);
}

export async function signInAnonymous() {
  if (!auth) throw new Error("Firebase auth not configured.");
  const result = await signInAnonymously(auth);
  return projectAuthUser(result.user);
}

export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, user => callback(projectAuthUser(user)));
}

export function getCurrentAuthUser() {
  return auth ? projectAuthUser(auth.currentUser) : null;
}

// ─── Planner state document ────────────────────────────────────────────
const PLANNER_STATE_PATH = uid => ["users", uid, "plannerState", "main"];

export async function loadPlannerState(uid) {
  if (!db) throw new Error("Firebase not configured.");
  if (!uid) throw new Error("loadPlannerState requires a uid.");
  const snap = await getDoc(doc(db, ...PLANNER_STATE_PATH(uid)));
  return snap.exists() ? snap.data() : null;
}

export async function savePlannerState(uid, payload) {
  if (!db) throw new Error("Firebase not configured.");
  if (!uid) throw new Error("savePlannerState requires a uid.");
  const ref = doc(db, ...PLANNER_STATE_PATH(uid));
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── Real-time planner state subscription ─────────────────────────────
// Calls callback(data, null) on every update, callback(null, err) on error.
// Returns an unsubscribe function.
export function subscribePlannerState(uid, callback) {
  if (!db) throw new Error("Firebase not configured.");
  if (!uid) throw new Error("subscribePlannerState requires a uid.");
  const ref = doc(db, ...PLANNER_STATE_PATH(uid));
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? snap.data() : null, null),
    (err) => callback(null, err)
  );
}

export { db, auth };
