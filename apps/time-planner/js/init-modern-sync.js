import { PlannerSyncEngine } from './sync.js';
import { StateEngine } from './state-engine.js';
import { GoalsView } from './views/goals.js';

async function initializeModernSync() {
  let firebaseConfig = null;
  
  try {
    const firebaseModule = await import('../firebase.js');
    if (firebaseModule.firebaseReady && firebaseModule.auth) {
      const syncEngine = new PlannerSyncEngine(null);
      syncEngine.auth = firebaseModule.auth;
      syncEngine.db = firebaseModule.db;
      
      const stateEngine = initializeStateEngine();
      syncEngine.setStateEngine(stateEngine);
      
      const goalsView = new GoalsView(stateEngine);
      
      exposeGlobals(syncEngine, stateEngine, goalsView);
      return;
    }
  } catch (err) {
    console.warn('Firebase module not found or not ready:', err);
  }
  
  console.warn('Modern sync disabled: Firebase not configured');
}

function initializeStateEngine() {
  const stateEngine = new StateEngine();
  
  if (typeof window !== 'undefined') {
    if (!window.state) {
      console.warn('Global state not found, using empty state');
      window.state = {
        goals: [],
        events: [],
        blocks: {},
        milestones: [],
        proposedNotes: [],
        projectTools: {},
        roadmapNotes: [],
        projectPhaseItems: [],
        deploymentNotes: [],
        syncedNotesQueue: []
      };
    }
    
    stateEngine.init(
      window.state,
      window.dashboardModel || { projects: [], notes: [], tasks: [], milestones: [], levels: [], timeline: [], categories: [] },
      window.notesIndex || { notes: [], generatedAt: null, noteCount: 0 }
    );
  }
  
  return stateEngine;
}

function exposeGlobals(syncEngine, stateEngine, goalsView) {
  if (typeof window !== 'undefined') {
    window.modernSync = syncEngine;
    window.stateEngine = stateEngine;
    window.goalsView = goalsView;

    console.log('Modern sync modules initialized');
    console.log('- Anonymous auth:', syncEngine.auth ? 'enabled' : 'disabled');
    console.log('- State engine:', stateEngine.userState ? 'ready' : 'not ready');
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initializeModernSync().catch(err => {
      console.error('Failed to initialize modern sync:', err);
    });
  });
}

export { initializeModernSync };
