# AI Assistant UI

The planner now keeps AI work in one dedicated local-first assistant layer instead of scattering controls across tabs.

## Dedicated AI Tab

The `AI` tab shows provider status, selected project context, deterministic prompt ideas, suggested tasks, decision extraction prompts, and project summary prompts. It reads `apps/time-planner/data/ai-suggestions.json`, which is generated from `data/dashboard-model.json`.

## Deploy Readiness

The Deploy tab checks the local runtime state before AI work:

- AI enabled in localStorage settings
- endpoint configured
- `dashboard-model.json` loaded
- selected project context available
- optional Ollama health check via `Test AI Connection`

The app never calls Ollama automatically. It only attempts a local request when the user clicks a test/action button.

## Bot Overlay

A floating `AI` button is available from every tab. The overlay stores open/closed state and selected assistant project in `localStorage` under `aiBotState`.

Quick actions include:

- Roadmap next step
- Extract tasks
- Summarize project
- Find blockers
- Generate Obsidian note

## Deterministic Fallback

`scripts/generate-ai-suggestions.js` creates deterministic suggestions per project:

- `actionPrompts`
- `nextActions`
- `blockers`
- `summaryPrompt`
- `obsidianNotePrompt`

If Ollama is disabled, missing, or unreachable, the UI falls back to these generated suggestions.

## Future Ollama/Qwen Worker

The current browser placeholder is intentionally safe. Future work should move richer model calls into a local worker that reads `dashboard-model.json`, selected project context, and user-approved settings. Suggestions should be returned as proposed tasks or prompts first. Source notes must never be modified directly.
