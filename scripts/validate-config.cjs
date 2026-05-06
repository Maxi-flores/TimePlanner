const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

const requiredFiles = [
  "config/app.config.json",
  "config/prompt-logic.config.json",
  "apps/time-planner/data/dashboard-model.json",
];

const requiredFolders = [
  "config",
  "apps/time-planner",
  "apps/time-planner/data",
  "content/notes-2026",
  "data",
  "docs",
  "scripts",
];

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function gitTracked(relPath) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  return result.status === 0;
}

function validateAppConfig(errors) {
  const config = readJson("config/app.config.json");
  const expected = {
    appName: "Time Planner",
    appMode: "local-first",
    dataSource: "apps/time-planner/data/dashboard-model.json",
    notesSource: "content/notes-2026",
    firebaseEnabled: false,
    aiEnabled: false,
    aiProvider: "ollama",
    aiModel: "qwen",
    aiEndpoint: "http://localhost:11434",
    syncMode: "manual",
    obsidianMode: "export-ready",
  };

  for (const [key, value] of Object.entries(expected)) {
    if (config[key] !== value) {
      errors.push(`config/app.config.json ${key} expected ${JSON.stringify(value)} but found ${JSON.stringify(config[key])}`);
    }
  }

  if (!exists(config.dataSource)) {
    errors.push(`Configured dataSource is missing: ${config.dataSource}`);
  }
  if (!exists(config.notesSource)) {
    errors.push(`Configured notesSource is missing: ${config.notesSource}`);
  }
}

function validatePromptLogic(errors) {
  const config = readJson("config/prompt-logic.config.json");
  const categories = [
    "roadmap",
    "milestone",
    "taskExtraction",
    "projectSummary",
    "decisionTracking",
    "obsidianExport",
    "firebaseSync",
  ];

  for (const category of categories) {
    const item = config[category];
    if (!item) {
      errors.push(`Missing prompt logic category: ${category}`);
      continue;
    }
    for (const field of ["purpose", "inputs", "outputs", "rules", "safetyLimits"]) {
      if (!item[field] || (Array.isArray(item[field]) && item[field].length === 0)) {
        errors.push(`prompt-logic ${category}.${field} is required`);
      }
    }
  }
}

function main() {
  const errors = [];

  for (const filePath of requiredFiles) {
    if (!exists(filePath)) errors.push(`Missing required file: ${filePath}`);
  }

  for (const folderPath of requiredFolders) {
    const fullPath = path.join(repoRoot, folderPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      errors.push(`Missing required folder: ${folderPath}`);
    }
  }

  if (exists("config/app.config.json")) validateAppConfig(errors);
  if (exists("config/prompt-logic.config.json")) validatePromptLogic(errors);

  if (gitTracked("apps/time-planner/firebase.js")) {
    errors.push("apps/time-planner/firebase.js is tracked; real Firebase config must not be committed.");
  }

  if (!exists("content/notes-2026")) {
    errors.push("Source notes folder is missing: content/notes-2026");
  }

  if (errors.length) {
    console.error("Configuration validation failed:");
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log("Configuration validation passed.");
  console.log("Checked app config, prompt logic config, dashboard model, required folders, Firebase tracking, and source notes folder.");
}

main();
