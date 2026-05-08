// sync-engine.js — authenticated planner state sync.
// Exposes window.PlannerSync. Operates on top of localStorage so the app
// keeps working in local-only mode when Firebase is unavailable.

(function () {
  const STATE_KEY = "2026-planner-v1";
  const ROADMAP_PROGRESS_KEY = "roadmapLevelAssignments";
  const PHASE_CHECKS_KEY = "projectPhaseChecks";
  const ACCEPTED_AI_KEY = "acceptedAiSuggestions";
  const PENDING_KEY = "pendingSyncActions";
  const LAST_SYNCED_KEY = "plannerLastSyncedAt";
  const LOCAL_UPDATED_AT_KEY = "plannerLocalUpdatedAt";
  const MIGRATION_DONE_KEY = "plannerMigratedToCloud";
  const FIREBASE_MODULE_URL = "./firebase.js";

  const DEBOUNCE_MS = 1500;

  const state = {
    user: null,
    online: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
    lastSyncedAt: Number(localStorage.getItem(LAST_SYNCED_KEY) || 0) || null,
    pendingWrites: countPendingWrites(),
    error: null,
    mode: "initializing", // initializing | local-only | cloud | error
    lastReason: null
  };

  let firebaseModule = null;
  let firebaseLoadAttempted = false;
  let unsubscribeAuth = null;
  let unsubscribeSnapshot = null;
  let debounceTimer = null;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function countPendingWrites() {
    const queue = readJson(PENDING_KEY, []);
    return Array.isArray(queue) ? queue.filter(item => item?.kind === "plannerState").length : 0;
  }

  function emitStatus() {
    state.pendingWrites = countPendingWrites();
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("planner-sync-status", { detail: getStatus() }));
    }
  }

  function getStatus() {
    return {
      user: state.user,
      uid: state.user?.uid || null,
      isAnonymous: !!state.user?.isAnonymous,
      online: state.online,
      lastSyncedAt: state.lastSyncedAt,
      pendingWrites: state.pendingWrites,
      error: state.error,
      mode: state.mode,
      firebaseReady: !!firebaseModule?.firebaseReady
    };
  }

  async function loadFirebase() {
    if (firebaseLoadAttempted) return firebaseModule;
    firebaseLoadAttempted = true;
    try {
      firebaseModule = await import(FIREBASE_MODULE_URL);
      if (!firebaseModule.firebaseReady) {
        state.mode = "local-only";
        state.error = null;
        emitStatus();
        return firebaseModule;
      }
      return firebaseModule;
    } catch (err) {
      console.warn("PlannerSync: firebase.js unavailable, running local-only.", err);
      firebaseModule = null;
      state.mode = "local-only";
      state.error = null;
      emitStatus();
      return null;
    }
  }

  // ─── Local snapshot helpers ───────────────────────────────────────────
  function readLocalSnapshot() {
    const raw = readJson(STATE_KEY, {}) || {};
    return {
      goals: Array.isArray(raw.goals) ? raw.goals : [],
      events: Array.isArray(raw.events) ? raw.events : [],
      blocks: raw.blocks && typeof raw.blocks === "object" ? raw.blocks : {},
      milestones: Array.isArray(raw.milestones) ? raw.milestones : [],
      proposedNotes: Array.isArray(raw.proposedNotes) ? raw.proposedNotes : [],
      projectTools: raw.projectTools && typeof raw.projectTools === "object" ? raw.projectTools : {},
      roadmapNotes: Array.isArray(raw.roadmapNotes) ? raw.roadmapNotes : [],
      projectPhaseItems: Array.isArray(raw.projectPhaseItems) ? raw.projectPhaseItems : [],
      deploymentNotes: Array.isArray(raw.deploymentNotes) ? raw.deploymentNotes : [],
      syncedNotesQueue: Array.isArray(raw.syncedNotesQueue) ? raw.syncedNotesQueue : []
    };
  }

  function buildPayload() {
    const snap = readLocalSnapshot();
    const flatTasks = (snap.goals || []).flatMap(goal =>
      (goal.tasks || []).map(task => ({
        ...task,
        goalId: goal.id,
        projectName: goal.projectName || ""
      }))
    );
    return {
      goals: snap.goals,
      tasks: flatTasks,
      milestones: snap.milestones,
      events: snap.events,
      blocks: snap.blocks,
      proposedNotes: snap.proposedNotes,
      projectTools: snap.projectTools,
      roadmapNotes: snap.roadmapNotes,
      projectPhaseItems: snap.projectPhaseItems,
      deploymentNotes: snap.deploymentNotes,
      syncedNotesQueue: snap.syncedNotesQueue,
      roadmapProgress: {
        levelAssignments: readJson(ROADMAP_PROGRESS_KEY, {}) || {},
        projectPhaseChecks: readJson(PHASE_CHECKS_KEY, {}) || {}
      },
      settings: {},
      acceptedAIActions: readJson(ACCEPTED_AI_KEY, []) || [],
      clientUpdatedAt: Number(localStorage.getItem(LOCAL_UPDATED_AT_KEY) || 0) || Date.now()
    };
  }

  // ─── Merge cloud → local ───────────────────────────────────────────────
  function mergeArrayById(localArr, cloudArr) {
    const localList = Array.isArray(localArr) ? localArr : [];
    const cloudList = Array.isArray(cloudArr) ? cloudArr : [];
    const byId = new Map();
    cloudList.forEach(item => {
      if (item && item.id != null) byId.set(item.id, item);
    });
    localList.forEach(item => {
      if (item && item.id != null) byId.set(item.id, item);
    });
    return Array.from(byId.values());
  }

  function mergeBlocks(localBlocks, cloudBlocks) {
    const out = { ...(cloudBlocks || {}) };
    Object.keys(localBlocks || {}).forEach(date => {
      out[date] = mergeArrayById(localBlocks[date], out[date]);
    });
    return out;
  }

  function applyCloudPayloadToLocal(cloud) {
    if (!cloud || typeof cloud !== "object") return;
    const localState = readJson(STATE_KEY, {}) || {};
    const cloudUpdated = (cloud.clientUpdatedAt && Number(cloud.clientUpdatedAt)) || 0;
    const localUpdated = Number(localStorage.getItem(LOCAL_UPDATED_AT_KEY) || 0);
    const cloudIsNewer = cloudUpdated > localUpdated;

    const merged = {
      ...localState,
      goals: mergeArrayById(cloudIsNewer ? cloud.goals : localState.goals, cloudIsNewer ? localState.goals : cloud.goals),
      events: mergeArrayById(localState.events, cloud.events),
      blocks: mergeBlocks(localState.blocks, cloud.blocks),
      milestones: mergeArrayById(localState.milestones, cloud.milestones),
      proposedNotes: mergeArrayById(localState.proposedNotes, cloud.proposedNotes),
      projectTools: { ...(cloud.projectTools || {}), ...(localState.projectTools || {}) },
      roadmapNotes: mergeArrayById(localState.roadmapNotes, cloud.roadmapNotes),
      projectPhaseItems: mergeArrayById(localState.projectPhaseItems, cloud.projectPhaseItems),
      deploymentNotes: mergeArrayById(localState.deploymentNotes, cloud.deploymentNotes),
      syncedNotesQueue: mergeArrayById(localState.syncedNotesQueue, cloud.syncedNotesQueue)
    };
    writeJson(STATE_KEY, merged);

    if (cloud.roadmapProgress?.levelAssignments) {
      const localAssignments = readJson(ROADMAP_PROGRESS_KEY, {}) || {};
      writeJson(ROADMAP_PROGRESS_KEY, { ...cloud.roadmapProgress.levelAssignments, ...localAssignments });
    }
    if (cloud.roadmapProgress?.projectPhaseChecks) {
      const localChecks = readJson(PHASE_CHECKS_KEY, {}) || {};
      writeJson(PHASE_CHECKS_KEY, { ...cloud.roadmapProgress.projectPhaseChecks, ...localChecks });
    }
    if (Array.isArray(cloud.acceptedAIActions)) {
      const localAccepted = readJson(ACCEPTED_AI_KEY, []) || [];
      writeJson(ACCEPTED_AI_KEY, mergeArrayById(localAccepted, cloud.acceptedAIActions));
    }
  }

  function broadcastReload(reason) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("planner-state-reloaded", { detail: { reason } }));
  }

  // ─── Pending queue ─────────────────────────────────────────────────────
  function enqueuePending(reason) {
    const queue = readJson(PENDING_KEY, []) || [];
    if (!Array.isArray(queue)) return;
    queue.push({
      id: `plannerState-${Date.now().toString(36)}`,
      kind: "plannerState",
      reason: reason || "deferred",
      createdAt: new Date().toISOString()
    });
    writeJson(PENDING_KEY, queue);
  }

  function clearPending() {
    const queue = readJson(PENDING_KEY, []) || [];
    if (!Array.isArray(queue)) return;
    const remaining = queue.filter(item => item?.kind !== "plannerState");
    writeJson(PENDING_KEY, remaining);
  }

  // ─── Push / pull ──────────────────────────────────────────────────────
  async function pushNow(reason) {
    state.lastReason = reason || "manual";
    if (!firebaseModule || !firebaseModule.firebaseReady || !state.user?.uid) {
      enqueuePending(reason);
      emitStatus();
      return { ok: false, mode: state.mode };
    }
    if (!state.online) {
      enqueuePending(reason);
      emitStatus();
      return { ok: false, mode: "offline" };
    }
    try {
      const payload = buildPayload();
      await firebaseModule.savePlannerState(state.user.uid, payload);
      state.lastSyncedAt = Date.now();
      localStorage.setItem(LAST_SYNCED_KEY, String(state.lastSyncedAt));
      state.error = null;
      clearPending();
      emitStatus();
      return { ok: true };
    } catch (err) {
      console.warn("PlannerSync push failed", err);
      state.error = err?.message || String(err);
      enqueuePending(reason);
      emitStatus();
      return { ok: false, error: state.error };
    }
  }

  async function pullNow() {
    if (!firebaseModule || !firebaseModule.firebaseReady || !state.user?.uid) {
      emitStatus();
      return { ok: false, mode: state.mode };
    }
    try {
      const cloud = await firebaseModule.loadPlannerState(state.user.uid);
      if (cloud) {
        applyCloudPayloadToLocal(cloud);
        broadcastReload("pull");
      }
      state.error = null;
      emitStatus();
      return { ok: true, hadDoc: !!cloud };
    } catch (err) {
      console.warn("PlannerSync pull failed", err);
      state.error = err?.message || String(err);
      emitStatus();
      return { ok: false, error: state.error };
    }
  }

  function notifyChange(reason) {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(Date.now()));
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      pushNow(reason || "change");
    }, DEBOUNCE_MS);
    state.pendingWrites = countPendingWrites() + 1;
    emitStatus();
  }

  async function flushPendingIfAny() {
    if (countPendingWrites() === 0) return;
    await pushNow("retry");
  }

  // ─── One-time localStorage → Firestore migration ──────────────────────
  // Runs only when the user's cloud document does not yet exist (first sign-in).
  // Sets MIGRATION_DONE_KEY so it never runs again on this device.
  async function migrateLocalToCloud(uid) {
    if (localStorage.getItem(MIGRATION_DONE_KEY) === "1") return;
    const payload = buildPayload();
    const hasData =
      (payload.goals && payload.goals.length > 0) ||
      (payload.events && payload.events.length > 0) ||
      (payload.milestones && payload.milestones.length > 0);
    if (!hasData) {
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      return;
    }
    try {
      await firebaseModule.savePlannerState(uid, payload);
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      console.log("PlannerSync: local data migrated to cloud.");
    } catch (err) {
      console.warn("PlannerSync: migration failed, will retry next session.", err);
    }
  }

  // ─── Auth lifecycle ───────────────────────────────────────────────────
  async function handleAuthChange(user) {
    state.user = user;
    state.error = null;

    // Tear down any existing real-time listener before switching users.
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (user) {
      state.mode = "cloud";
      emitStatus();

      // Pull once to detect an empty cloud doc (triggers one-time migration).
      const pullResult = await pullNow();
      if (pullResult?.ok && !pullResult.hadDoc) {
        await migrateLocalToCloud(user.uid);
      }

      // Subscribe to real-time updates via onSnapshot.
      if (typeof firebaseModule.subscribePlannerState === "function") {
        unsubscribeSnapshot = firebaseModule.subscribePlannerState(
          user.uid,
          (cloud, err) => {
            if (err) {
              console.warn("PlannerSync snapshot error", err);
              state.error = err?.message || String(err);
              emitStatus();
              return;
            }
            // cloud may be null when the document does not yet exist.
            if (cloud) {
              applyCloudPayloadToLocal(cloud);
              broadcastReload("snapshot");
              state.lastSyncedAt = Date.now();
              localStorage.setItem(LAST_SYNCED_KEY, String(state.lastSyncedAt));
            }
            state.error = null;
            emitStatus();
          }
        );
      }

      await flushPendingIfAny();
    } else {
      state.mode = firebaseModule?.firebaseReady ? "cloud" : "local-only";
      emitStatus();
    }
  }

  // ─── Backup / restore ─────────────────────────────────────────────────
  function exportLocal() {
    const envelope = {
      [STATE_KEY]: readJson(STATE_KEY, {}) || {},
      [ROADMAP_PROGRESS_KEY]: readJson(ROADMAP_PROGRESS_KEY, {}) || {},
      [PHASE_CHECKS_KEY]: readJson(PHASE_CHECKS_KEY, {}) || {},
      [ACCEPTED_AI_KEY]: readJson(ACCEPTED_AI_KEY, []) || [],
      exportedAt: new Date().toISOString(),
      schema: "timeplanner-backup-v1"
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `timeplanner-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return envelope;
  }

  function restoreLocal(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Invalid backup file.");
    }
    if (envelope.schema && envelope.schema !== "timeplanner-backup-v1") {
      throw new Error(`Unsupported backup schema: ${envelope.schema}`);
    }
    if (envelope[STATE_KEY] && typeof envelope[STATE_KEY] === "object") {
      writeJson(STATE_KEY, envelope[STATE_KEY]);
    }
    if (envelope[ROADMAP_PROGRESS_KEY] && typeof envelope[ROADMAP_PROGRESS_KEY] === "object") {
      writeJson(ROADMAP_PROGRESS_KEY, envelope[ROADMAP_PROGRESS_KEY]);
    }
    if (envelope[PHASE_CHECKS_KEY] && typeof envelope[PHASE_CHECKS_KEY] === "object") {
      writeJson(PHASE_CHECKS_KEY, envelope[PHASE_CHECKS_KEY]);
    }
    if (Array.isArray(envelope[ACCEPTED_AI_KEY])) {
      writeJson(ACCEPTED_AI_KEY, envelope[ACCEPTED_AI_KEY]);
    }
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, String(Date.now()));
    broadcastReload("restore");
    notifyChange("restore");
  }

  // ─── syncState (manual force-sync from Firestore) ─────────────────────
  // Checks authentication, fetches the latest cloud document, applies it to
  // localStorage, and broadcasts a reload. Falls back gracefully when offline
  // or when Firebase is not configured.
  async function syncState() {
    if (!firebaseModule?.firebaseReady) {
      return { ok: false, mode: "local-only", reason: "Firebase not configured" };
    }
    if (!state.user?.uid) {
      return { ok: false, mode: state.mode, reason: "not authenticated" };
    }
    return await pullNow();
  }

  // ─── Sign-in helpers (UI-facing wrappers) ─────────────────────────────
  async function signInWithGoogle() {
    await loadFirebase();
    if (!firebaseModule?.firebaseReady) throw new Error("Firebase not configured.");
    return firebaseModule.signInWithGoogle();
  }
  async function signInAnonymous() {
    await loadFirebase();
    if (!firebaseModule?.firebaseReady) throw new Error("Firebase not configured.");
    return firebaseModule.signInAnonymous();
  }
  async function signOutUser() {
    if (!firebaseModule?.firebaseReady) return;
    await firebaseModule.signOutUser();
  }

  // ─── Init ─────────────────────────────────────────────────────────────
  async function init() {
    state.online = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        state.online = true;
        emitStatus();
        flushPendingIfAny();
      });
      window.addEventListener("offline", () => {
        state.online = false;
        emitStatus();
      });
    }
    await loadFirebase();
    if (firebaseModule?.firebaseReady) {
      state.mode = "cloud";
      unsubscribeAuth = firebaseModule.subscribeToAuth(handleAuthChange);
    } else {
      state.mode = "local-only";
      emitStatus();
    }
  }

  window.PlannerSync = {
    init,
    notifyChange,
    pushNow,
    pullNow,
    syncState,
    getStatus,
    exportLocal,
    restoreLocal,
    signInWithGoogle,
    signInAnonymous,
    signOutUser
  };
})();
