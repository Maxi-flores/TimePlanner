import { PlannerSyncEngine } from './sync.js';
import { StateEngine } from './state-engine.js';
import { GoalsView } from './views/goals.js';

async function initializeModernSync() {
  let firebaseConfig;
  
  try {
    const firebaseModule = await import('../firebase.js');
    if (firebaseModule.firebaseReady) {
      firebaseConfig = null;
    } else {
      console.warn('Firebase not configured. Modern sync disabled.');
      return;
    }
  } catch (err) {
    console.warn('Firebase module not found. Using placeholder config.');
    firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
  }

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

    const syncEngine = new PlannerSyncEngine(firebaseConfig);
    syncEngine.setStateEngine(stateEngine);

    const goalsView = new GoalsView(stateEngine);

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
