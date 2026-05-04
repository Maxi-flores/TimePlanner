# Firebase Local Setup

This repository does not commit real Firebase config. The planner can submit local intake records only after you create a private ignored config file.

## Setup

1. Copy the example config:

   ```bash
   copy apps\time-planner\firebase.example.js apps\time-planner\firebase.js
   ```

2. Paste your Firebase web config into `apps/time-planner/firebase.js`.

3. In Firebase Console, enable Firestore for the project.

4. Create these collections, either manually or by submitting test records:

   - `notes`
   - `prompts`
   - `tasks`
   - `syncQueue`

## Local Test

Regenerate local data first:

```bash
node scripts/index-notes.js
node scripts/generate-roadmap.js
```

Serve the app from its folder:

```bash
cd apps/time-planner
python -m http.server 4173
```

Open `http://localhost:4173`, go to the Notes tab, and use Submit Note. If `firebase.js` is missing or invalid, the form remains local-only and shows an unavailable status.

## Safety Rule

`apps/time-planner/firebase.js` is ignored by Git. Do not commit real Firebase API config or service account credentials. Server-side secrets belong outside the static app.
