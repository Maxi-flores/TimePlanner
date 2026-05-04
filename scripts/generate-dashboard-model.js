const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const files = {
  notes: "data/notes-index.json",
  roadmap: "data/roadmap-items.json",
  levels: "data/roadmap-levels.json",
  assignments: "data/roadmap-level-assignments.json",
  tasks: "data/extracted-tasks.json",
  states: "data/project-states.json",
  milestones: "data/milestones.json",
};
const outputPath = path.join(repoRoot, "data", "dashboard-model.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "dashboard-model.json");

function readJson(relPath, fallback) {
  const filePath = path.join(repoRoot, relPath);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

const notesIndex = readJson(files.notes, { notes: [] });
const roadmap = readJson(files.roadmap, { entities: {}, priorityList: [] });
const levels = readJson(files.levels, { levels: [] });
const assignments = readJson(files.assignments, { assignments: [] });
const tasks = readJson(files.tasks, { tasks: [] });
const states = readJson(files.states, { projects: [] });
const milestones = readJson(files.milestones, { milestones: [] });

const projects = (states.projects || []).map(state => ({
  projectName: state.projectName,
  summary: state.summary,
  currentStatus: state.currentStatus,
  lastActivity: state.lastActivity,
  activeCategories: state.activeCategories || [],
  riskFlags: state.riskFlags || [],
  nextSuggestedActions: state.nextSuggestedActions || [],
  noteCount: (notesIndex.notes || []).filter(note => note.projectName === state.projectName).length,
  taskCount: (tasks.tasks || []).filter(task => task.projectName === state.projectName).length,
}));

const categories = [...new Set((tasks.tasks || []).map(task => task.category).filter(Boolean))].sort();
const timeline = (notesIndex.notes || [])
  .filter(note => note.date)
  .map(note => ({
    date: note.date,
    projectName: note.projectName || "General",
    title: note.title,
    type: note.title.includes("@") ? "prompt" : "note",
    sourcePath: note.sourcePath,
  }))
  .sort((a, b) => b.date.localeCompare(a.date));

const model = {
  generatedAt: new Date().toISOString(),
  sourceFiles: files,
  projects,
  notes: notesIndex.notes || [],
  tasks: tasks.tasks || [],
  milestones: milestones.milestones || [],
  levels: levels.levels || [],
  levelAssignments: assignments.assignments || [],
  timeline,
  categories,
  priorityList: roadmap.priorityList || [],
  settingsDefaults: {
    gradient1: "#111827",
    gradient2: "#312e81",
    accent: "#38bdf8",
    compactMode: false,
    reducedMotion: false,
  },
};

const output = `${JSON.stringify(model, null, 2)}\n`;
for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, "utf8");
}

console.log(`Generated dashboard model with ${projects.length} projects, ${model.notes.length} notes, ${model.tasks.length} tasks.`);
console.log("Wrote data/dashboard-model.json");
console.log("Copied app-readable model to apps/time-planner/data/dashboard-model.json");
