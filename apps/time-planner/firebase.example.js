import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function submitNoteIntake(note) {
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

  return {
    noteId: noteRef.id,
    syncQueueId: syncRef.id
  };
}

export { db };
