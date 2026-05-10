class GoalsView {
  constructor(stateEngine) {
    this.stateEngine = stateEngine;
  }

  render(containerId, filterOptions = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`GoalsView: container ${containerId} not found`);
      return;
    }

    const unifiedData = this.stateEngine.getUnifiedDashboard();
    const goals = this.filterGoals(unifiedData.goals || [], filterOptions);

    if (goals.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:.85rem;">No goals yet. Click "+ Goal" to add one.</p>`;
      return;
    }

    container.innerHTML = '';
    goals.forEach(goal => this.renderGoalCard(container, goal, unifiedData));
  }

  filterGoals(goals, filterOptions) {
    return goals.filter(goal => {
      if (filterOptions.month && goal.month !== filterOptions.month) return false;
      if (filterOptions.projectName && goal.projectName !== filterOptions.projectName) return false;
      return true;
    });
  }

  renderGoalCard(container, goal, unifiedData) {
    const total = (goal.tasks || []).length;
    const done = (goal.tasks || []).filter(t => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'goal-card';

    const color = this.getPhaseColor(goal.category);
    const phaseLabel = this.getPhaseLabel(goal.category);

    const sourceChips = this.buildSourceChips(goal, unifiedData);

    card.innerHTML = `
      <div class="goal-title">
        <span style="border-left:3px solid ${color};padding-left:8px;">${this.escapeHtml(goal.title)}</span>
        <button class="task-delete" onclick="window.goalsView?.deleteGoal('${goal.id}')">✕</button>
      </div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:6px;">
        ${goal.month ? `📅 ${goal.month} · ` : ''}${this.escapeHtml(goal.projectName || 'No project')} · ${this.escapeHtml(phaseLabel)}${goal.tool ? ` · ${this.escapeHtml(goal.tool)}` : ''}${goal.taskDuration ? ` · ${this.escapeHtml(goal.taskDuration)}h tasks` : ''}
      </div>
      ${sourceChips.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">${sourceChips.join('')}</div>` : ''}
      ${goal.desc ? `<div class="goal-desc">${this.escapeHtml(goal.desc)}</div>` : ''}
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;background:${color};"></div></div>
      <div class="progress-label">${done}/${total} tasks · ${pct}%</div>
      <div class="task-list" id="tasks-${goal.id}"></div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <input type="text" placeholder="New task…" id="new-task-${goal.id}" style="flex:1;font-size:.78rem;" onkeydown="if(event.key==='Enter')window.goalsView?.addTask('${goal.id}')" />
        <button class="btn btn-primary" style="padding:5px 10px;font-size:.75rem;" onclick="window.goalsView?.addTask('${goal.id}')">+</button>
      </div>`;

    container.appendChild(card);
    this.renderTaskList(goal);
  }

  buildSourceChips(goal, unifiedData) {
    const chips = [];

    if (goal.roadmapLevelId) {
      const level = (unifiedData.levels || []).find(l => l.id === goal.roadmapLevelId);
      chips.push(`<span class="badge badge-accent">Level: ${this.escapeHtml(level ? `Tier ${level.tier}` : goal.roadmapLevelId)}</span>`);
    }

    if (goal.noteSource) {
      const noteExists = this.validateNoteSource(goal.noteSource, unifiedData.notes || []);
      if (noteExists) {
        const noteName = goal.noteSource.split('/').pop();
        chips.push(`<span class="badge">📝 Note: ${this.escapeHtml(noteName)}</span>`);
      } else {
        chips.push(`<span class="badge" style="background:var(--warn);color:#000;">⚠️ Note missing: ${this.escapeHtml(goal.noteSource.split('/').pop())}</span>`);
      }
    }

    if (goal.aiTaskSource) {
      chips.push('<span class="badge">🤖 From AI</span>');
    }

    return chips;
  }

  validateNoteSource(noteSource, notes) {
    if (!noteSource || !Array.isArray(notes)) return false;
    return notes.some(note => note.path === noteSource || note.relativePath === noteSource);
  }

  renderTaskList(goal) {
    const container = document.getElementById('tasks-' + goal.id);
    if (!container) return;
    container.innerHTML = '';
    
    const tasks = (goal.tasks || []).slice().sort((a, b) => Number(!!b.priority) - Number(!!a.priority));
    
    tasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item' + (task.done ? ' done' : '') + (task.priority ? ' priority-task' : '');
      item.innerHTML = `
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="window.goalsView?.toggleTask('${goal.id}','${task.id}',this.checked)" />
        <button class="task-delete" title="Toggle priority" onclick="window.goalsView?.toggleTaskPriority('${goal.id}','${task.id}')">${task.priority ? '★' : '☆'}</button>
        <span>${this.escapeHtml(task.text)}</span>
        <button class="task-delete" onclick="window.goalsView?.deleteTask('${goal.id}','${task.id}')">✕</button>`;
      container.appendChild(item);
    });
  }

  getPhaseColor(category) {
    const colorMap = {
      'planning': '#6366f1',
      'development': '#38bdf8',
      'testing': '#22c55e',
      'deployment': '#f59e0b',
      'maintenance': '#94a3b8'
    };
    return colorMap[category] || '#6366f1';
  }

  getPhaseLabel(category) {
    const labelMap = {
      'planning': 'Planning',
      'development': 'Development',
      'testing': 'Testing',
      'deployment': 'Deployment',
      'maintenance': 'Maintenance'
    };
    return labelMap[category] || 'Uncategorized';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  addTask(goalId) {
    const input = document.getElementById(`new-task-${goalId}`);
    if (!input || !input.value.trim()) return;

    const unifiedData = this.stateEngine.getUnifiedDashboard();
    const goal = (unifiedData.goals || []).find(g => g.id === goalId);
    if (!goal) return;

    if (!goal.tasks) goal.tasks = [];
    goal.tasks.push({
      id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text: input.value.trim(),
      done: false,
      priority: false
    });

    this.stateEngine.saveGoal(goal);
    input.value = '';
    this.renderTaskList(goal);
  }

  toggleTask(goalId, taskId, done) {
    const unifiedData = this.stateEngine.getUnifiedDashboard();
    const goal = (unifiedData.goals || []).find(g => g.id === goalId);
    if (!goal) return;

    const task = (goal.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    task.done = done;
    this.stateEngine.saveGoal(goal);
    this.renderTaskList(goal);
  }

  toggleTaskPriority(goalId, taskId) {
    const unifiedData = this.stateEngine.getUnifiedDashboard();
    const goal = (unifiedData.goals || []).find(g => g.id === goalId);
    if (!goal) return;

    const task = (goal.tasks || []).find(t => t.id === taskId);
    if (!task) return;

    task.priority = !task.priority;
    this.stateEngine.saveGoal(goal);
    this.renderTaskList(goal);
  }

  deleteTask(goalId, taskId) {
    const unifiedData = this.stateEngine.getUnifiedDashboard();
    const goal = (unifiedData.goals || []).find(g => g.id === goalId);
    if (!goal) return;

    goal.tasks = (goal.tasks || []).filter(t => t.id !== taskId);
    this.stateEngine.saveGoal(goal);
    this.renderTaskList(goal);
  }

  deleteGoal(goalId) {
    if (!confirm('Delete this goal and all its tasks?')) return;
    this.stateEngine.deleteGoal(goalId);
    this.render('goals-grid', this.getCurrentFilters());
  }

  getCurrentFilters() {
    const monthFilter = document.getElementById('goal-month-filter');
    return {
      month: monthFilter ? monthFilter.value : '',
      projectName: this.stateEngine.getSelectedProject ? this.stateEngine.getSelectedProject() : ''
    };
  }
}

export { GoalsView };
