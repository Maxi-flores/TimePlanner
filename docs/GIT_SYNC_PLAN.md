# Git Sync Plan

## Current Flow

The local Firestore sync worker has two modes:

- Dry/local-write mode: `node scripts/sync-firestore-notes.js`
- Commit mode: `node scripts/sync-firestore-notes.js --commit`

Both modes read pending Firestore `syncQueue` items, fetch related `notes` documents, write Markdown files to `content/notes-2026/Inbox/<project>/`, and mark queue items as `local-written`.

## Local Write To Commit

With `--commit`, the worker stages only the Markdown files created during that run:

```bash
git add -- <created files>
git commit -m "Sync notes from Firestore"
```

The worker skips Git automation when no files are written and also checks for staged changes before committing, preventing empty commits.

## Manual Push For Now

The worker does not push automatically. After reviewing the generated notes and commit, push manually:

```bash
git push
```

Manual push keeps the first implementation safe while Firestore intake, local Markdown generation, and queue status updates are still being validated.

## Future Automation

Later versions can move push automation into:

- CI after a reviewed local commit
- a GitHub Actions workflow triggered by a signed event
- a Cloud Function or scheduled worker with a narrow GitHub token

Future automation should still preserve these rules:

- do not commit service account files or Firebase web config
- do not overwrite note files silently
- do not mark a queue item as fully synced until the commit or push target is confirmed
- write sync results back to Firestore as append-only sync events
