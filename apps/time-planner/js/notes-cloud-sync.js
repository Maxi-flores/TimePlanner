(function () {
  const CONFIG_KEY = "timeplannerCloudNotesConfig";
  const NOTES_CACHE_KEY = "timeplannerCloudNotesIndexCache";
  const DASHBOARD_CACHE_KEY = "timeplannerCloudDashboardModelCache";
  const DEFAULT_NOTES_URL = "data/notes-index.json";
  const DEFAULT_DASHBOARD_URL = "data/dashboard-model.json";

  function safeParseJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readStoredJson(key) {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return safeParseJson(raw);
  }

  function writeStoredJson(key, value) {
    if (typeof localStorage === "undefined") return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeBaseUrl(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }

  function cacheEnvelope(value, baseUrl) {
    return {
      baseUrl,
      fetchedAt: new Date().toISOString(),
      value,
    };
  }

  function getConfig() {
    const stored = readStoredJson(CONFIG_KEY) || {};
    return {
      baseUrl: normalizeBaseUrl(stored.baseUrl || ""),
    };
  }

  function setConfig(next = {}) {
    const merged = { ...getConfig(), ...next };
    merged.baseUrl = normalizeBaseUrl(merged.baseUrl);
    writeStoredJson(CONFIG_KEY, merged);
    return merged;
  }

  function clearConfig() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(CONFIG_KEY);
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }
    return await response.json();
  }

  function isOnline() {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine !== false;
  }

  function readableError(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    return err.message || String(err);
  }

  function getCachedNotesIndex() {
    return readStoredJson(NOTES_CACHE_KEY) || null;
  }

  function getCachedDashboardModel() {
    return readStoredJson(DASHBOARD_CACHE_KEY) || null;
  }

  async function loadDefaultsBestEffort() {
    const [notesResult, dashboardResult] = await Promise.allSettled([
      fetchJson(DEFAULT_NOTES_URL),
      fetchJson(DEFAULT_DASHBOARD_URL),
    ]);

    const payload = {
      baseUrl: "",
      notesIndex: notesResult.status === "fulfilled" ? notesResult.value : null,
      dashboardModel: dashboardResult.status === "fulfilled" ? dashboardResult.value : null,
      errors: {
        notesIndex: notesResult.status === "rejected" ? readableError(notesResult.reason) : null,
        dashboardModel: dashboardResult.status === "rejected" ? readableError(dashboardResult.reason) : null,
      },
    };

    if (payload.notesIndex) {
      writeStoredJson(NOTES_CACHE_KEY, cacheEnvelope(payload.notesIndex, ""));
    }
    if (payload.dashboardModel) {
      writeStoredJson(DASHBOARD_CACHE_KEY, cacheEnvelope(payload.dashboardModel, ""));
    }

    return payload;
  }

  function cachedFallback(baseUrl) {
    const cachedNotes = getCachedNotesIndex();
    const cachedDashboard = getCachedDashboardModel();
    return {
      baseUrl: baseUrl || cachedNotes?.baseUrl || cachedDashboard?.baseUrl || "",
      notesIndex: cachedNotes?.value || null,
      dashboardModel: cachedDashboard?.value || null,
      errors: {
        notesIndex: cachedNotes?.value ? null : "No cached notes-index.json available.",
        dashboardModel: cachedDashboard?.value ? null : "No cached dashboard-model.json available.",
      },
    };
  }

  async function sync(options = {}) {
    const config = options.baseUrl ? { baseUrl: normalizeBaseUrl(options.baseUrl) } : getConfig();
    const baseUrl = config.baseUrl || "";

    if (!baseUrl) {
      const defaults = await loadDefaultsBestEffort();
      if (defaults.notesIndex) {
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: defaults }));
        }
        return defaults;
      }
      const cached = cachedFallback("");
      if (cached.notesIndex) {
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: cached }));
        }
        return cached;
      }
      throw new Error(defaults.errors.notesIndex || "Missing notes-index.json and no cloud base URL configured.");
    }

    if (!isOnline()) {
      const cached = cachedFallback(baseUrl);
      if (cached.notesIndex) {
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: cached }));
        }
        return cached;
      }
      const defaults = await loadDefaultsBestEffort();
      if (defaults.notesIndex) {
        if (typeof window !== "undefined" && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: defaults }));
        }
        return defaults;
      }
      throw new Error("Offline and no cached/default notes-index.json available.");
    }

    const notesUrl = `${baseUrl}notes-index.json`;
    const dashboardUrl = `${baseUrl}dashboard-model.json`;

    const [notesResult, dashboardResult] = await Promise.allSettled([fetchJson(notesUrl), fetchJson(dashboardUrl)]);

    let payload = {
      baseUrl,
      notesIndex: notesResult.status === "fulfilled" ? notesResult.value : null,
      dashboardModel: dashboardResult.status === "fulfilled" ? dashboardResult.value : null,
      errors: {
        notesIndex: notesResult.status === "rejected" ? readableError(notesResult.reason) : null,
        dashboardModel: dashboardResult.status === "rejected" ? readableError(dashboardResult.reason) : null,
      },
    };

    if (payload.notesIndex) {
      writeStoredJson(NOTES_CACHE_KEY, cacheEnvelope(payload.notesIndex, baseUrl));
    }
    if (payload.dashboardModel) {
      writeStoredJson(DASHBOARD_CACHE_KEY, cacheEnvelope(payload.dashboardModel, baseUrl));
    }

    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: payload }));
    }

    if (!payload.notesIndex) {
      const cached = cachedFallback(baseUrl);
      if (cached.notesIndex) return cached;
      const defaults = await loadDefaultsBestEffort();
      if (defaults.notesIndex) return defaults;
      throw new Error(payload.errors.notesIndex || "Unable to load notes-index.json from the configured URL.");
    }

    return payload;
  }

  window.NotesCloudSync = {
    getConfig,
    setConfig,
    clearConfig,
    sync,
    getCachedNotesIndex,
    getCachedDashboardModel,
  };
})();
