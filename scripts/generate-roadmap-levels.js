const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const roadmapPath = path.join(repoRoot, "data", "roadmap-items.json");
const outputPath = path.join(repoRoot, "data", "roadmap-levels.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "roadmap-levels.json");

const positions = [
  { x: 18, y: 8 },
  { x: 62, y: 21 },
  { x: 34, y: 35 },
  { x: 76, y: 49 },
  { x: 25, y: 64 },
  { x: 58, y: 78 },
  { x: 42, y: 92 },
];

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function buildLevels(roadmap) {
  const projects = roadmap.entities?.project || [];
  const notes = roadmap.entities?.note || [];
  const prompts = roadmap.entities?.prompt || [];
  const features = roadmap.entities?.feature || [];
  const tasks = roadmap.entities?.task || [];
  const notesById = new Map(notes.map((note) => [note.id, note]));

  const rankedProjects = projects
    .slice()
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const tiers = [
    { id: "level-01", title: "Intake Gate", status: "completed", description: "Capture incoming notes and preserve source context." },
    { id: "level-02", title: "Project Sorting", status: "active", description: "Classify indexed notes into project lanes and working buckets." },
    { id: "level-03", title: "Prompt Lab", status: "unlocked", description: "Connect prompt sessions to projects, notes, and requested changes." },
    { id: "level-04", title: "Feature Forge", status: "unlocked", description: "Turn recurring notes and prompts into feature candidates." },
    { id: "level-05", title: "Task Trail", status: "locked", description: "Break feature candidates into concrete tasks and review loops." },
    { id: "level-06", title: "Milestone Ridge", status: "locked", description: "Promote stable task clusters into dated milestones." },
    { id: "level-07", title: "Release Summit", status: "locked", description: "Prepare reviewed roadmap slices for sync, export, and publishing." },
  ];

  return tiers.map((tier, index) => {
    const tierProjects = rankedProjects.slice(index * 2, index * 2 + 2);
    const projectIds = tierProjects.map((project) => project.id);
    const notePaths = tierProjects
      .flatMap((project) => project.noteIds || [])
      .map((noteId) => notesById.get(noteId)?.sourcePath)
      .filter(Boolean)
      .slice(0, 8);

    return {
      id: tier.id,
      title: tier.title,
      tier: index + 1,
      status: tier.status,
      projectIds,
      notePaths,
      promptIds: prompts.slice(index, index + 2).map((prompt) => prompt.id),
      featureIds: features.slice(index, index + 2).map((feature) => feature.id),
      taskIds: tasks.slice(index * 3, index * 3 + 4).map((task) => task.id),
      tags: [
        `tier-${index + 1}`,
        tier.status,
        ...tierProjects.map((project) => slug(project.name)),
      ],
      description: tier.description,
      position: positions[index],
    };
  });
}

if (!fs.existsSync(roadmapPath)) {
  throw new Error("Missing data/roadmap-items.json. Run node scripts/generate-roadmap.js first.");
}

const roadmap = JSON.parse(fs.readFileSync(roadmapPath, "utf8"));
const levels = {
  generatedAt: new Date().toISOString(),
  source: {
    roadmapItemsPath: "data/roadmap-items.json",
  },
  levels: buildLevels(roadmap),
};
const output = `${JSON.stringify(levels, null, 2)}\n`;

for (const targetPath of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, output, "utf8");
}

console.log(`Generated ${levels.levels.length} roadmap levels.`);
console.log("Wrote data/roadmap-levels.json");
console.log("Copied app-readable levels to apps/time-planner/data/roadmap-levels.json");
