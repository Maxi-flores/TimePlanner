(function () {
  const CONFIG_KEY = "timeplannerCloudNotesConfig";
  const NOTES_CACHE_KEY = "timeplannerCloudNotesIndexCache";
  const DASHBOARD_CACHE_KEY = "timeplannerCloudDashboardModelCache";

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

  async function sync(options = {}) {
    const config = options.baseUrl ? { baseUrl: normalizeBaseUrl(options.baseUrl) } : getConfig();
    if (!config.baseUrl) {
      throw new Error("Missing cloud base URL. Paste a raw GitHub data folder URL first.");
    }

    const notesUrl = `${config.baseUrl}notes-index.json`;
    const dashboardUrl = `${config.baseUrl}dashboard-model.json`;

    const [notesResult, dashboardResult] = await Promise.allSettled([
      fetchJson(notesUrl),
      fetchJson(dashboardUrl),
    ]);

    const payload = {
      baseUrl: config.baseUrl,
      notesIndex: notesResult.status === "fulfilled" ? notesResult.value : null,
      dashboardModel: dashboardResult.status === "fulfilled" ? dashboardResult.value : null,
      errors: {
        notesIndex: notesResult.status === "rejected" ? readableError(notesResult.reason) : null,
        dashboardModel: dashboardResult.status === "rejected" ? readableError(dashboardResult.reason) : null,
      },
    };

    if (payload.notesIndex) {
      writeStoredJson(NOTES_CACHE_KEY, cacheEnvelope(payload.notesIndex, config.baseUrl));
    }
    if (payload.dashboardModel) {
      writeStoredJson(DASHBOARD_CACHE_KEY, cacheEnvelope(payload.dashboardModel, config.baseUrl));
    }

    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("notes-cloud-sync", { detail: payload }));
    }

    if (!payload.notesIndex) {
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

