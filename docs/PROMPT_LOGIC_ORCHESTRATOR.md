# Prompt Logic Orchestrator

## Purpose

The future AI agent acts as a local project orchestration assistant. It reads generated dashboard context, local user filters, and prompt-logic configuration, then proposes planning improvements.

It should not directly mutate source notes.

## Operating Loop

1. Read selected project context from `dashboardFilters.project`.
2. Load `apps/time-planner/data/dashboard-model.json`.
3. Scope notes, tasks, milestones, levels, project summaries, and timeline entries to the selected project.
4. Read `config/prompt-logic.config.json` for category-specific rules.
5. Extract decisions and open questions from notes/prompts.
6. Suggest next actions as proposed tasks first.
7. Suggest summary/status updates as proposals.
8. Wait for user review before anything becomes committed or synced.

## Inputs

- selected project filter
- notes index records
- extracted tasks
- generated milestones
- roadmap levels and assignments
- project state summaries
- local settings and user profile preferences
- prompt-logic config categories

## Outputs

The AI agent should output:

- proposed tasks
- decision candidates
- next action suggestions
- risk flags
- project summary update proposals
- milestone sequencing suggestions
- Obsidian export suggestions

## Decision Extraction

The agent should separate:

- confirmed decisions
- likely decisions
- open questions
- blocked decisions
- follow-up tasks

Every decision candidate should include source context such as `sourcePath`, project name, and the relevant note/task/milestone IDs when available.

## Safety Rules

- Never modify source notes directly.
- Never delete user-authored content.
- Never commit or push automatically.
- Never expose Firebase config or service account files.
- Never call external APIs from the static app.
- Keep Ollama/Qwen local and opt-in.
- Output proposed tasks before changing roadmap state.

## Ollama/Qwen Use

When enabled later, a local worker can call:

```text
http://localhost:11434
```

with model:

```text
qwen
```

The worker should send only scoped planning context, not the entire notes archive unless the user explicitly requests broad analysis.

## Review Flow

Recommended human review sequence:

1. AI proposes tasks.
2. User approves, edits, or rejects tasks.
3. Approved tasks can become local goals/tasks or generated roadmap proposals.
4. Exports and syncs happen only through explicit scripts.
