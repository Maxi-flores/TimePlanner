# Personalization

The planner stores local interface preferences in `localStorage`.

## Settings

The settings panel controls:

- gradient color 1
- gradient color 2
- accent color
- compact mode
- reduced motion

Settings are applied through CSS variables:

- `--bg`
- `--surface`
- `--surface-glass`
- `--accent`
- `--accent-2`
- `--text`
- `--muted`
- `--radius-xl`
- `--shadow-soft`

## Scope

Personalization affects only the local browser. It does not write to source notes, generated JSON, Firebase, or Git.
