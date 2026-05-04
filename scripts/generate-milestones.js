const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesRoot = path.join(repoRoot, "content", "notes-2026");
const projectRoot = path.join(notesRoot, "Profound Projects");
const notesIndexPath = path.join(repoRoot, "data", "notes-index.json");
const tasksPath = path.join(repoRoot, "data", "extracted-tasks.json");
const statesPath = path.join(repoRoot, "data", "project-states.json");
const outputPath = path.join(repoRoot, "data", "milestones.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "milestones.json");

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

function slug(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function dateRange(notes) {
  const dates = notes.map(note => note.date).filter(Boolean).sort();
  return { start: dates[0] || null, end: dates.at(-1) || null };
}

const notesIndex = readJson(notesIndexPath, { notes: [] });
const extracted = readJson(tasksPath, { tasks: [] });
const states = readJson(statesPath, { projects: [] });
const projectFolders = fs.existsSync(projectRoot)
  ? fs.readdirSync(projectRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  : [];

const milestones = projectFolders.sort((a, b) => a.localeCompare(b)).map(projectName => {
  const projectNotes = (notesIndex.notes || []).filter(note => note.projectName === projectName);
  const projectTasks = (extracted.tasks || []).filter(task => task.projectName === projectName);
  const state = (states.projects || []).find(item => item.projectName === projectName);
  const range = dateRange(projectNotes);
  const categories = [...new Set(projectTasks.map(task => task.category))].sort();

  return {
    id: `milestone-${slug(projectName)}-${range.end || "undated"}`,
    title: `${projectName} roadmap checkpoint`,
    projectName,
    sourceFolder: `content/notes-2026/Profound Projects/${projectName}`,
    status: range.end ? "active" : "needs-date",
    dateRange: range,
    linkedNotes: projectNotes.map(note => note.sourcePath),
    linkedTasks: projectTasks.slice(0, 12).map(task => task.id),
    suggestedNextActions: state?.nextSuggestedActions?.length
      ? state.nextSuggestedActions.slice(0, 5)
      : categories.map(category => `Review ${category} tasks`).slice(0, 4),
  };
});

const output = `${JSON.stringify({ generatedAt: new Date().toISOString(), milestoneCount: milestones.length, milestones }, null, 2)}\n`;
for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, "utf8");
}

console.log(`Generated ${milestones.length} milestones.`);
console.log("Wrote data/milestones.json");
console.log("Copied app-readable milestones to apps/time-planner/data/milestones.json");
