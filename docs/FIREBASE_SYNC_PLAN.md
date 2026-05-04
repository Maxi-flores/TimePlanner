# Firebase Sync Plan

## Firestore Collections

Planned collections:

- `intakeNotes`: submitted note drafts waiting for validation.
- `prompts`: prompt submissions, model/context metadata, and result pointers.
- `projects`: lightweight project records used by the dashboard.
- `features`: proposed or accepted feature/change records.
- `tasks`: actionable items derived from prompts, notes, or user input.
- `milestones`: dated roadmap markers.
- `decisions`: durable architecture/product decisions.
- `syncEvents`: append-only records of intake, normalization, GitHub commit attempts, exports, and failures.

## Submit-Note Web Template

The submit-note template should be a minimal web form that writes to Firebase intake, not directly to Git:

- title
- body
- project
- optional date
- optional tags
- source/context

The client should use public Firebase app configuration only. Secrets and service account credentials belong in server-side functions or scheduled jobs, never in the static planner.

## Scheduled Sync To GitHub

A scheduled worker should:

1. Read pending `intakeNotes` and `prompts`.
2. Normalize paths, filenames, and frontmatter.
3. Open a GitHub commit or pull request against the notes repository.
4. Mark processed documents with commit metadata.
5. Write a `syncEvent` for every success, skip, or failure.

The worker must avoid overwriting note files that changed after intake. Conflicts should become review events, not silent replacements.

## No Long-Term Local Storage Rule

The browser may cache UI preferences and temporary planner state, but it should not be the long-term source of truth for notes, prompts, roadmap items, or sync history.

Durable data should live in:

- Git-backed note files
- generated JSON artifacts
- Firebase documents for intake and sync status
- exported Markdown for Obsidian review
