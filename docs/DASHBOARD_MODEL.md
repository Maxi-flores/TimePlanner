# Dashboard Model

`scripts/generate-dashboard-model.js` builds the shared static data model for the planner dashboard.

## Inputs

- `data/notes-index.json`
- `data/roadmap-items.json`
- `data/roadmap-levels.json`
- `data/roadmap-level-assignments.json`
- `data/extracted-tasks.json`
- `data/project-states.json`
- `data/milestones.json`

## Outputs

- `data/dashboard-model.json`
- `apps/time-planner/data/dashboard-model.json`

## Model Contents

The model includes:

- `projects`
- `notes`
- `tasks`
- `milestones`
- `levels`
- `levelAssignments`
- `timeline`
- `categories`
- `priorityList`
- `settingsDefaults`

The browser still keeps user-selected filters and theme preferences in `localStorage`; source notes remain unchanged.
