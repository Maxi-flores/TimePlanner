const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesIndexPath = path.join(repoRoot, "data", "notes-index.json");
const outputPath = path.join(repoRoot, "data", "extracted-tasks.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "extracted-tasks.json");

const taskPattern = /\b(TODO|Task:|Build|Create|Fix|Implement|Add|Decide|Research|Setup)\b[:\-\s]?(.*)/i;
const categories = [
  { name: "design", pattern: /design|ui|ux|visual|layout|style|screen/i },
  { name: "setup", pattern: /setup|install|config|firebase|vercel|env|account/i },
  { name: "development", pattern: /build|create|fix|implement|add|code|script|app|feature/i },
  { name: "3D", pattern: /\b3d\b|three|unity|model|render|mesh/i },
  { name: "AI", pattern: /\bai\b|agent|prompt|model|llm|extract/i },
  { name: "content", pattern: /note|markdown|obsidian|copy|text|content|doc/i },
  { name: "admin", pattern: /mail|call|document|finance|insurance|apk|submit|print|schedule/i },
];

function slug(value) {
  return String(value || "task").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "task";
}

function classify(text) {
  return categories.find(category => category.pattern.test(text))?.name || "development";
}

function confidenceFor(line, note) {
  let score = 0.55;
  if (/TODO|Task:/i.test(line)) score += 0.22;
  if (/Build|Create|Fix|Implement|Add|Decide|Research|Setup/i.test(line)) score += 0.12;
  if (note.projectName) score += 0.06;
  if (note.title.includes("@")) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
}

function decisionContext(lines, index) {
  const windowText = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join(" ");
  const match = windowText.match(/\b(decide|decision|because|option|tradeoff|risk)\b[^.]{0,140}/i);
  return match ? match[0].trim() : null;
}

function createdFrom(note) {
  return note.title.includes("@") || /prompt/i.test(note.sourcePath) ? "prompt" : "note";
}

function extractFromNote(note) {
  const absolutePath = path.join(repoRoot, note.sourcePath);
  if (!fs.existsSync(absolutePath)) return [];

  const text = fs.readFileSync(absolutePath, "utf8");
  const lines = text.split(/\r?\n/);
  const tasks = [];

  lines.forEach((line, index) => {
    const trimmed = line.replace(/^[-*>\d.)\s]+/, "").trim();
    if (!trimmed) return;
    const match = trimmed.match(taskPattern);
    if (!match) return;

    const title = (match[2] || trimmed).trim().replace(/^[:\-\s]+/, "") || trimmed;
    const category = classify(`${title} ${note.title} ${note.sourcePath}`);
    tasks.push({
      id: `task-${slug(note.sourcePath)}-${index + 1}`,
      title,
      sourcePath: note.sourcePath,
      projectName: note.projectName,
      category,
      status: "proposed",
      confidence: confidenceFor(trimmed, note),
      createdFrom: createdFrom(note),
      decisionContext: decisionContext(lines, index),
    });
  });

  return tasks;
}

if (!fs.existsSync(notesIndexPath)) throw new Error("Missing data/notes-index.json");
const notesIndex = JSON.parse(fs.readFileSync(notesIndexPath, "utf8"));
const tasks = (notesIndex.notes || []).flatMap(extractFromNote);
const output = `${JSON.stringify({ generatedAt: new Date().toISOString(), taskCount: tasks.length, tasks }, null, 2)}\n`;

for (const target of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output, "utf8");
}

console.log(`Extracted ${tasks.length} proposed tasks.`);
console.log("Wrote data/extracted-tasks.json");
console.log("Copied app-readable tasks to apps/time-planner/data/extracted-tasks.json");
