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
        source: 'user-goal'
      }))
    );

    const tasks = [...generatedTasks, ...userGoalTasks];

    return {
      goals: this.userState.goals || [],
      tasks,
      events: this.userState.events || [],
      milestones: this.userState.milestones || [],
      notes: this.notesIndex?.notes || this.dashboardModel.notes || [],
      levels: this.dashboardModel.levels || [],
      projects: this.dashboardModel.projects || []
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

    const idx = this.userState.goals.findIndex(g => g.id === goal.id);
    if (idx >= 0) {
      this.userState.goals[idx] = goal;
    } else {
      this.userState.goals.push(goal);
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

  saveToLocalStorage() {
    const KEY = '2026-planner-v1';
    localStorage.setItem(KEY, JSON.stringify(this.userState));
    
    if (typeof window !== 'undefined' && window.PlannerSync?.notifyChange) {
      window.PlannerSync.notifyChange('state');
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
