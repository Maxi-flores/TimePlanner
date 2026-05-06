(function () {
  const DASHBOARD_MODEL_URL = "data/dashboard-model.json";
  const AI_SUGGESTIONS_URL = "data/ai-suggestions.json";
  const PENDING_SYNC_KEY = "pendingSyncActions";

  async function fetchJson(url, fallback) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn(`AI engine could not load ${url}`, err);
      return fallback;
    }
  }

  async function loadContext(projectId = "") {
    const [dashboardModel, aiSuggestions] = await Promise.all([
      fetchJson(DASHBOARD_MODEL_URL, { projects: [], tasks: [], milestones: [], notes: [] }),
      fetchJson(AI_SUGGESTIONS_URL, { projects: [], global: { actionPrompts: [], nextActions: [] } }),
    ]);

    const project =
      (dashboardModel.projects || []).find((item) => item.id === projectId || item.projectName === projectId) ||
      (dashboardModel.projects || [])[0] ||
      null;
    const projectName = project?.projectName || project?.name || projectId || "";
    const suggestion =
      (aiSuggestions.projects || []).find((item) => item.projectName === projectName || item.id === projectId) ||
      (aiSuggestions.projects || [])[0] ||
      {};

    return {
      projectId,
      projectName,
      project,
      dashboardModel,
      aiSuggestions,
      suggestion,
      tasks: (dashboardModel.tasks || []).filter((task) => !projectName || task.projectName === projectName),
      notes: (dashboardModel.notes || []).filter((note) => !projectName || note.projectName === projectName),
      milestones: (dashboardModel.milestones || []).filter((item) => !projectName || item.projectName === projectName),
    };
  }

  async function generateActionSet(projectId = "") {
    const context = await loadContext(projectId);
    const fallbackName = context.projectName || "the selected project";
    return {
      nextActions: context.suggestion.nextActions || [`Review the next concrete task for ${fallbackName}.`],
      promptIdeas: context.suggestion.actionPrompts || [`Create a focused implementation prompt for ${fallbackName}.`],
      blockers: context.suggestion.blockers || [`Check missing notes, task owners, and deployment prerequisites for ${fallbackName}.`],
      summary: context.suggestion.summaryPrompt || `Summarize current notes, tasks, and phase state for ${fallbackName}.`,
      milestonesSuggestions: context.suggestion.milestoneSuggestions || [
        `Define a small completion milestone for ${fallbackName}.`,
      ],
    };
  }

  async function runAction(type, projectId = "") {
    const actionSet = await generateActionSet(projectId);
    const context = await loadContext(projectId);
    const outputByType = {
      "next-step": actionSet.nextActions,
      "extract-tasks": actionSet.nextActions,
      summarize: [actionSet.summary],
      "find-blockers": actionSet.blockers,
      "generate-obsidian-note": [context.suggestion.obsidianNotePrompt || actionSet.summary],
      "generate-prompt": actionSet.promptIdeas,
    };
    const output = outputByType[type] || actionSet.promptIdeas;

    return {
      type,
      projectName: context.projectName || projectId || "",
      status: "deterministic-fallback",
      output,
      proposedTasks: (output || []).map((title) => ({
        title,
        projectName: context.projectName || projectId || "",
        source: "ai-suggestion",
      })),
      proposedNotes:
        type === "generate-obsidian-note"
          ? [{ title: output[0], projectName: context.projectName || projectId || "", source: "ai-suggestion" }]
          : [],
    };
  }

  function loadPendingSyncActions() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function savePendingSyncActions(actions) {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(actions));
  }

  async function tryWriteFirebaseSyncQueue(actionPayload) {
    try {
      const firebaseModule = await import("../firebase.js");
      if (typeof firebaseModule.submitSyncQueueAction !== "function") return null;
      return await firebaseModule.submitSyncQueueAction(actionPayload);
    } catch (err) {
      console.warn("Firebase syncQueue action unavailable; using local fallback.", err);
      return null;
    }
  }

  async function acceptAction(actionPayload) {
    const payload = {
      ...actionPayload,
      type: actionPayload?.type || "task",
      source: actionPayload?.source || "ai-suggestion",
      createdAt: actionPayload?.createdAt || new Date().toISOString(),
    };

    const firebaseResult = await tryWriteFirebaseSyncQueue(payload);
    if (firebaseResult) {
      return {
        status: "queued-firebase",
        syncQueueId: firebaseResult.syncQueueId || firebaseResult.id || null,
        payload,
      };
    }

    const pending = loadPendingSyncActions();
    const localId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    pending.push({
      id: localId,
      type: `${payload.type}.create`,
      payload,
      status: "pending",
      createdAt: payload.createdAt,
    });
    savePendingSyncActions(pending);

    return {
      status: "queued-local",
      localId,
      payload,
    };
  }

  function callLocalAI(promptPayload) {
    return {
      status: "disabled",
      payloadPreview: promptPayload,
    };
  }

  window.TimePlannerAI = {
    loadContext,
    generateActionSet,
    runAction,
    acceptAction,
    callLocalAI,
  };
})();
