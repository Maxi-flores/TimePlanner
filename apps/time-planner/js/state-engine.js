class StateEngine {
  constructor() {
    this.userState = null;
    this.dashboardModel = null;
    this.notesIndex = null;
  }

  init(state, dashboardModel, notesIndex) {
    this.userState = state;
    this.dashboardModel = dashboardModel;
    this.notesIndex = notesIndex;
  }

  createId() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      // ignore
    }
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    return `id-${ts}-${rand}`;
  }

  parseLastModified(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
    const t = Date.parse(String(value));
    return Number.isFinite(t) ? t : 0;
  }

  mergeArrayLww(localArr, cloudArr) {
    const localList = Array.isArray(localArr) ? localArr : [];
    const cloudList = Array.isArray(cloudArr) ? cloudArr : [];
    const byKey = new Map();

    const keyFor = (item) => item?.id ?? item?.roadmapLevelId ?? null;
    const modifiedFor = (item) =>
      this.parseLastModified(item?.lastModified ?? item?.clientUpdatedAt ?? item?.updatedAt ?? item?.createdAt);

    cloudList.forEach(item => {
      const key = keyFor(item);
      if (key == null) return;
      byKey.set(key, item);
    });

    localList.forEach(item => {
      const key = keyFor(item);
      if (key == null) return;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }
      const existingModified = modifiedFor(existing);
      const nextModified = modifiedFor(item);
      if (nextModified > existingModified) {
        byKey.set(key, item);
      } else if (nextModified === existingModified) {
        byKey.set(key, item);
      }
    });

    return Array.from(byKey.values());
  }

  mergeBlocksLww(localBlocks, cloudBlocks) {
    const localMap = localBlocks && typeof localBlocks === 'object' ? localBlocks : {};
    const cloudMap = cloudBlocks && typeof cloudBlocks === 'object' ? cloudBlocks : {};
    const out = { ...cloudMap };
    Object.keys(localMap).forEach(dateKey => {
      out[dateKey] = this.mergeArrayLww(localMap[dateKey], out[dateKey]);
    });
    return out;
  }

  shouldExcludePath(sourcePath) {
    const value = String(sourcePath || '');
    return (
      value.includes('/.git/') ||
      value.includes('/node_modules/') ||
      value.includes('/dist/') ||
      value.includes('/build/') ||
      value.includes('/.vercel/')
    );
  }

  deriveNestedProjectName(sourcePath) {
    const posix = String(sourcePath || '').split('\\').join('/');
    const marker = 'content/notes-2026/Profound Projects/';
    const idx = posix.indexOf(marker);
    if (idx === -1) return null;
    const after = posix.slice(idx + marker.length);
    const parts = after.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return parts.slice(0, -1).join('/');
  }

  filenameFromPath(sourcePath) {
    const posix = String(sourcePath || '').split('\\').join('/');
    const parts = posix.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  deriveRepoFolderArtifacts() {
    const notes = (this.notesIndex?.notes && Array.isArray(this.notesIndex.notes))
      ? this.notesIndex.notes
      : (this.dashboardModel?.notes && Array.isArray(this.dashboardModel.notes))
        ? this.dashboardModel.notes
        : [];

    const generatedAt = this.notesIndex?.generatedAt || this.dashboardModel?.generatedAt || null;
    const defaultModified = generatedAt ? this.parseLastModified(generatedAt) : Date.now();

    return notes
      .filter(note => note?.sourcePath && !this.shouldExcludePath(note.sourcePath))
      .map(note => {
        const roadmapLevelId = String(note.sourcePath);
        const projectName = this.deriveNestedProjectName(note.sourcePath) || note.projectName || null;
        if (!projectName) return null;
        const title = note.title || this.filenameFromPath(note.sourcePath) || 'Untitled';
        const lastModified = note.lastModified || (note.date ? `${note.date}T00:00:00.000Z` : defaultModified);

        return {
          id: this.createId(),
          roadmapLevelId,
          title,
          projectName,
          status: 'backlog',
          notes: [],
          lastModified,
        };
      })
      .filter(Boolean);
  }

  getUnifiedDashboard() {
    if (!this.userState || !this.dashboardModel) {
      console.warn('StateEngine: not initialized');
      return {
        goals: [],
        tasks: [],
        events: [],
        milestones: [],
        notes: [],
        levels: []
      };
    }

    const repoBacklog = this.deriveRepoFolderArtifacts();
    const generatedTasks = (this.dashboardModel.tasks || []).map(task => ({
      ...task,
      source: task.source || 'generated'
    }));

    const userGoalTasks = (this.userState.goals || []).flatMap(goal =>
      (goal.tasks || []).map(task => ({
        id: `goal-task-${goal.id}-${task.id}`,
        title: task.text,
        projectName: goal.projectName || '',
        done: !!task.done,
        priority: !!task.priority,
        goalId: goal.id,
        roadmapLevelId: goal.roadmapLevelId || '',
        noteSource: goal.noteSource || '',
        aiTaskSource: goal.aiTaskSource || '',
        lastModified: task.lastModified || goal.lastModified || null,
        source: 'user-goal'
      }))
    );

    const tasks = [
      ...generatedTasks,
      ...repoBacklog.map(item => ({
        ...item,
        done: false,
        priority: false,
        source: 'repo-backlog'
      })),
      ...userGoalTasks
    ];

    return {
      goals: this.userState.goals || [],
      tasks,
      events: this.userState.events || [],
      milestones: this.userState.milestones || [],
      notes: this.notesIndex?.notes || this.dashboardModel.notes || [],
      levels: this.dashboardModel.levels || [],
      projects: this.dashboardModel.projects || [],
      repoBacklog
    };
  }

  saveGoal(goal) {
    if (!this.userState) {
      console.warn('StateEngine: cannot save goal, not initialized');
      return;
    }

    if (!this.userState.goals) {
      this.userState.goals = [];
    }

    const stampedGoal = { ...goal, lastModified: goal.lastModified || new Date().toISOString() };
    const idx = this.userState.goals.findIndex(g => g.id === stampedGoal.id);
    if (idx >= 0) {
      this.userState.goals[idx] = stampedGoal;
    } else {
      this.userState.goals.push(stampedGoal);
    }

    this.saveToLocalStorage();
  }

  deleteGoal(goalId) {
    if (!this.userState) {
      console.warn('StateEngine: cannot delete goal, not initialized');
      return;
    }

    if (!this.userState.goals) {
      this.userState.goals = [];
    }

    this.userState.goals = this.userState.goals.filter(g => g.id !== goalId);
    this.saveToLocalStorage();
  }

  applyCloudPayload(cloudPayload) {
    if (!this.userState || !cloudPayload || typeof cloudPayload !== 'object') return;

    const local = this.userState;
    const cloud = cloudPayload;
    const merged = {
      ...local,
      goals: this.mergeArrayLww(local.goals, cloud.goals),
      events: this.mergeArrayLww(local.events, cloud.events),
      milestones: this.mergeArrayLww(local.milestones, cloud.milestones),
      proposedNotes: this.mergeArrayLww(local.proposedNotes, cloud.proposedNotes),
      roadmapNotes: this.mergeArrayLww(local.roadmapNotes, cloud.roadmapNotes),
      projectPhaseItems: this.mergeArrayLww(local.projectPhaseItems, cloud.projectPhaseItems),
      deploymentNotes: this.mergeArrayLww(local.deploymentNotes, cloud.deploymentNotes),
      syncedNotesQueue: this.mergeArrayLww(local.syncedNotesQueue, cloud.syncedNotesQueue),
      blocks: this.mergeBlocksLww(local.blocks, cloud.blocks),
      projectTools: { ...(cloud.projectTools || {}), ...(local.projectTools || {}) },
    };

    this.userState = merged;
    this.saveToLocalStorage('cloud-merge');
  }

  saveToLocalStorage(reason = 'state') {
    const KEY = '2026-planner-v1';
    localStorage.setItem(KEY, JSON.stringify(this.userState));
    
    if (typeof window !== 'undefined' && window.PlannerSync?.notifyChange) {
      window.PlannerSync.notifyChange(reason);
    }
  }

  getSelectedProject() {
    const filters = this.loadDashboardFilters();
    return filters.project || '';
  }

  loadDashboardFilters() {
    try {
      const raw = localStorage.getItem('dashboardFilters');
      return raw ? JSON.parse(raw) : { project: '', category: '', folder: '', searchQuery: '', dateFilter: '' };
    } catch {
      return { project: '', category: '', folder: '', searchQuery: '', dateFilter: '' };
    }
  }
}

export { StateEngine };
