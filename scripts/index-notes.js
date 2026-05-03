const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesRoot = path.join(repoRoot, "content", "notes-2026");
const outputPath = path.join(repoRoot, "data", "notes-index.json");

const monthNames = new Set([
  "January",
  "February",
  "March",
  "April",
  "May",
  "Mei",
  "June",
  "Juni",
  "July",
  "Juli",
  "August",
  "September",
  "October",
  "Oktober",
  "November",
  "December",
  "December",
]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function isIgnoredDirectory(name) {
  return name === ".git" || name.startsWith(".git.backup-") || name === "node_modules";
}

function isNoteLikeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const nonNoteExtensions = new Set([".html", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);
  return !nonNoteExtensions.has(ext);
}

function titleFromFileName(fileName) {
  const ext = path.extname(fileName);
  if (ext === ".md" || ext === ".txt") {
    return fileName.slice(0, -ext.length);
  }

  return fileName;
}

function dateFromFileName(fileName) {
  const match = fileName.match(/\b(\d{2})\.(\d{1,2})\.(\d{1,2})\b/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const fullYear = Number(year) + 2000;
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  return [
    String(fullYear).padStart(4, "0"),
    String(monthNumber).padStart(2, "0"),
    String(dayNumber).padStart(2, "0"),
  ].join("-");
}

function walkFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!isIgnoredDirectory(entry.name)) {
        files.push(...walkFiles(fullPath));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildIndex() {
  if (!fs.existsSync(notesRoot)) {
    throw new Error(`Notes root not found: ${notesRoot}`);
  }

  const notes = walkFiles(notesRoot)
    .filter(isNoteLikeFile)
    .map((filePath) => {
      const relativeToNotes = path.relative(notesRoot, filePath);
      const parts = relativeToNotes.split(path.sep);
      const fileName = parts[parts.length - 1];
      const topLevelFolder = parts.length > 1 ? parts[0] : null;
      const isProjectNote = topLevelFolder === "Profound Projects" && parts.length > 2;

      return {
        sourcePath: toPosixPath(path.relative(repoRoot, filePath)),
        title: titleFromFileName(fileName),
        date: dateFromFileName(fileName),
        monthFolder: topLevelFolder && monthNames.has(topLevelFolder) ? topLevelFolder : null,
        projectName: isProjectNote ? parts[1] : null,
      };
    })
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: "content/notes-2026",
    noteCount: notes.length,
    notes,
  };
}

const index = buildIndex();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`Indexed ${index.noteCount} notes into ${toPosixPath(path.relative(repoRoot, outputPath))}`);
