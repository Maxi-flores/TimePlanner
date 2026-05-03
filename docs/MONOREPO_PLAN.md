# Monorepo Plan

## Goal

Keep the static planner app and the 2026 notes archive in one workspace while preserving a clean boundary between code, content, and future sync tooling.

## Current Layout

- `apps/time-planner`: the existing static time planner app.
- `content/notes-2026`: the notes repository with monthly notes, project notes, prompt history, and related files.
- `docs`: monorepo-level documentation.

## Future Sync Flow

1. Notes repo
   - Notes remain the source of truth for daily planning, monthly notes, project notes, and prompt history.
   - Future structure can add frontmatter or lightweight metadata to identify dates, projects, tasks, status, and links.

2. Planner app
   - The app reads normalized structured data derived from `content/notes-2026`.
   - A future parser can convert selected Markdown notes into JSON that the planner can load without coupling the UI directly to raw note files.

3. Hosted webpage
   - Vercel deploys the planner from `apps/time-planner`.
   - Generated note data can be published with the app when it is safe and intended for the webpage.

4. Obsidian
   - Obsidian keeps editing the notes directly.
   - Any generated summaries, planner snapshots, or backlinks should be written in a predictable format so Obsidian can index them cleanly.

## Near-Term Steps

- Preserve all existing note files in `content/notes-2026`.
- Keep app-specific files inside `apps/time-planner`.
- Introduce structured note metadata only when the planner parser needs it.
- Avoid deleting nested repository metadata until there is an explicit migration plan for Git history.
