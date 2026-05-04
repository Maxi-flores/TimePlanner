# Roadmap Orchestrator Architecture

## Purpose

The Roadmap Orchestrator turns the planner into a local-first dashboard for notes, prompts, projects, features, tasks, milestones, decisions, and sync activity. The first version is static and generated from local files only. Firebase, GitHub automation, and Obsidian integration are planned interfaces, not active credentials or live services.

## Planner UI

`apps/time-planner/index.html` remains the primary static interface. It reads generated JSON from `apps/time-planner/data/` and presents:

- calendar, schedule, goals, and manual milestones from existing local planner state
- notes grouped by project, month, and date from `notes-index.json`
- roadmap organogram, prompt log placeholders, feature/change placeholders, and a priority list from `roadmap-items.json`

The UI must keep working as a plain static page served from the app folder.

## Firebase Intake

Firebase is the future intake layer for notes and prompt submissions from lightweight web forms. The intended shape is:

- anonymous or authenticated submission page
- Firestore document creation for incoming notes, prompts, and sync events
- Cloud Function or scheduled worker to normalize submitted content

No real Firebase credentials should be stored in this repository yet.

## GitHub Notes Commit Sync

The GitHub sync layer will eventually commit approved intake items into `content/notes-2026` or a successor notes directory. It should:

- treat notes in Git as the durable source of truth
- create commits with clear paths and messages
- avoid overwriting manually edited notes
- record every sync attempt as a `syncEvent`

## Generated Notes Index

`scripts/index-notes.js` reads `content/notes-2026` and writes:

- `data/notes-index.json`
- `apps/time-planner/data/notes-index.json`

This index provides normalized source paths, titles, project names, month folders, and detectable dates.

## Roadmap Organogram

`scripts/generate-roadmap.js` reads `data/notes-index.json` and writes:

- `data/roadmap-items.json`
- `apps/time-planner/data/roadmap-items.json`

The organogram groups notes under project entities and gives the planner a static tree that can later be enriched with features, tasks, milestones, decisions, and prompts.

## Priority Engine

The first priority engine is intentionally simple. It scores generated project and task items using local metadata:

- note count
- dated note count
- recency of dated notes
- presence of prompt-like `@` note titles

Future versions can include explicit priority fields, due dates, dependencies, risk, effort, and user-selected focus.

## Obsidian Export / Connector

Obsidian remains the human editing surface for notes. The orchestrator should support:

- generated Markdown exports for dashboards and summaries
- optional `obsidian://` links for local navigation
- a later plugin or connector only after the file-based workflow is stable

The orchestrator should not require long-term browser storage for source data. Generated files and Git history should remain the reliable system of record.
