# Obsidian Connector Plan

## Phase 1: Markdown Export

Generate Markdown files from `data/roadmap-items.json` for Obsidian to index. The first export should include:

- project overview
- priority list
- prompt log
- feature/change log
- sync event summary

This phase requires no Obsidian API and should be fully file-based.

## Phase 2: Obsidian Links

Add optional `obsidian://` links once vault path conventions are stable. The planner can show links for:

- source notes
- project dashboards
- exported roadmap summaries

Links should be generated from known vault-relative paths and remain optional so the hosted planner still works without Obsidian installed.

## Phase 3: Optional Obsidian Plugin

An Obsidian plugin can come later if file exports and links are not enough. Possible plugin responsibilities:

- show orchestrator status inside Obsidian
- trigger local index generation
- preview incoming Firebase/GitHub sync events
- insert accepted notes into the vault

The plugin should be optional. The core workflow should keep working through plain Markdown files and generated JSON.
