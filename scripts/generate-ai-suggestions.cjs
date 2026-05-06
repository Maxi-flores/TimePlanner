const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const modelPath = path.join(repoRoot, "data", "dashboard-model.json");
const outputPath = path.join(repoRoot, "data", "ai-suggestions.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "ai-suggestions.json");

function readJson(filePath, fallback) {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : fallback;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function projectSuggestions(project, model) {
  const projectName = project.projectName || "General";
  const notes = (model.notes || []).filter(note => (note.projectName || "General") === projectName);
  const tasks = (model.tasks || []).filter(task => (task.projectName || "General") === projectName);
  const milestones = (model.milestones || []).filter(milestone => (milestone.projectName || "General") === projectName);
  const levels = (model.levels || []).filter(level =>
    (level.projectIds || []).some(id => String(id).toLowerCase().includes(projectName.toLowerCase())) ||
    (level.tags || []).some(tag => String(tag).toLowerCase().includes(projectName.toLowerCase()))
  );
  const categories = uniq([
    ...(project.activeCategories || []),
    ...tasks.map(task => task.category),
  ]);
  const recentNotes = notes
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 3);
  const risks = project.riskFlags || [];
  const milestoneSuggestions = milestones.length
    ? milestones.slice(0, 3).map(milestone => `Review milestone "${milestone.title}" and confirm next deployable task.`)
    : [
        `Create first milestone for ${projectName} from the newest notes.`,
        `Link ${projectName} milestone to one visible task and one calendar deployment.`,
      ];
  const dependencyHints = [
    notes.length ? "Notes index is available for context." : "Needs indexed notes before deep planning.",
    tasks.length ? "Extracted tasks are available for prioritization." : "Needs task extraction before sequencing.",
    milestones.length ? "Milestones can be used as planning checkpoints." : "Needs generated milestones.",
  ];
  const priorityRecalculationInput = {
    noteCount: notes.length,
    taskCount: tasks.length,
    milestoneCount: milestones.length,
    riskCount: risks.length,
    recentActivity: project.lastActivity || null,
    categories,
  };

  return {
    projectName,
    generatedAt: new Date().toISOString(),
    status: project.currentStatus || "needs review",
    context: {
      noteCount: notes.length,
      taskCount: tasks.length,
      milestoneCount: milestones.length,
      levelCount: levels.length,
      categories,
      lastActivity: project.lastActivity || null,
    },
    actionPrompts: [
      `Review ${projectName} and turn the latest notes into a now/next/later execution plan.`,
      `Compare ${projectName} milestones against active tasks and suggest the next deployable slice.`,
      `Identify decisions in ${projectName} notes that should become tracked tasks before scheduling.`,
      recentNotes.length
        ? `Use recent notes (${recentNotes.map(note => note.title).join("; ")}) as the planning context for ${projectName}.`
        : `Create a planning prompt for ${projectName} from available project summary and tasks.`,
    ],
    nextActions: (project.nextSuggestedActions || []).length
      ? project.nextSuggestedActions
      : [
          tasks[0]?.title ? `Start with: ${tasks[0].title}` : "Choose one concrete setup task and assign it to the next calendar slot.",
          milestones[0]?.title ? `Validate milestone: ${milestones[0].title}` : "Create a milestone from the strongest current project direction.",
          "Run a blocker pass before adding new scope.",
        ],
    blockers: risks.length
      ? risks
      : [
          notes.length ? "Source notes need classification into decisions, tasks, and milestones." : "Project has little indexed note context.",
          tasks.length ? "Tasks are proposed and need owner/status confirmation." : "No extracted tasks found yet.",
        ],
    summaryPrompt: `Summarize ${projectName} using ${notes.length} notes, ${tasks.length} tasks, ${milestones.length} milestones, and current status "${project.currentStatus || "unknown"}". Return project state, next three actions, and blockers.`,
    obsidianNotePrompt: `Create an Obsidian-ready project note for ${projectName} with sections: Status, Decisions, Next Actions, Blockers, Linked Notes, and Calendar Deployment.`,
    decisionPrompt: `Extract explicit and implied decisions for ${projectName}. Output each as a proposed task first, never edit source notes directly.`,
    milestoneSuggestions,
    dependencyHints,
    priorityRecalculationInput,
  };
}

const model = readJson(modelPath, { projects: [], notes: [], tasks: [], milestones: [], levels: [] });
const projectNames = uniq([
  ...(model.projects || []).map(project => project.projectName),
  ...(model.notes || []).map(note => note.projectName || "General"),
  ...(model.tasks || []).map(task => task.projectName || "General"),
]);

const projectMap = new Map((model.projects || []).map(project => [project.projectName, project]));
const projects = projectNames.map(projectName =>
  projectSuggestions(projectMap.get(projectName) || { projectName }, model)
);

const output = {
  generatedAt: new Date().toISOString(),
  source: "data/dashboard-model.json",
  mode: "deterministic-local",
  projects,
  global: {
    actionPrompts: [
      "Pick a focused project before asking the assistant to sequence work.",
      "Regenerate dashboard-model.json after note sync, then refresh AI suggestions.",
      "Use the Deploy tab checks before running local Ollama/Qwen actions.",
    ],
    nextActions: [
      "Select a project.",
      "Review AI readiness.",
      "Generate prompt ideas or suggested tasks.",
    ],
  },
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serialized, "utf8");
}

console.log(`Generated AI suggestions for ${projects.length} projects.`);
console.log("Wrote data/ai-suggestions.json");
console.log("Copied app-readable suggestions to apps/time-planner/data/ai-suggestions.json");
