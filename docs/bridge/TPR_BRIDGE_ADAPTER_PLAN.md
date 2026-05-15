# TPR Bridge Adapter Plan

Powerframe-TPR is the first external repository planning adapter for the TheRocketTree-App V2 bridge contract matrix. This phase is documentation and local fixture generation only.

## Scope

This adapter plan covers local mapping from generated TPR planning output into a BridgeEventRequest-shaped fixture.

This phase does not:

- connect to the TheRocketTree API
- post runtime events
- change Firebase configuration, rules, or sync behavior
- refactor the time-planner app
- assign semantic meaning to planning signals inside TPR

## Source Outputs

The current generated planning outputs are:

- `data/roadmap-items.json`: generated roadmap entities from the notes index, including projects, features, tasks, milestones, prompts, and priority items.
- `data/milestones.json`: generated project roadmap checkpoints built by `scripts/generate-milestones.cjs`.
- `data/project-states.json`: generated project planning state, including status, activity, categories, risk flags, and suggested next actions.
- `data/dashboard-model.json`: unified static dashboard model that combines notes, roadmap items, tasks, milestones, levels, assignments, project states, timeline entries, categories, and priority list.
- `apps/time-planner/data/*.json`: app-readable copies of the same generated data layer.

## Bridge Mapping

The TPR source object for `ExternalToolEvent` should be one generated milestone entry from `data/milestones.json`.

Selected source type:

```text
data/milestones.json -> milestones[] -> milestone
```

Reasoning:

- `milestones[]` entries are already checkpoint-shaped planning objects.
- Each milestone has a stable `id`, human title, `projectName`, `sourceFolder`, `status`, `dateRange`, linked notes, linked tasks, and suggested actions.
- `dateRange.end` is the cleanest local completion-time candidate when the milestone status is `active`.
- The object is generated from local planning artifacts and does not require runtime posting or remote API access.

Bridge constants:

- `toolId`: `tpr`
- `eventName`: `milestone.completed`
- `featureKey`: `unity.recognition.feedback`
- `fixture`: `none`

## Field Mapping

| Bridge field | TPR source |
| --- | --- |
| `event.eventId` | Deterministic fixture id derived from the milestone id. |
| `event.toolId` | Constant: `tpr`. |
| `event.eventName` | Constant: `milestone.completed`. |
| `event.summary.summaryId` | Deterministic fixture summary id derived from the milestone id. |
| `event.summary.toolId` | Constant: `tpr`. |
| `event.summary.title` | `milestone.title`. |
| `event.summary.meaning` | Neutral planning statement from milestone status, project name, linked notes, and linked tasks. |
| `event.summary.occurredAt` | `milestone.dateRange.end` when present, converted to ISO 8601. |
| `event.summary.sourceRef` | `milestone.sourceFolder`. |
| `event.summary.labels` | `tpr`, `milestone`, milestone status, project name slug, and selected dashboard state labels. |
| `event.occurredAt` | Same timestamp as `summary.occurredAt`. |
| `event.details.systemState.primaryValue` | Count of linked notes for the milestone. |
| `event.details.systemState.secondaryValue` | Count of linked tasks for the milestone. |
| `event.details.systemState.systemLoad` | Normalized task pressure from dashboard metrics. |
| `event.details.systemState.progress` | `1` for a completed bridge fixture. |
| `event.details.systemState.iteration` | Count of dated notes or a fixture iteration value. |
| `event.details.systemState.timestamp` | Unix timestamp in milliseconds for `occurredAt`. |
| `featureGate.gateId` | Deterministic fixture gate id derived from feature key and milestone id. |
| `featureGate.featureKey` | Constant: `unity.recognition.feedback`. |
| `featureGate.state` | Fixture value: `unlocked`. |
| `featureGate.checkedAt` | Same timestamp as `event.occurredAt`. |

## Semantic Boundary

TPR does not own semantic interpretation.

TPR only emits structured planning events from generated local planning data. It can identify that a milestone checkpoint exists, that it has linked notes or tasks, and that a date makes it eligible for a `milestone.completed` fixture.

TheRocketTree-App bridge owns semantic processing. It decides how the event is interpreted, whether recognition feedback should be shown, and how the event contributes to any Unity-facing recognition or feedback flow.

## Fixture

Example fixture:

```text
docs/bridge/examples/tpr-milestone-completed.bridge-request.json
```

The fixture uses the generated `PF-PROJECT roadmap checkpoint` milestone:

- source object: `data/milestones.json` milestone id `milestone-pf-project-2026-05-03`
- project: `PF-PROJECT`
- source folder: `content/notes-2026/Profound Projects/PF-PROJECT`
- occurred at: `2026-05-03T00:00:00.000Z`

## Later Implementation Notes

When runtime bridge integration is allowed, add a separate adapter module that reads generated milestones, validates against TheRocketTree-App's current bridge contract, and posts only after an explicit runtime integration task. That future implementation should keep fixture generation and runtime posting separate.
