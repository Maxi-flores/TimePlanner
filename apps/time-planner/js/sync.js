import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInAnonymously,
  linkWithCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

class PlannerSyncEngine {
  constructor(firebaseConfig) {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.user = null;
    this.unsubscribeSnapshot = null;
    this.stateEngine = null;

    if (firebaseConfig && !this.isPlaceholderConfig(firebaseConfig)) {
      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.configureAuth();
    }
  }

  isPlaceholderConfig(config) {
    return Object.values(config || {}).some(v => typeof v === "string" && v.startsWith("YOUR_"));
  }

  async configureAuth() {
    if (!this.auth) return;
    await setPersistence(this.auth, browserLocalPersistence);
    this.bindAuthChanges();
  }

  bindAuthChanges() {
    if (!this.auth) return;
    onAuthStateChanged(this.auth, async (user) => {
      if (!user) {
        await signInAnonymously(this.auth);
        return;
      }
      this.user = user;
      await this.subscribeToCloudState(user.uid);
    });
  }

  async subscribeToCloudState(uid) {
    if (!this.db || !uid) return;

    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }

    const docRef = doc(this.db, "users", uid, "plannerState", "main");

    this.unsubscribeSnapshot = onSnapshot(docRef, async (snap) => {
      const cloudData = snap.exists() ? snap.data() : null;

      if (this.stateEngine && this.stateEngine.userState) {
        const localState = this.stateEngine.userState;

        if (cloudData) {
          const mergedState = this.mergeState(localState, cloudData);
          this.stateEngine.userState = mergedState;
        }

        await this.pushToCloud();
      } else {
        if (cloudData && typeof window !== "undefined" && window.PlannerSync) {
          const plannerSync = window.PlannerSync;
          const applyCloudPayloadToLocal = plannerSync.applyCloudPayloadToLocal;
          if (typeof applyCloudPayloadToLocal === "function") {
            applyCloudPayloadToLocal(cloudData);
          }
        }

        if (!cloudData || this.hasLocalData()) {
          await this.pushToCloud();
        }
      }
    });
  }

  mergeState(localState, cloudData) {
    const mergeFields = [
      'goals',
      'events',
      'milestones',
      'proposedNotes',
      'roadmapNotes',
      'projectPhaseItems',
      'deploymentNotes',
      'syncedNotesQueue'
    ];

    const merged = {};
    
    mergeFields.forEach(field => {
      merged[field] = this.mergeLists(localState[field] || [], cloudData[field] || []);
    });

    merged.blocks = this.mergeBlocks(localState.blocks || {}, cloudData.blocks || {});
    merged.projectTools = { ...(cloudData.projectTools || {}), ...(localState.projectTools || {}) };

    return merged;
  }

  mergeLists(localList, cloudList) {
    const local = Array.isArray(localList) ? localList : [];
    const cloud = Array.isArray(cloudList) ? cloudList : [];
    const byId = new Map();

    cloud.forEach(item => {
      const key = item?.id || item?.roadmapLevelId;
      if (key != null) byId.set(key, item);
    });

    local.forEach(item => {
      const key = item?.id || item?.roadmapLevelId;
      if (key != null) byId.set(key, item);
    });

    return Array.from(byId.values());
  }

  mergeBlocks(localBlocks, cloudBlocks) {
    const out = { ...(cloudBlocks || {}) };
    Object.keys(localBlocks || {}).forEach(date => {
      out[date] = this.mergeLists(localBlocks[date], out[date]);
    });
    return out;
  }

  hasLocalData() {
    if (typeof window === "undefined" || !window.PlannerSync) return false;
    const plannerSync = window.PlannerSync;
    const buildPayload = plannerSync.buildPayload;
    if (typeof buildPayload !== "function") return false;
    const payload = buildPayload();
    return (
      (payload.goals && payload.goals.length > 0) ||
      (payload.events && payload.events.length > 0) ||
      (payload.milestones && payload.milestones.length > 0)
    );
  }

  async pushToCloud() {
    if (!this.db || !this.user) return;

    let payload;
    if (this.stateEngine && this.stateEngine.userState) {
      const localState = this.stateEngine.userState;
      const flatTasks = (localState.goals || []).flatMap(goal =>
        (goal.tasks || []).map(task => ({
          ...task,
          goalId: goal.id,
          projectName: goal.projectName || ""
        }))
      );

      payload = {
        goals: localState.goals || [],
        tasks: flatTasks,
        milestones: localState.milestones || [],
        events: localState.events || [],
        blocks: localState.blocks || {},
        proposedNotes: localState.proposedNotes || [],
        projectTools: localState.projectTools || {},
        roadmapNotes: localState.roadmapNotes || [],
        projectPhaseItems: localState.projectPhaseItems || [],
        deploymentNotes: localState.deploymentNotes || [],
        syncedNotesQueue: localState.syncedNotesQueue || [],
        roadmapProgress: {
          levelAssignments: {},
          projectPhaseChecks: {}
        },
        settings: {},
        acceptedAIActions: [],
        clientUpdatedAt: Date.now()
      };
    } else if (typeof window !== "undefined" && window.PlannerSync) {
      const plannerSync = window.PlannerSync;
      const buildPayload = plannerSync.buildPayload;
      if (typeof buildPayload === "function") {
        payload = buildPayload();
      } else {
        return;
      }
    } else {
      return;
    }

    const docRef = doc(this.db, "users", this.user.uid, "plannerState", "main");
    await setDoc(docRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }

  async upgradeAnonymousAccount(googleCredential) {
    if (!this.auth || !this.user || !this.user.isAnonymous) {
      throw new Error("No anonymous user to upgrade");
    }

    try {
      const result = await linkWithCredential(this.user, googleCredential);
      this.user = result.user;
      return {
        success: true,
        user: {
          uid: result.user.uid,
          displayName: result.user.displayName,
          email: result.user.email,
          isAnonymous: false
        }
      };
    } catch (error) {
      console.error("Account linking failed:", error);
      throw error;
    }
  }

  async signInWithGoogle() {
    if (!this.auth) throw new Error("Firebase auth not configured");
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    return result.user;
  }

  async signOut() {
    if (!this.auth) return;
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    await signOut(this.auth);
  }

  setStateEngine(stateEngine) {
    this.stateEngine = stateEngine;
  }
}

export { PlannerSyncEngine };
