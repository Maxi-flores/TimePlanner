# Roadmap Level Map

## Concept

The roadmap level map is a campaign-style visual layer for the planner. Instead of showing only linear lists, it presents roadmap progress as connected level nodes. Each level represents a tier of orchestration maturity, from intake through release/export.

Level states:

- `completed`: already handled or stable
- `active`: current focus
- `unlocked`: available next
- `locked`: future stage

## Manual Classification

The generated file `data/roadmap-levels.json` provides a safe static starting point. In the planner UI, each level has tag boxes for:

- projects
- notes
- prompts
- features
- tasks

Manual assignments are saved in browser `localStorage` under `roadmapLevelAssignments`. They do not write back to JSON files and do not modify source notes.

The generated level map is displayed in the Roadmap tab as a vertical and diagonal campaign path. Clicking any level opens a detail panel with tag boxes and assignment controls.

## Generated Inputs

The level map uses:

- `data/notes-index.json`
- `data/roadmap-items.json`
- `data/roadmap-levels.json`

Regenerate with:

```bash
node scripts/index-notes.js
node scripts/generate-roadmap.js
node scripts/generate-roadmap-levels.js
```

## Future Firebase Persistence

The local assignment model can later move into Firestore, likely as:

- `roadmapLevels`
- `roadmapLevelAssignments`
- `syncEvents`

Firestore should store user classification and state changes, while generated JSON remains a reproducible local baseline.

## Future Obsidian Export

The level map can export Markdown summaries for Obsidian:

- one overview file for the full campaign path
- one file per level with assigned projects, notes, prompts, features, and tasks
- optional `obsidian://` links back to source notes

The first export should stay file-based before adding any Obsidian plugin behavior.
