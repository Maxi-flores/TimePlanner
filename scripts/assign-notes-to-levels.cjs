const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesIndexPath = path.join(repoRoot, "data", "notes-index.json");
const roadmapPath = path.join(repoRoot, "data", "roadmap-items.json");
const levelsPath = path.join(repoRoot, "data", "roadmap-levels.json");
const outputPath = path.join(repoRoot, "data", "roadmap-level-assignments.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "roadmap-level-assignments.json");

const keywordTierHints = [
  { pattern: /intake|inbox|capture|submit|sync/i, tier: 1 },
  { pattern: /sort|classif|project|organ/i, tier: 2 },
  { pattern: /prompt|agent|ai/i, tier: 3 },
  { pattern: /feature|change|build|create|implement/i, tier: 4 },
  { pattern: /task|fix|setup|todo/i, tier: 5 },
  { pattern: /milestone|deadline|checkpoint/i, tier: 6 },
  { pattern: /release|publish|deploy|export|obsidian|github/i, tier: 7 },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addUnique(target, key, value) {
  if (!value) return;
  if (!target[key]) target[key] = [];
  if (!target[key].includes(value)) target[key].push(value);
}

function scoreLevel(note, level, projectIdSetByLevel) {
  let score = 0;
  const title = note.title || "";
  const source = note.sourcePath || "";
  const projectId = note.projectName ? `project-${note.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}` : null;

  if (projectId && projectIdSetByLevel.get(level.id)?.has(projectId)) score += 50;
  if ((level.notePaths || []).includes(source)) score += 60;
  if (note.date && level.tier <= 3) score += 5;
  if (note.date && note.date >= "2026-05-01" && level.tier <= 2) score += 8;

  for (const hint of keywordTierHints) {
    if (hint.pattern.test(title) || hint.pattern.test(source)) {
      score += Math.max(0, 18 - Math.abs(level.tier - hint.tier) * 6);
    }
  }

  return score;
}

function buildAssignments(notesIndex, roadmap, levelData) {
  const levels = levelData.levels || [];
  const projects = roadmap.entities?.project || [];
  const prompts = roadmap.entities?.prompt || [];
  const features = roadmap.entities?.feature || [];
  const tasks = roadmap.entities?.task || [];
  const projectIdSetByLevel = new Map(levels.map(level => [level.id, new Set(level.projectIds || [])]));
  const assignments = {};

  for (const level of levels) {
    assignments[level.id] = {
      levelId: level.id,
      projectIds: [...(level.projectIds || [])],
      notePaths: [],
      promptIds: [...(level.promptIds || [])],
      featureIds: [...(level.featureIds || [])],
      taskIds: [...(level.taskIds || [])],
      tags: [...(level.tags || []), "auto-assigned"],
      reasons: [],
    };
  }

  for (const note of notesIndex.notes || []) {
    const scored = levels
      .map(level => ({ level, score: scoreLevel(note, level, projectIdSetByLevel) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score <= 0) continue;

    const target = assignments[best.level.id];
    addUnique(target, "notePaths", note.sourcePath);
    if (note.projectName) {
      const project = projects.find(item => item.name === note.projectName);
      addUnique(target, "projectIds", project?.id);
    }
    target.reasons.push({
      sourcePath: note.sourcePath,
      score: best.score,
      reason: note.projectName ? `matched project ${note.projectName}` : "matched title/date/path hints",
    });
  }

  for (const prompt of prompts) {
    const level = levels.find(item => (item.promptIds || []).includes(prompt.id)) || levels[2];
    addUnique(assignments[level.id], "promptIds", prompt.id);
  }

  for (const feature of features) {
    const level = levels.find(item => (item.featureIds || []).includes(feature.id)) || levels[3];
    addUnique(assignments[level.id], "featureIds", feature.id);
  }

  for (const task of tasks) {
    const level = levels.find(item => (item.taskIds || []).includes(task.id)) || levels[4];
    addUnique(assignments[level.id], "taskIds", task.id);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      notesIndexPath: "data/notes-index.json",
      roadmapItemsPath: "data/roadmap-items.json",
      roadmapLevelsPath: "data/roadmap-levels.json",
    },
    assignments: Object.values(assignments),
  };
}

for (const required of [notesIndexPath, roadmapPath, levelsPath]) {
  if (!fs.existsSync(required)) throw new Error(`Missing ${path.relative(repoRoot, required)}`);
}

const output = `${JSON.stringify(buildAssignments(readJson(notesIndexPath), readJson(roadmapPath), readJson(levelsPath)), null, 2)}\n`;
for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, "utf8");
}

console.log("Generated roadmap level assignments.");
console.log("Wrote data/roadmap-level-assignments.json");
console.log("Copied app-readable assignments to apps/time-planner/data/roadmap-level-assignments.json");
