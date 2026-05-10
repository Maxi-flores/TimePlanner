# Modern Sync Modules

## Overview

This directory contains the modern sync architecture for the TimePlanner application, featuring anonymous authentication with automatic cloud sync and intelligent data merging to prevent data loss across devices.

## Modules

### `sync.js` - PlannerSyncEngine
Core synchronization engine with Firebase integration.

**Key Features:**
- Automatic anonymous authentication (signs in immediately if no user)
- Browser local persistence (`browserLocalPersistence`)
- 2-way merge strategy (never overwrites local data)
- Account linking for upgrading anonymous to permanent accounts
- Real-time Firestore synchronization

**Usage:**
```javascript
import { PlannerSyncEngine } from './sync.js';

const syncEngine = new PlannerSyncEngine(firebaseConfig);
syncEngine.setStateEngine(stateEngine);
```

**Anonymous Auth:**
The engine automatically signs in anonymous users when no authenticated session exists:
```javascript
bindAuthChanges() {
  onAuthStateChanged(this.auth, async (user) => {
    if (!user) {
      await signInAnonymously(this.auth);
      return;
    }
    // user is now available
  });
}
```

**Data Merging:**
Local and cloud data are merged using unique IDs to prevent data loss. The merge strategy always prefers local data when IDs match (last-write-wins), ensuring local changes take precedence:
```javascript
mergeLists(localList, cloudList) {
  // 1. Cloud items added to map first
  // 2. Local items added to map (overwriting cloud items with same ID)
  // Result: Local changes always win when IDs conflict
  // Returns unified list with no duplicates
}
```

**Account Linking:**
Upgrade anonymous accounts to permanent Google accounts:
```javascript
await syncEngine.upgradeAnonymousAccount(googleCredential);
```

### `views/goals.js` - GoalsView
Presentation layer for goals with unified dashboard integration.

**Key Features:**
- Reads from `stateEngine.getUnifiedDashboard()`
- Validates note source references
- Visual indicators for missing notes
- Safe error handling

**Usage:**
```javascript
import { GoalsView } from './views/goals.js';

const goalsView = new GoalsView(stateEngine);
goalsView.render('goals-grid', { month: '2026-05', projectName: 'MyProject' });
```

**Note Source Validation:**
Goals with `noteSource` references are validated against the notes pipeline:
```javascript
if (goal.noteSource) {
  const noteExists = this.validateNoteSource(goal.noteSource, unifiedData.notes);
  if (!noteExists) {
    // Display warning badge
  }
}
```

### `state-engine.js` - StateEngine
Bridge between existing localStorage state and modern modules.

**Key Features:**
- Unified dashboard model generation
- Goal CRUD operations
- Automatic localStorage persistence
- Integration with legacy PlannerSync

**Usage:**
```javascript
import { StateEngine } from './state-engine.js';

const stateEngine = new StateEngine();
stateEngine.init(state, dashboardModel, notesIndex);

const unifiedData = stateEngine.getUnifiedDashboard();
```

### `init-modern-sync.js` - Integration
Initialization module that wires everything together.

**Usage:**
Add to your HTML:
```html
<script type="module" src="js/init-modern-sync.js"></script>
```

Or manually initialize:
```javascript
import { initializeModernSync } from './init-modern-sync.js';
await initializeModernSync();
```

## Firebase Configuration

Copy `firebase.example.js` to `firebase.js` and add your Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## Architecture

### Data Flow

```
┌─────────────────┐
│  User Actions   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GoalsView      │◄──────── Renders UI
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  StateEngine    │◄──────── Manages state
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  localStorage   │◄──────── Local cache
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PlannerSync    │◄──────── Sync engine
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Firestore      │◄──────── Cloud storage
└─────────────────┘
```

### Merge Strategy

1. **Cloud receives data:**
   - Merge with local state using unique IDs
   - Never replace entire arrays
   - Preserve both local and cloud entries

2. **Local changes:**
   - Push to cloud after merge
   - Populate empty cloud documents

3. **Conflict resolution:**
   - ID-based deduplication
   - Local changes take precedence for same ID

## Migration from Legacy

The new modules work alongside the existing `sync-engine.js`:

1. Legacy `sync-engine.js` continues to work
2. New modules provide enhanced features
3. Both use the same localStorage keys
4. Gradual migration path available

To fully migrate:

1. Initialize modern sync: `import './init-modern-sync.js'`
2. Replace manual goal rendering with `GoalsView`
3. Use `StateEngine.getUnifiedDashboard()` for data access
4. Retire manual auth calls in favor of automatic anonymous signin

## Security

- Anonymous auth provides immediate cloud backup
- Account linking preserves anonymous session data
- Browser local persistence survives page reloads
- Firestore rules enforce owner-only access

## Testing

Test anonymous auth:
```javascript
console.log(window.modernSync.user);
// Should show anonymous user immediately
```

Test data merging:
```javascript
// Add local goal
window.stateEngine.saveGoal({ id: 'test', title: 'Test Goal', tasks: [] });

// Should appear in cloud within seconds
// Open on another device - should merge, not replace
```

Test account linking:
```javascript
// First sign in with Google to get credential
const provider = new GoogleAuthProvider();
const result = await signInWithPopup(auth, provider);
const credential = GoogleAuthProvider.credentialFromResult(result);

// Then link to anonymous account
await window.modernSync.upgradeAnonymousAccount(credential);
// Anonymous data preserved under new permanent account
```

## Troubleshooting

**Anonymous auth not working:**
- Check Firebase config is valid (not placeholder)
- Verify Firebase Auth is enabled in console
- Check browser console for errors

**Data not syncing:**
- Check network connectivity
- Verify Firestore rules allow writes
- Check `window.modernSync.user` has valid UID

**Merge conflicts:**
- Ensure all items have unique `.id` fields
- Check console for merge warnings
- Verify localStorage and Firestore have expected structure
