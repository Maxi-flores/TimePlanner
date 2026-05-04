const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const notesIndexPath = path.join(repoRoot, "data", "notes-index.json");
const outputPath = path.join(repoRoot, "data", "roadmap-items.json");
const appOutputPath = path.join(repoRoot, "apps", "time-planner", "data", "roadmap-items.json");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

function priorityForProject(notes) {
  const datedNotes = notes.filter(note => note.date);
  const promptLike = notes.filter(note => note.title.includes("@"));
  const newestDate = datedNotes.map(note => note.date).sort().at(-1);
  const recencyBoost = newestDate ? Math.max(0, 30 - Math.min(30, daysSince(newestDate))) : 0;
  return notes.length * 4 + datedNotes.length * 6 + promptLike.length * 3 + recencyBoost;
}

function priorityForTask(note) {
  const recencyBoost = note.date ? Math.max(0, 14 - Math.min(14, daysSince(note.date))) : 0;
  return 20 + recencyBoost + (note.title.includes("@") ? 5 : 0);
}

function buildRoadmap(notesIndex) {
  const notes = notesIndex.notes || [];
  const noteEntities = notes.map((note, index) => {
    const id = `note-${slug(note.sourcePath)}-${index + 1}`;
    return {
      id,
      title: note.title,
      projectId: note.projectName ? `project-${slug(note.projectName)}` : null,
      sourcePath: note.sourcePath,
      date: note.date,
      status: "indexed",
      metadata: {
        monthFolder: note.monthFolder,
        projectName: note.projectName
      }
    };
  });

  const noteIdByPath = new Map(noteEntities.map(note => [note.sourcePath, note.id]));
  const projectsByName = new Map();
  for (const note of notes.filter(item => item.projectName)) {
    if (!projectsByName.has(note.projectName)) projectsByName.set(note.projectName, []);
    projectsByName.get(note.projectName).push(note);
  }

  const projects = [...projectsByName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, projectNotes]) => {
      const datedNotes = projectNotes.filter(note => note.date);
      return {
        id: `project-${slug(name)}`,
        name,
        title: name,
        noteIds: projectNotes.map(note => noteIdByPath.get(note.sourcePath)),
        priorityScore: priorityForProject(projectNotes),
        status: "active",
        metadata: {
          noteCount: projectNotes.length,
          datedNoteCount: datedNotes.length,
          latestDate: datedNotes.map(note => note.date).sort().at(-1) || null
        }
      };
    });

  const tasks = notes
    .filter(note => note.projectName && note.date)
    .map(note => ({
      id: `task-review-${slug(note.projectName)}-${slug(note.title)}`,
      title: `Review ${note.projectName} note ${note.title}`,
      projectId: `project-${slug(note.projectName)}`,
      noteId: noteIdByPath.get(note.sourcePath),
      sourcePath: note.sourcePath,
      date: note.date,
      status: "candidate",
      priorityScore: priorityForTask(note),
      metadata: { derivedFrom: "dated project note" }
    }));

  const prompts = notes
    .filter(note => note.title.includes("@"))
    .map(note => ({
      id: `prompt-${slug(note.sourcePath)}`,
      title: `Prompt session ${note.title}`,
      projectId: note.projectName ? `project-${slug(note.projectName)}` : null,
      noteId: noteIdByPath.get(note.sourcePath),
      sourcePath: note.sourcePath,
      date: note.date,
      status: "placeholder",
      priorityScore: 10,
      metadata: { derivedFrom: "prompt-like filename marker" }
    }));

  const features = projects.slice(0, 8).map(project => ({
    id: `feature-${slug(project.name)}-roadmap-intake`,
    title: `${project.name} roadmap intake`,
    projectId: project.id,
    noteId: null,
    sourcePath: null,
    date: project.metadata.latestDate,
    status: "placeholder",
    priorityScore: Math.round(project.priorityScore / 2),
    metadata: { derivedFrom: "project note cluster" }
  }));

  const milestones = projects
    .filter(project => project.metadata.latestDate)
    .map(project => ({
      id: `milestone-${slug(project.name)}-${project.metadata.latestDate}`,
      title: `${project.name} latest dated checkpoint`,
      projectId: project.id,
      noteId: null,
      sourcePath: null,
      date: project.metadata.latestDate,
      status: "indexed",
      priorityScore: Math.round(project.priorityScore / 1.5),
      metadata: { derivedFrom: "latest dated project note" }
    }));

  const decisions = notes
    .filter(note => /architecture|decision|plan/i.test(note.title) || /Architecture\.md$/i.test(note.sourcePath))
    .map(note => ({
      id: `decision-${slug(note.sourcePath)}`,
      title: `Review decision signal: ${note.title}`,
      projectId: note.projectName ? `project-${slug(note.projectName)}` : null,
      noteId: noteIdByPath.get(note.sourcePath),
      sourcePath: note.sourcePath,
      date: note.date,
      status: "candidate",
      priorityScore: 12,
      metadata: { derivedFrom: "decision-like title/path" }
    }));

  const syncEvents = [{
    id: `sync-${new Date().toISOString().slice(0, 10)}`,
    title: "Generated roadmap items from notes index",
    projectId: null,
    noteId: null,
    sourcePath: "data/notes-index.json",
    date: new Date().toISOString().slice(0, 10),
    status: "generated",
    priorityScore: 0,
    metadata: {
      noteCount: notes.length,
      projectCount: projects.length
    }
  }];

  const priorityList = [
    ...projects.map(project => ({
      id: project.id,
      entityType: "project",
      title: project.name,
      score: project.priorityScore,
      reason: `${project.metadata.noteCount} notes, ${project.metadata.datedNoteCount} dated`
    })),
    ...tasks.map(task => ({
      id: task.id,
      entityType: "task",
      title: task.title,
      score: task.priorityScore,
      reason: task.date ? `dated ${task.date}` : "candidate task"
    }))
  ].sort((a, b) => b.score - a.score).slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      notesIndexPath: "data/notes-index.json",
      noteCount: notes.length
    },
    entities: {
      project: projects,
      prompt: prompts,
      note: noteEntities,
      feature: features,
      task: tasks,
      milestone: milestones,
      decision: decisions,
      syncEvent: syncEvents
    },
    priorityList
  };
}

if (!fs.existsSync(notesIndexPath)) {
  throw new Error("Missing data/notes-index.json. Run node scripts/index-notes.js first.");
}

const notesIndex = JSON.parse(fs.readFileSync(notesIndexPath, "utf8"));
const roadmap = buildRoadmap(notesIndex);
const output = `${JSON.stringify(roadmap, null, 2)}\n`;

for (const targetPath of [outputPath, appOutputPath]) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, output, "utf8");
}

console.log(`Generated ${roadmap.entities.project.length} projects and ${roadmap.priorityList.length} priority items.`);
console.log(`Wrote ${toPosixPath(path.relative(repoRoot, outputPath))}`);
console.log(`Copied app-readable roadmap to ${toPosixPath(path.relative(repoRoot, appOutputPath))}`);
