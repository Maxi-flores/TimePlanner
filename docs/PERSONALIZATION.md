# Personalization

The planner stores local interface preferences in `localStorage`.

## Settings

The settings panel controls:

- six style presets: Powerframe, Light, Aurora, Solar, Forest, and Mono
- gradient color 1
- gradient color 2
- accent color
- border glow color, blur, opacity, and speed
- orb background size, opacity, and enable/disable
- compact mode
- reduced motion
- local user account fields: name, role/profile, and profile note

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
- `--glow-color`
- `--glow-blur`
- `--glow-opacity`
- `--glow-speed`
- `--orb-size`
- `--orb-opacity`

## Scope

Personalization affects only the local browser. It does not write to source notes, generated JSON, Firebase, or Git.
