# AI Agent Orchestration Plan

## Current Deterministic Extraction

The current task extraction layer is local and deterministic. `scripts/extract-tasks-from-notes.js` reads indexed note files and looks for action patterns such as:

- `TODO`
- `Task:`
- `Build`
- `Create`
- `Fix`
- `Implement`
- `Add`
- `Decide`
- `Research`
- `Setup`

It does not call external APIs. Extracted items are proposals with confidence scores and are written to `data/extracted-tasks.json` plus the app-readable copy.

## Future AI API Extraction

A later AI extraction layer can replace or enrich the deterministic pass by:

- summarizing note intent
- detecting implicit tasks
- grouping related tasks into features
- identifying blockers and dependencies
- proposing level placement and project status

The AI pass should remain reviewable. It should write proposed structured data, not directly modify source notes.

## Decisions Into Tasks

Decision-like context is detected when nearby text includes terms such as decision, decide, option, tradeoff, because, or risk. Future AI extraction can turn those into:

- decision records
- follow-up validation tasks
- risk flags
- project state summaries

The current deterministic layer stores `decisionContext` when a nearby hint is detectable.

## Summaries And Status

`scripts/generate-project-states.js` creates project summaries from:

- note count
- recent dated notes
- extracted task count and categories
- roadmap level assignment
- risk flags

The planner uses this to show current status, next suggested actions, active categories, and last activity.

## Obsidian And GitHub Note Flow

The intended flow is:

```text
Firestore intake -> local Markdown -> Git commit -> generated index -> roadmap board -> Obsidian export
```

Git-backed notes stay the durable source of truth. Obsidian can consume the Markdown notes and future generated exports, while GitHub keeps history and review around sync changes.
