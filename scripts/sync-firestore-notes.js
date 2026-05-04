const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
const postSyncFiles = [
  "data/notes-index.json",
  "data/roadmap-items.json",
  "data/roadmap-levels.json",
  "data/roadmap-level-assignments.json",
  "data/extracted-tasks.json",
  "data/project-states.json",
  "data/milestones.json",
  "data/dashboard-model.json",
  "apps/time-planner/data/notes-index.json",
  "apps/time-planner/data/roadmap-items.json",
  "apps/time-planner/data/roadmap-levels.json",
  "apps/time-planner/data/roadmap-level-assignments.json",
  "apps/time-planner/data/extracted-tasks.json",
  "apps/time-planner/data/project-states.json",
  "apps/time-planner/data/milestones.json",
  "apps/time-planner/data/dashboard-model.json",
];
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;
const shouldCommit = process.argv.includes("--commit");

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

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function runNodeScript(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function runPostSyncProcessing() {
  const steps = [
    {
      label: "Regenerate notes index",
      script: path.join(repoRoot, "scripts", "index-notes.js"),
    },
    {
      label: "Regenerate roadmap items",
      script: path.join(repoRoot, "scripts", "generate-roadmap.js"),
    },
    {
      label: "Regenerate roadmap levels",
      script: path.join(repoRoot, "scripts", "generate-roadmap-levels.js"),
    },
    {
      label: "Assign notes to levels",
      script: path.join(repoRoot, "scripts", "assign-notes-to-levels.js"),
    },
    {
      label: "Extract tasks from notes",
      script: path.join(repoRoot, "scripts", "extract-tasks-from-notes.js"),
    },
    {
      label: "Generate project states",
      script: path.join(repoRoot, "scripts", "generate-project-states.js"),
    },
    {
      label: "Generate milestones",
      script: path.join(repoRoot, "scripts", "generate-milestones.js"),
    },
    {
      label: "Generate dashboard model",
      script: path.join(repoRoot, "scripts", "generate-dashboard-model.js"),
    },
  ];

  for (const step of steps) {
    console.log(`Post-sync: ${step.label}...`);
    const result = runNodeScript(step.script);
    if (!result.ok) {
      console.error(`Post-sync failed: ${step.label}`);
      if (result.stdout) console.error(result.stdout);
      if (result.stderr) console.error(result.stderr);
      process.exitCode = 1;
      return false;
    }
    if (result.stdout) console.log(result.stdout);
  }

  console.log("Post-sync processing complete.");
  return true;
}

function existingPostSyncFiles() {
  return postSyncFiles
    .map((filePath) => path.join(repoRoot, filePath))
    .filter((filePath) => fs.existsSync(filePath));
}

function commitSyncFiles(filesToStage) {
  if (!shouldCommit) {
    console.log("Commit mode disabled. Re-run with --commit to stage and commit written notes.");
    return;
  }

  if (filesToStage.length === 0) {
    console.log("No files written; skipping git add and git commit.");
    return;
  }

  const relativeFiles = [...new Set(filesToStage.map((filePath) =>
    path.relative(repoRoot, filePath).split(path.sep).join("/")
  ))];

  const addResult = runGit(["add", "--", ...relativeFiles]);
  if (!addResult.ok) {
    console.error("git add failed.");
    if (addResult.stderr) console.error(addResult.stderr);
    process.exitCode = 1;
    return;
  }

  console.log("Files staged:");
  relativeFiles.forEach((filePath) => console.log(`- ${filePath}`));

  const diffResult = runGit(["diff", "--cached", "--quiet", "--", ...relativeFiles]);
  if (diffResult.status === 0) {
    console.log("No staged changes detected; skipping empty commit.");
    return;
  }

  if (diffResult.status !== 1) {
    console.error("Unable to inspect staged changes.");
    if (diffResult.stderr) console.error(diffResult.stderr);
    process.exitCode = 1;
    return;
  }

  const commitResult = runGit(["commit", "-m", "Sync notes from Firestore"]);
  if (!commitResult.ok) {
    console.error("git commit failed.");
    if (commitResult.stdout) console.error(commitResult.stdout);
    if (commitResult.stderr) console.error(commitResult.stderr);
    process.exitCode = 1;
    return;
  }

  console.log("Commit result:");
  if (commitResult.stdout) console.log(commitResult.stdout);
  console.log("No push was attempted.");
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
  const createdFiles = [];
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
    createdFiles.push(targetPath);
    console.log(`Wrote ${relativeTarget}`);
  }

  console.log("Files written:");
  if (createdFiles.length === 0) {
    console.log("- none");
  } else {
    createdFiles
      .map((filePath) => path.relative(repoRoot, filePath).split(path.sep).join("/"))
      .forEach((filePath) => console.log(`- ${filePath}`));
  }

  console.log(`Local write complete. ${writtenCount} note(s) written.`);
  if (createdFiles.length === 0) {
    console.log("No files written; skipping post-sync index and roadmap regeneration.");
    return;
  }

  const postSyncOk = runPostSyncProcessing();
  const filesToStage = postSyncOk
    ? [...createdFiles, ...existingPostSyncFiles()]
    : createdFiles;

  commitSyncFiles(filesToStage);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
