# Final Configuration

## Static Data Loading

The planner stays static and vanilla JavaScript. `apps/time-planner/index.html` loads generated JSON from:

```text
apps/time-planner/data/dashboard-model.json
```

The canonical runtime settings live in:

```text
config/app.config.json
config/prompt-logic.config.json
```

These config files describe how the local app should behave. They do not contain credentials.

## Refreshing Generated JSON

Run the full generation pipeline from the monorepo root:

```bash
node scripts/index-notes.js
node scripts/generate-roadmap.js
node scripts/generate-roadmap-levels.js
node scripts/assign-notes-to-levels.js
node scripts/extract-tasks-from-notes.js
node scripts/generate-project-states.js
node scripts/generate-milestones.js
node scripts/generate-dashboard-model.js
node scripts/validate-config.js
```

The generated app-readable JSON is copied into `apps/time-planner/data/`.

## localStorage And dashboard-model.json

`dashboard-model.json` contains generated project, note, task, milestone, level, timeline, category, priority, and settings default data.

`localStorage` stores local user state:

- calendar events
- schedule blocks
- local goals
- local milestones
- selected project and filters
- theme settings
- optional user profile display
- manual roadmap level assignments

The app combines both at runtime. Generated JSON is reproducible; localStorage is user/browser-specific.

## Firebase Intake Later

Firebase is disabled by default:

```json
"firebaseEnabled": false
```

To enable local intake later:

1. Copy `apps/time-planner/firebase.example.js` to `apps/time-planner/firebase.js`.
2. Add local Firebase web config.
3. Enable Firestore.
4. Create collections: `notes`, `prompts`, `tasks`, `syncQueue`.
5. Keep `firebase.js` ignored.

The sync worker can write Firestore notes into `content/notes-2026/Inbox` and regenerate JSON. It does not push automatically.

## Ollama/Qwen Later

AI is disabled by default:

```json
"aiEnabled": false,
"aiProvider": "ollama",
"aiModel": "qwen",
"aiEndpoint": "http://localhost:11434"
```

Future AI work should use a local worker that reads selected project context from `dashboard-model.json` and local settings, then calls Ollama locally. The static browser app should not directly depend on external APIs.

## Obsidian Export

Obsidian mode is:

```json
"obsidianMode": "export-ready"
```

Export should generate markdown from dashboard data and localStorage state into a separate export location first. Source notes under `content/notes-2026` must remain untouched unless a dedicated sync worker writes to an Inbox path.

## Never Commit

Do not commit:

- `apps/time-planner/firebase.js`
- Firebase service account JSON
- `.env*`
- `.vercel`
- `node_modules`
- real credentials or API keys
- generated local secrets

Do not modify source notes as part of configuration validation.
