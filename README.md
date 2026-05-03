# TimePlanner Monorepo

This repository is being organized as a small monorepo for the static time planner app and the 2026 notes archive that will later feed it.

## Structure

- `apps/time-planner` contains the existing static planner webpage.
- `content/notes-2026` contains the 2026 notes, project notes, prompt history, and related archived content.
- `docs` contains repository-level planning notes.

The short-term goal is to keep the app and notes cleanly separated. The longer-term goal is to let the planner read structured note data, publish a hosted planning webpage, and keep useful updates available to Obsidian without treating app code and personal notes as the same project.

## Deployment

The root `vercel.json` points Vercel at `apps/time-planner/index.html` so the moved static app can still deploy from the monorepo root.

## Notes Index

Generate the local notes index with:

```bash
node scripts/index-notes.js
```

The script reads note-like text files from `content/notes-2026` and writes `data/notes-index.json`. It does not modify note files. The index is intended as the first bridge for the planner app to display notes by month, exact date, and project.
