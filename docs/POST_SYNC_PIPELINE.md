# Post-Sync Pipeline

## Flow

The local sync worker now follows this pipeline:

```text
Firestore -> Markdown -> Index -> Roadmap -> Level Map -> Assignments -> Tasks -> Project States -> Commit
```

## 1. Firestore

`scripts/sync-firestore-notes.js` reads pending Firestore `syncQueue` items with:

- `status: pending`
- `type: note.create`

Each queue item points to a `notes/{noteId}` document.

## 2. Markdown

The worker converts each note document into Markdown and writes it to:

```text
content/notes-2026/Inbox/<project>/<date-title>.md
```

Existing files are never overwritten. If a path already exists, the worker adds a numeric suffix.

## 3. Index

If at least one Markdown file was written, the worker runs:

```bash
node scripts/index-notes.js
```

This updates:

- `data/notes-index.json`
- `apps/time-planner/data/notes-index.json`

## 4. Roadmap

After the index is regenerated, the worker runs:

```bash
node scripts/generate-roadmap.js
```

This updates:

- `data/roadmap-items.json`
- `apps/time-planner/data/roadmap-items.json`

## 5. Level Map

After roadmap items are regenerated, the worker runs:

```bash
node scripts/generate-roadmap-levels.js
```

This updates:

- `data/roadmap-levels.json`
- `apps/time-planner/data/roadmap-levels.json`

## 6. Assignments, Tasks, And Project States

The worker then runs:

```bash
node scripts/assign-notes-to-levels.js
node scripts/extract-tasks-from-notes.js
node scripts/generate-project-states.js
```

This updates:

- `data/roadmap-level-assignments.json`
- `data/extracted-tasks.json`
- `data/project-states.json`
- matching files in `apps/time-planner/data/`

## 7. Commit

By default, the worker does not commit:

```bash
node scripts/sync-firestore-notes.js
```

Commit mode is explicit:

```bash
node scripts/sync-firestore-notes.js --commit
```

With `--commit`, the worker creates one commit containing the newly written Markdown notes plus regenerated index and roadmap files:

- `content/notes-2026/Inbox/...`
- `data/notes-index.json`
- `data/roadmap-items.json`
- `data/roadmap-levels.json`
- `data/roadmap-level-assignments.json`
- `data/extracted-tasks.json`
- `data/project-states.json`
- `apps/time-planner/data/notes-index.json`
- `apps/time-planner/data/roadmap-items.json`
- `apps/time-planner/data/roadmap-levels.json`
- `apps/time-planner/data/roadmap-level-assignments.json`
- `apps/time-planner/data/extracted-tasks.json`
- `apps/time-planner/data/project-states.json`

The worker prevents empty commits and does not push automatically.

## Safety

- Post-sync generation runs only when at least one note file was written.
- There is only one optional commit per worker run.
- Push remains manual for now.
- Queue items are marked `local-written`, not fully synced.
