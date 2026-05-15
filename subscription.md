# Real-Time Subscription Layer Architecture for the TPR Dashboard

## 1) TPR PIPELINE CONTEXT

### System Role

The Time Planner Roadmap (TPR) subscription layer is the deterministic control plane that tracks simulation progression, lifecycle events, and operator intent across the live Game Manager System (GMS) runtime. Its purpose is to keep the dashboard synchronized with authoritative engine state while preserving strict sequencing rules needed for roadmap execution.

### Core Responsibilities

- Track simulation lifecycle phases from initialization to shutdown.
- Maintain deterministic timeline ordering through monotonic tick sequencing.
- Monitor milestone pacing against planned delivery windows.
- Observe frame ticks and queue pressure without introducing write-side jitter.
- Coordinate asynchronous job queues with scheduling matrices used by roadmap managers.
- Expose command channels for controlled runtime adjustments from the dashboard.

### Deterministic Tracking Scope

TPR continuously models runtime as a chain of ordered lifecycle snapshots:

- **Frame progression:** Every engine frame contributes to tick advancement and throughput metrics.
- **Milestone progression:** Active milestone indexes and completion drift are measured against target pacing.
- **Queue dynamics:** Pending background operations, dequeue rates, and burst behavior are sampled per tick.
- **Routine health:** Processing routines publish success rates and latency bands used for timeline confidence.

### Subscription to the GMS Network Engine Bus

TPR maps time sequences by subscribing to the live GMS network engine bus, which acts as the authoritative event stream for runtime state. The subscription layer applies deterministic ordering and consistency guards:

- **Ordered delivery contract:** Events are consumed in sequence using `tickSequenceId` as the canonical timeline key.
- **Idempotent reconciliation:** Duplicate emissions are ignored when sequence keys are already committed in memory.
- **Gap detection:** Missing sequence windows trigger soft recovery requests and temporary UI confidence downgrades.
- **Clock normalization:** Engine-reported timing is normalized into dashboard timeline units for stable visual progression.
- **Backpressure-aware ingestion:** Queue spikes are buffered in transient memory and coalesced for render-safe updates.

### Lifecycle Manager Behavior

The lifecycle manager inside TPR enforces a predictable simulation loop:

- `BOOTSTRAP` → `RUNNING` → `THROTTLED`/`PAUSED` → `RESUMED` → `TERMINATING`.
- Each phase transition is emitted as a typed event and reflected on the dashboard timeline.
- Transition guards prevent invalid state changes (for example, `RESUMED` without a prior `PAUSED`).
- Dashboard controls only dispatch actions that match the current lifecycle guardrail set.

### Development Scheduling Matrix Integration

TPR ties runtime emissions to planning metadata:

- Milestone indexes align to roadmap lanes and sprint windows.
- Tick windows map to expected throughput zones.
- Queue load signals annotate risk states for near-term delivery milestones.
- Lifecycle anomalies are surfaced as matrix overlays, enabling proactive scheduling decisions.

---

## 2) INBOUND INGESTION DATA MAPPING (Unity Game Engine -> TPR Dashboard)

### Ingestion Purpose

Inbound ingestion converts Unity runtime outputs into a normalized dashboard stream with minimal latency and deterministic ordering.

### Real-Time Streamed Data Categories

From Unity into the dashboard, TPR subscribes to and maps:

- **Engine frame steps**
  - Current frame index
  - Delta timing
  - Simulation time-scale
- **Active pipeline queues**
  - Pending queue length
  - Processing concurrency level
  - Queue saturation ratio
- **Active game milestone updates**
  - Active milestone indexes
  - Entered/completed milestone transitions
  - Pacing variance against target schedule
- **Processing load indicators**
  - Operations processed per tick
  - Routine-level success/failure counters
  - Mean processing duration per routine class

### Inbound Subscription Flow

1. Unity publishes lifecycle tick emissions onto the GMS bus.
2. TPR subscription listener receives raw tick payloads.
3. Normalization layer validates schema and sequence integrity.
4. In-memory buffer stages valid ticks for the UI renderer.
5. React timeline views consume the latest merged state snapshot.

### Strict JSON Data Schema: `LIFECYCLE_TICK_EMISSION`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "LIFECYCLE_TICK_EMISSION",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "tickSequenceId",
    "simulationTimeScale",
    "activeRoadmapMilestoneIndexes",
    "systemRoutineMetrics"
  ],
  "properties": {
    "tickSequenceId": {
      "type": "integer",
      "minimum": 0,
      "description": "Monotonic sequence number for deterministic ordering."
    },
    "simulationTimeScale": {
      "type": "object",
      "additionalProperties": false,
      "required": ["current", "minimum", "maximum"],
      "properties": {
        "current": { "type": "number", "minimum": 0.0 },
        "minimum": { "type": "number", "minimum": 0.0 },
        "maximum": { "type": "number", "exclusiveMinimum": 0.0 }
      }
    },
    "activeRoadmapMilestoneIndexes": {
      "type": "array",
      "items": { "type": "integer", "minimum": 0 },
      "minItems": 1,
      "uniqueItems": true,
      "description": "Indexes for currently active roadmap milestones in TPR."
    },
    "systemRoutineMetrics": {
      "type": "object",
      "additionalProperties": false,
      "required": ["pendingTasks", "processedPipelineOperations"],
      "properties": {
        "pendingTasks": { "type": "integer", "minimum": 0 },
        "processedPipelineOperations": {
          "type": "integer",
          "minimum": 0,
          "description": "Count processed in current tick window."
        }
      }
    }
  }
}
```

### Inbound Data Guarantees

- Payloads failing schema validation are rejected and logged as non-fatal ingestion faults.
- Out-of-order ticks are retained briefly for reordering; expired late packets are discarded.
- UI updates are emitted only from validated state snapshots.
- No static file writes occur during active simulation ingestion.

---

## 3) OUTBOUND ACTION MANIFEST (TPR Dashboard -> Unity Game Engine)

### Outbound Control Objective

The dashboard provides controlled, real-time runtime interventions to Unity through TPR, enabling managers to tune simulation behavior without violating lifecycle integrity.

### Supported Real-Time Control Actions

- **Pause simulation pipelines**
  - Halt queue advancement while preserving state consistency.
- **Speed up or slow down background loops**
  - Adjust simulation time-scale for throughput experiments or recovery windows.
- **Toggle feature flag test gates**
  - Enable or disable gated mechanics for controlled validation in live sessions.

### Command Dispatch Model

- Commands are authored in the dashboard UI.
- TPR validates action type, lifecycle compatibility, and constraints.
- Valid actions are signed with sequence metadata and sent to Unity.
- Unity applies mutation and emits confirmation ticks back into inbound stream.

### Strict JSON Action Structure: `UPDATE_SIMULATION_TIME_SCALE`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UPDATE_SIMULATION_TIME_SCALE",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "targetTimeScale",
    "overrideClassification",
    "durationConstraints",
    "testGateKeys"
  ],
  "properties": {
    "targetTimeScale": {
      "type": "number",
      "exclusiveMinimum": 0.0,
      "maximum": 8.0,
      "description": "Desired simulation multiplier to apply in Unity."
    },
    "overrideClassification": {
      "type": "string",
      "enum": ["OPERATOR_MANUAL", "SCHEDULE_AUTOMATION", "EMERGENCY_STABILIZATION"],
      "description": "Reason class used for audit and rollback policy selection."
    },
    "durationConstraints": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mode", "maxDurationMs"],
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["UNTIL_REVOKED", "WINDOWED"]
        },
        "maxDurationMs": {
          "type": "integer",
          "minimum": 0,
          "description": "0 allowed only when mode is UNTIL_REVOKED."
        }
      }
    },
    "testGateKeys": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-Z0-9_\\-]{2,64}$"
      },
      "description": "Feature gate identifiers affected by this command.",
      "default": []
    }
  }
}
```

### Outbound Safety and Governance

- Lifecycle-aware validation blocks time-scale updates during disallowed phases.
- Rate limiting prevents command flooding from rapid UI interactions.
- Every command is traceable via sequence-linked audit metadata.
- Failed command applications return explicit rejection reasons for UI display.

---

## 4) GLASSMORPHIC UI PIPELINE INTEGRATION

### Frontend Stack Integration Targets

The subscription layer feeds a presentation pipeline built on:

- **React 18.3** for concurrent-capable component rendering and state partitioning.
- **Vite 6.1** for fast module updates and lean runtime asset delivery.
- **Tailwind CSS 4.2** for utility-first styling of glassmorphic timeline components.

### Non-Persistent Memory Buffer Strategy

The dashboard uses in-memory buffers for active simulation state:

- Ring buffers hold recent `LIFECYCLE_TICK_EMISSION` windows.
- Derived selectors compute milestone pacing and queue pressure overlays.
- Buffers are intentionally non-persistent during active sessions.
- Static files are never written as part of live render updates.

### Timeline Rendering Pipeline

1. Subscription adapter receives validated tick snapshots.
2. Snapshot reducer merges tick state into in-memory timeline model.
3. React views subscribe to memoized selectors.
4. Glassmorphic timeline cards update on next render frame.
5. UI transitions remain smooth through batched state updates.

### Glassmorphic Milestone Card System

Milestone sequence visualization uses layered glass design primitives:

- **Custom gradient border lines**
  - Encode pacing status (on-track, warning, delayed) by color and intensity.
- **Responsive background blurs**
  - Adapt blur radius by viewport and density for readability under load.
- **Translucent glass layers**
  - Separate milestone metadata, queue metrics, and action affordances.
- **Instant state reflection**
  - Card badges and progress rails update as soon as inbound tick state changes.

### Real-Time Update Behavior

- No polling dependency for high-frequency updates; push subscriptions drive changes.
- UI applies optimistic control-state hints while awaiting Unity confirmation ticks.
- Confirmed tick emissions reconcile optimistic state into authoritative timeline values.
- Missed tick windows trigger visual continuity guards rather than file-based recovery.

### Observability Hooks for UI and Pipeline

- Render latency and subscription lag are measured per update cycle.
- Buffer occupancy is tracked to identify ingestion pressure points.
- Action round-trip timing is surfaced for operator trust and tuning.
- Milestone drift indicators are rendered as first-class timeline annotations.

### Resulting Operational Outcome

This architecture delivers a deterministic, low-latency, subscription-first bridge between Unity and the TPR dashboard. The GMS bus remains the runtime source of truth, TPR enforces sequence-safe lifecycle orchestration, and the glassmorphic UI reflects live milestone progression instantly through non-persistent memory pathways. The end result is a highly controllable planning interface where managers can monitor pacing, diagnose queue pressure, and execute simulation controls in real time without relying on static file mutation during active sessions.
