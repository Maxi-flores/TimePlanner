# Time Planner Roadmap (TPR) — Functional Specification & Architecture (GMS)

## Document intent
- Purpose: define the Time Planner Roadmap (TPR) as the scheduling coordinator and roadmap workspace for the Game Manager System (GMS).
- Scope: describe functional behavior, system roles, data flow expectations, and runtime architecture for the planning dashboard.
- Audience: product design, gameplay engineering, data tooling, and live operations teams who depend on synchronized timelines.

## TPR PRODUCT PROFILE & VALUE PROP

### Product identity
- TPR is the scheduling coordinator for GMS-driven game cycles.
- TPR is the lifecycle tick monitor used to observe gameplay cadence health.
- TPR is the roadmap orchestration workspace for cross-team delivery planning.

### Core responsibility statement
- Map project tracking targets to structured timeline blocks.
- Monitor asynchronous engineering backlogs without blocking runtime sequencing.
- Organize milestone timelines into release, sprint, and feature windows.

### Value proposition
- Unified planning surface: one lens for delivery, live ops, and client iteration.
- Signal clarity: translates complex runtime signals into actionable progress state.
- Risk control: early detection of timeline drift and frame-step imbalance.

### Primary outcomes
- Predictable releases anchored to GMS tick health.
- Faster iteration by aligning engine runtime data with roadmap intent.

## SYSTEM POSITIONING WITHIN GMS + TPR

### Architecture posture
- TPR is a control-plane dashboard connected to GMS runtime telemetry.
- GMS is the authoritative runtime and simulation layer.
- TPR never replaces GMS execution; it instruments, observes, and orchestrates.

### Responsibility boundaries
- GMS owns: tick execution, frame simulations, runtime feature gate evaluation.
- TPR owns: roadmap timelines, progress normalization, and scheduling controls.
- Unity runtime remains the source of truth for real-time telemetry signals.

### Data rhythm
- Telemetry: real-time, frame-driven, high-frequency signals from GMS.
- Planning: human-paced, discrete updates and overrides from TPR operators.

## INPUT/OUTPUT ENVIRONMENT MAP

### Input Manager role (from Unity + GMS)
- Step emissions: captures frame-step events, tick cadence, and phase changes.
- Frame iteration counters: tracks step frequency, jitter, and drift.
- System computational loads: observes CPU/GPU budgets and runtime pressure.
- Milestone progress percentages: reads mission completion and release gates.

### Input flow mechanics
- Telemetry is batched into time slices to prevent UI thrash.
- Each input sample includes timestamp, tick index, and GMS phase label.

### Output Manager role (from TPR to GMS + client)
- Override values: push scheduling edits that update GMS planning tags.
- Temporary timeline parameters: set short-lived pacing rules during tests.
- Pause engine loop calculations: request halts for controlled diagnostics.
- Trigger test feature gates: activate targeted game client experiments.

### Output flow mechanics
- Operator actions emit signed scheduling intents to the GMS control layer.
- Overrides are bounded by lease windows to prevent accidental persistence.

## TECH STACK & FILE BLUEPRINT

### Runtime profile
- React 18.3 for component rendering and dashboard interactivity.
- Vite 6.1 for build orchestration and rapid preview cycles.
- Tailwind CSS 4.2 for utility styling and rapid layout iteration.
- PostCSS for pipeline transforms and design token processing.

### File blueprint (scannable structure)
```
/description.md
/apps/time-planner/
  /src/
    /ui/
      task-grid/
        TaskGrid.tsx
        TaskGridCell.tsx
      timeline-panel/
        TimelinePanel.tsx
        TimelineLane.tsx
      progress-meters/
        GlassProgressMeter.tsx
        MeterLegend.tsx
    /state/
      tpr-store.ts
      gms-telemetry.ts
      timeline-buffer.ts
    /services/
      gms-input-manager.ts
      gms-output-manager.ts
      telemetry-aggregator.ts
    /styles/
      tailwind.css
      glassmorphism.css
    /utils/
      cadence-math.ts
      milestone-normalizer.ts
  /public/
    /assets/
      gradients/
        roadmap-glow.png
```

### Visual architecture definitions
- Task grids: compact matrix view showing team lanes vs. milestone windows.
- Timeline panels: horizontal strata that mirror GMS phases and tick ranges.
- Glassmorphic progress meters: translucent cards with layered gradients.
- Background layer gradients and backdrop blur rules: depth and focus hierarchy.

### Component roles
- TaskGrid: interactive schedule surface with multi-select staging.
- TimelinePanel: master lane organizer for release, sprint, and feature bands.
- GlassProgressMeter: visualizes milestone health and cadence stability.
- GmsInputManager: telemetry ingestion, sampling, and normalization.
- GmsOutputManager: outbound override control, gating, and rollback logging.

## PERSISTENCE & IN-MEMORY RUNTIME RULES

### Workspace memory rules
- gms_theme provides global theme tokens aligned to runtime phases.
- Project caching retains operator preferences, lane visibility, and filters.
- Local view state persists the last selected milestone and zoom scale.

### Data residency layers
- Durable storage: project metadata, milestone definitions, and operator notes.
- Semi-persistent cache: recent telemetry snapshots for quick reloads.
- Volatile buffers: frame-step arrays and cadence samples for animation.

### Real-time optimization limits
- Timeline sequence tracking arrays update via non-persistent local buffers.
- Buffers are ring-structured to discard older samples without disk writes.
- Frame step changes animate smoothly without hard disk input/output blocking.

### Safety and integrity rules
- Output overrides must be reversible and time-boxed by default.
- Manual pauses require explicit confirmation and auto-resume safeguards.
- Feature gate triggers are logged with operator, timestamp, and reason.

## FUNCTIONAL CAPABILITIES

### Roadmap orchestration
- Multi-horizon planning: release view, sprint view, and iteration view.
- Milestone sequencing: dependency mapping and critical path visibility.

### Telemetry intelligence
- Tick health scoring: compares actual cadence vs. planned pace.
- Load correlation: ties compute spikes to milestone risk thresholds.

### Operator controls
- Schedule overrides: adjust pacing for specific phases or features.
- Calibration presets: apply known-good cadence profiles for testing.

## DATA MODELS & CONTRACTS

### Core entities
- ProjectTarget: {id, name, releaseWindow, owner, riskScore}
- Milestone: {id, label, gateType, expectedTicks, progressPercent}
- TelemetrySample: {timestamp, tickIndex, phase, cpuLoad, gpuLoad}
- OverrideIntent: {id, type, scope, leaseEndsAt, rollbackToken}

### Contract principles
- All inputs are immutable samples; aggregations are derived views.
- All outputs are auditable intents; GMS decides acceptance policy.

## SUCCESS INDICATORS
- Roadmap forecasts remain within one sprint of actual GMS delivery cadence.
- Overrides never destabilize tick rates or client safety gates.
- Operators can produce, review, and approve timeline updates within minutes.

## GMS + TPR INTEGRATION SUMMARY
- TPR is the planning cockpit; GMS is the runtime executor.
- Inputs: frame steps, load metrics, and milestone completion signals.
- Outputs: schedule intents, test gates, and safe pause commands.
- Result: synchronized roadmap delivery with real-time operational control.
