# Sync Worker Plan

## Purpose

`scripts/sync-firestore-notes.js` is a local Node worker that pulls pending Firebase intake records into the Git-backed notes folder. By default it does not commit, push, or delete content. Commit mode is opt-in with `--commit`.

## Local Service Account Setup

Install the Admin SDK in the monorepo root:

```bash
npm install firebase-admin
```

Create a Firebase service account JSON file from Firebase Console:

1. Open Project settings.
2. Open Service accounts.
3. Generate a new private key.
4. Save it locally outside Git, for example `firebase-service-account.local.json`.

The repo ignores `firebase-service-account*.json` and `service-account*.json`, but keep credentials private anyway.

Point the worker at the service account:

```bash
set FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.local.json
node scripts/sync-firestore-notes.js
```

Optional commit mode:

```powershell
node scripts/sync-firestore-notes.js --commit
```

PowerShell alternative:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_PATH="firebase-service-account.local.json"
node scripts/sync-firestore-notes.js
```

## Firestore Inputs

The worker reads `syncQueue` documents where:

- `status` is `pending`
- `type` is `note.create`
- `noteId` points to a document in `notes`

The related `notes/{noteId}` document should contain:

- `title`
- `content`
- optional `projectName`
- optional `date`
- optional `source`

## Local Write Output

Each note is converted to Markdown and written to:

```text
content/notes-2026/Inbox/<project>/<date-title>.md
```

The worker creates missing folders and avoids overwriting existing files by adding a numeric suffix when needed.

## Queue Status

After a local file is written, the worker updates the queue item:

- `status`: `local-written`
- `fullySynced`: `false`
- `localPath`: written Markdown path
- `localWrittenAt`: server timestamp
- `updatedAt`: server timestamp

This means the content exists locally but has not been committed or pushed yet.

## Git Commit Mode

When run with `--commit`, the worker stages only the Markdown files created during that run and commits them with:

```bash
git commit -m "Sync notes from Firestore"
```

It prevents empty commits and never pushes automatically.

## Safety Rules

- Do not commit service account JSON files.
- Do not auto-commit unless the worker was run with `--commit`.
- Do not push automatically.
- Do not overwrite existing note files.
- Do not delete Firestore documents after local write.
- Treat Git commits as a separate reviewed step.
