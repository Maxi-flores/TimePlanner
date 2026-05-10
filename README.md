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

For the static planner, the same generated index is copied to `apps/time-planner/data/notes-index.json`, where `apps/time-planner/index.html` can load it with a relative `data/notes-index.json` request.

The deployed static app can also refresh these generated JSON exports from a remote base URL (for example `raw.githubusercontent.com/.../apps/time-planner/data/`) via the Notes tab. The fetched exports are cached in `localStorage` so the planner can fall back when local `data/*.json` files are missing.

Generate the roadmap orchestration data after regenerating the notes index:

```bash
node scripts/index-notes.js
node scripts/generate-roadmap.js
node scripts/generate-roadmap-levels.js
node scripts/assign-notes-to-levels.js
node scripts/extract-tasks-from-notes.js
node scripts/generate-project-states.js
node scripts/generate-milestones.js
node scripts/generate-dashboard-model.js
node scripts/generate-ai-suggestions.js
node scripts/validate-config.js
```

The generators read `data/notes-index.json` and produce roadmap items, level-map assignments, extracted tasks, project states, milestones, the unified dashboard model, and deterministic AI suggestions used by the dedicated AI assistant tab.

You can also run the full generation command with:

```bash
npm run generate
npm run validate
```

Sync worker commands:

```bash
npm run sync
npm run sync:commit
```

Test the static app locally from the app folder:

```bash
cd apps/time-planner
python -m http.server 4173
```

Then open `http://localhost:4173`.

From the monorepo root:

```bash
npm run serve
```
