# Time Planner Architecture

## Current Shape

The planner is now a static, local-first dashboard inside the monorepo:

- `apps/time-planner/index.html` is the browser app.
- `apps/time-planner/data/*.json` is the app-readable generated data layer.
- `apps/time-planner/img/` contains deploy-safe logo and favicon assets.
- `content/notes-2026` remains the untouched note source.
- root `scripts/*.js` generate indexes, roadmap data, milestones, project states, and the unified dashboard model.

The app is still vanilla HTML, CSS, and JavaScript. It does not require a frontend build step.

## Primary Views

- Dashboard: front overview with project-filtered roadmap, calendar, goals, notes, deployment, milestones, and timeline widgets.
- Calendar: local events plus auto-created entries from goals and task deployments.
- Schedule: local daily time blocks.
- Roadmap: generated level map, project summaries, milestones, priorities, and manual localStorage level assignments.
- Notes: selectable project/folder/category/date/search browser over the generated notes index.
- Goals: local goals and tasks that can create calendar and roadmap context.
- Calculator: local time/progress helpers.
- Deploy: static deployment status, model/version date, data counts, and AI orchestrator readiness.

## Data Model

The browser combines two local data sources:

- `localStorage` for user-created planner state and preferences.
- `data/dashboard-model.json` for generated notes, roadmap, tasks, milestones, timeline, categories, and default settings.

Important localStorage keys:

- `2026-planner-v1`: events, blocks, milestones, and goals.
- `dashboardFilters`: selected project, note filters, and category focus.
- `dashboardSettings`: theme, orb/glow controls, optional user profile display, avatar path, and AI settings.
- `roadmapLevelAssignments`: manual level assignments from the browser UI.

## Generated Pipeline

Run from the monorepo root:

```bash
node scripts/index-notes.js
node scripts/generate-roadmap.js
node scripts/generate-roadmap-levels.js
node scripts/assign-notes-to-levels.js
node scripts/extract-tasks-from-notes.js
node scripts/generate-project-states.js
node scripts/generate-milestones.js
node scripts/generate-dashboard-model.js
```

The final dashboard model is copied to:

- `data/dashboard-model.json`
- `apps/time-planner/data/dashboard-model.json`

## Navigation And Settings

The header has separate controls:

- Menu: navigation only.
- Settings: theme, account/profile, and local AI settings.

User profile display is optional. When enabled, the header shows the configured avatar and name. The avatar can be a local app path such as `img/symbol_logo_small.png` or a URL.

Footer navigation mirrors the common app actions:

- Menu
- Settings
- Contact
- FAQ

## Visual System

The app uses CSS design tokens:

- `--bg`
- `--surface`
- `--surface-glass`
- `--accent`
- `--accent-2`
- `--text`
- `--muted`
- `--radius-xl`
- `--shadow-soft`

Theme settings also control:

- glow color, blur, opacity, and speed
- orb size and opacity
- orb background on/off
- compact mode
- reduced motion

The moving glow is kept away from dashboard widgets. Ambient movement is allowed in the background and selected larger surfaces.

## AI Orchestrator Scaffold

The Deploy page and Settings AI tab prepare for a local Ollama/Qwen worker:

- provider: `Ollama`
- model: `qwen`
- endpoint: `http://localhost:11434`
- enable flag stored in localStorage

No model calls happen in the browser yet. Current suggestions are deterministic summaries based on selected project, notes, tasks, and milestones. A future local worker can read `dashboard-model.json` plus local settings and send scoped planning context to Ollama.

## Firebase And Sync

Firebase browser intake remains local-only:

- `firebase.example.js` is safe to commit.
- `firebase.js` is ignored and must contain local credentials only.

The sync worker writes Firestore notes into `content/notes-2026/Inbox`, regenerates the static JSON pipeline, and can optionally create one local git commit with `--commit`. It does not push automatically.

## Deployment

The app is served as a static site from `apps/time-planner`.

For local testing:

```bash
cd apps/time-planner
python -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Safety Rules

- Source notes under `content/notes-2026` are not modified by the browser app.
- Real Firebase config is not committed.
- AI integration is local-first and disabled until explicitly enabled.
- Generated data can be regenerated from scripts.

**Last updated:** 2026-05-04
