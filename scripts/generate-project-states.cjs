const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesIndexPath = path.join(repoRoot, "data", "notes-index.json");
const tasksPath = path.join(repoRoot, "data", "extracted-tasks.json");
const assignmentsPath = path.join(repoRoot, "data", "roadmap-level-assignments.json");
const levelsPath = path.join(repoRoot, "data", "roadmap-levels.json");
const outputPath = path.join(repoRoot, "data", "project-states.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "project-states.json");

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

const notesIndex = readJson(notesIndexPath, { notes: [] });
const extracted = readJson(tasksPath, { tasks: [] });
const assignmentData = readJson(assignmentsPath, { assignments: [] });
const levelData = readJson(levelsPath, { levels: [] });
const levelById = new Map((levelData.levels || []).map(level => [level.id, level]));

const projects = [...new Set((notesIndex.notes || []).map(note => note.projectName).filter(Boolean))].sort();

function recentNotes(projectName) {
  return (notesIndex.notes || [])
    .filter(note => note.projectName === projectName)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 4);
}

function assignedLevels(projectName) {
  const projectSlug = `project-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
  return (assignmentData.assignments || [])
    .filter(assignment => (assignment.projectIds || []).includes(projectSlug))
    .map(assignment => levelById.get(assignment.levelId)?.title || assignment.levelId);
}

function riskFlags(notes, tasks) {
  const flags = [];
  if (!notes.some(note => note.date)) flags.push("No dated notes");
  if (tasks.length > 8) flags.push("High task volume");
  if (tasks.filter(task => task.confidence < 0.65).length > 3) flags.push("Many low-confidence tasks");
  return flags;
}

const states = projects.map(projectName => {
  const notes = recentNotes(projectName);
  const allNotes = (notesIndex.notes || []).filter(note => note.projectName === projectName);
  const tasks = (extracted.tasks || []).filter(task => task.projectName === projectName);
  const categories = [...new Set(tasks.map(task => task.category))].sort();
  const levels = assignedLevels(projectName);
  const lastActivity = allNotes.map(note => note.date).filter(Boolean).sort().at(-1) || null;
  const nextSuggestedActions = tasks.slice(0, 4).map(task => task.title);

  return {
    projectName,
    summary: `${projectName} has ${allNotes.length} indexed notes, ${tasks.length} proposed tasks, and appears in ${levels.length} roadmap level(s).`,
    currentStatus: levels.includes("Project Sorting") || levels.includes("Prompt Lab") ? "active classification" : tasks.length ? "task discovery" : "indexed",
    nextSuggestedActions,
    activeCategories: categories,
    riskFlags: riskFlags(allNotes, tasks),
    lastActivity,
    recentNotes: notes.map(note => ({ title: note.title, date: note.date, sourcePath: note.sourcePath })),
    roadmapLevels: levels,
  };
});

const output = `${JSON.stringify({ generatedAt: new Date().toISOString(), projectCount: states.length, projects: states }, null, 2)}\n`;
for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, "utf8");
}

console.log(`Generated ${states.length} project state summaries.`);
console.log("Wrote data/project-states.json");
console.log("Copied app-readable project states to apps/time-planner/data/project-states.json");
