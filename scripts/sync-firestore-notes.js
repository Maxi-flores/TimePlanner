const fs = require("node:fs");
const path = require("node:path");

let admin;
try {
  admin = require("firebase-admin");
} catch (err) {
  console.error("Missing dependency: firebase-admin");
  console.error("Install it locally with: npm install firebase-admin");
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const notesRoot = path.join(repoRoot, "content", "notes-2026");
const inboxRoot = path.join(notesRoot, "Inbox");
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

function initFirebase() {
  if (admin.apps.length) return;

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

function slug(value, fallback = "untitled") {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || fallback;
}

function readableProject(value) {
  return String(value || "General").trim() || "General";
}

function dateString(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function frontmatterValue(value) {
  if (value === null || value === undefined || value === "") return "null";
  return JSON.stringify(value);
}

function noteToMarkdown(note, queueId, noteId) {
  const title = note.title || "Untitled note";
  const content = note.content || note.body || "";
  const projectName = note.projectName || note.project || null;
  const date = dateString(note.date || note.createdAt);

  return [
    "---",
    `title: ${frontmatterValue(title)}`,
    `project: ${frontmatterValue(projectName)}`,
    `date: ${frontmatterValue(date)}`,
    `firebaseNoteId: ${frontmatterValue(noteId)}`,
    `syncQueueId: ${frontmatterValue(queueId)}`,
    `syncStatus: "local-written"`,
    `source: ${frontmatterValue(note.source || "firebase-intake")}`,
    "---",
    "",
    `# ${title}`,
    "",
    content.trim(),
    "",
  ].join("\n");
}

function nextAvailablePath(basePath) {
  if (!fs.existsSync(basePath)) return basePath;

  const parsed = path.parse(basePath);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Unable to find available filename for ${basePath}`);
}

async function main() {
  initFirebase();
  const db = admin.firestore();

  const snapshot = await db
    .collection("syncQueue")
    .where("status", "==", "pending")
    .where("type", "==", "note.create")
    .limit(25)
    .get();

  if (snapshot.empty) {
    console.log("No pending note.create syncQueue items found.");
    return;
  }

  fs.mkdirSync(inboxRoot, { recursive: true });

  let writtenCount = 0;
  for (const queueDoc of snapshot.docs) {
    const queue = queueDoc.data();
    const noteId = queue.noteId;

    if (!noteId) {
      await queueDoc.ref.update({
        status: "local-write-error",
        error: "Missing noteId on syncQueue item",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      continue;
    }

    const noteRef = db.collection("notes").doc(noteId);
    const noteSnap = await noteRef.get();
    if (!noteSnap.exists) {
      await queueDoc.ref.update({
        status: "local-write-error",
        error: `Missing notes/${noteId}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      continue;
    }

    const note = noteSnap.data();
    const projectName = readableProject(note.projectName || note.project || queue.projectName);
    const date = dateString(note.date || note.createdAt || queue.createdAt);
    const title = note.title || queue.title || "Untitled note";
    const projectDir = path.join(inboxRoot, slug(projectName, "General"));
    const filename = `${date}-${slug(title)}.md`;
    const targetPath = nextAvailablePath(path.join(projectDir, filename));
    const relativeTarget = path.relative(repoRoot, targetPath).split(path.sep).join("/");

    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(targetPath, noteToMarkdown(note, queueDoc.id, noteId), "utf8");

    await queueDoc.ref.update({
      status: "local-written",
      localPath: relativeTarget,
      fullySynced: false,
      localWrittenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    writtenCount += 1;
    console.log(`Wrote ${relativeTarget}`);
  }

  console.log(`Local write complete. ${writtenCount} note(s) written. No Git commit was created.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
