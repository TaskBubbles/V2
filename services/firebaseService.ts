
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged, User as FirebaseUser, Auth } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, writeBatch, enableIndexedDbPersistence, getDoc, Firestore } from "firebase/firestore";
import { Task, Board } from '../types';

/**
 * FIREBASE CONFIGURATION
 * 
 * To enable Cloud Sync:
 * 1. Create a project at https://console.firebase.google.com/
 * 2. Create a .env file in the root directory based on .env.example
 * 3. Fill in your Firebase credentials in the .env file
 */

// Safe access to environment variables to prevent runtime crashes if import.meta.env is undefined
const getEnv = (key: string) => {
    try {
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            return import.meta.env[key];
        }
    } catch (e) {
        // ignore
    }
    return undefined;
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Internal state
let app = null;
let realAuth: Auth | null = null;
let realDb: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let isInitialized = false;

// Attempt Initialization
try {
    // Check if config keys are present (not empty strings/undefined)
    const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;

    if (hasConfig) {
        app = initializeApp(firebaseConfig);
        realAuth = getAuth(app);
        realDb = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        
        // Attempt persistence
        if (typeof window !== 'undefined') {
            enableIndexedDbPersistence(realDb).catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code === 'unimplemented') {
                    console.warn('The current browser does not support all of the features required to enable persistence');
                }
            });
        }
        isInitialized = true;
    } else {
        console.log("Firebase config missing. App running in Offline Mode (Local Storage only).");
    }

} catch (e) {
    console.warn("Firebase initialization failed:", e);
    isInitialized = false;
}

export const isFirebaseInitialized = () => isInitialized;

export const auth = {
    signInWithGoogle: async () => {
        if (!realAuth || !googleProvider) {
            console.warn("Cannot sign in: Firebase not initialized");
            return null;
        }
        try {
            const result = await signInWithPopup(realAuth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    },
    signOut: () => {
        if (!realAuth) return Promise.resolve();
        return firebaseSignOut(realAuth);
    },
    onAuthStateChanged: (callback: (user: FirebaseUser | null) => void) => {
        if (!realAuth) return () => {};
        return firebaseOnAuthStateChanged(realAuth, callback);
    }
};

export const db = {
    // --- TASKS ---
    
    syncTasks: (userId: string, onTasksReceived: (tasks: Task[]) => void) => {
        if (!realDb) return () => {};
        const q = query(collection(realDb, 'users', userId, 'tasks'));
        return onSnapshot(q, (snapshot) => {
            const tasks: Task[] = [];
            snapshot.forEach((doc) => tasks.push(doc.data() as Task));
            onTasksReceived(tasks);
        }, (error) => console.error("Error syncing tasks:", error));
    },

    saveTask: async (userId: string, task: Task) => {
        if (!realDb) return;
        await setDoc(doc(realDb, 'users', userId, 'tasks', task.id), task);
    },
    
    saveTasksBatch: async (userId: string, tasks: Task[]) => {
        if (!realDb) return;
        const batch = writeBatch(realDb);
        tasks.forEach(task => {
            const ref = doc(realDb, 'users', userId, 'tasks', task.id);
            batch.set(ref, task);
        });
        await batch.commit();
    },

    deleteTask: async (userId: string, taskId: string) => {
        if (!realDb) return;
        await deleteDoc(doc(realDb, 'users', userId, 'tasks', taskId));
    },

    // --- BOARDS ---

    syncBoards: (userId: string, onBoardsReceived: (boards: Board[]) => void) => {
        if (!realDb) return () => {};
        const q = query(collection(realDb, 'users', userId, 'boards'));
        return onSnapshot(q, (snapshot) => {
            const boards: Board[] = [];
            snapshot.forEach((doc) => boards.push(doc.data() as Board));
            if (boards.length > 0) {
               onBoardsReceived(boards);
            }
        }, (error) => console.error("Error syncing boards:", error));
    },

    saveBoard: async (userId: string, board: Board) => {
        if (!realDb) return;
        await setDoc(doc(realDb, 'users', userId, 'boards', board.id), board);
    },

    deleteBoard: async (userId: string, boardId: string, tasksToDelete: string[]) => {
        if (!realDb) return;
        const batch = writeBatch(realDb);
        
        // Delete Board
        batch.delete(doc(realDb, 'users', userId, 'boards', boardId));
        
        // Delete associated tasks
        tasksToDelete.forEach(taskId => {
             batch.delete(doc(realDb, 'users', userId, 'tasks', taskId));
        });

        await batch.commit();
    },

    // --- PREFERENCES (Theme, Sound, etc) ---

    syncPreferences: (userId: string, onPrefsReceived: (prefs: any) => void) => {
        if (!realDb) return () => {};
        return onSnapshot(doc(realDb, 'users', userId, 'settings', 'preferences'), (doc) => {
            if (doc.exists()) {
                onPrefsReceived(doc.data());
            }
        });
    },

    savePreference: async (userId: string, key: string, value: any) => {
        if (!realDb) return;
        await setDoc(doc(realDb, 'users', userId, 'settings', 'preferences'), { [key]: value }, { merge: true });
    },

    // --- MIGRATION UTILS ---

    migrateAllLocalData: async (userId: string, localTasks: Task[], localBoards: Board[], localTheme: string) => {
        if (!realDb) return;

        const userRef = doc(realDb, 'users', userId);
        const userSnap = await getDoc(userRef);

        // If user already exists and has migrated, don't overwrite with local data
        if (userSnap.exists() && userSnap.data().migrated) {
            return; 
        }

        console.log("Migrating local data to cloud...");
        const batch = writeBatch(realDb);

        // 1. Tasks
        localTasks.forEach(task => {
            const ref = doc(realDb, 'users', userId, 'tasks', task.id);
            batch.set(ref, task);
        });

        // 2. Boards
        if (localBoards.length === 0) {
            const b1 = { id: '1', name: 'Main To-Do' };
            const b2 = { id: '2', name: 'Ideas' };
            batch.set(doc(realDb, 'users', userId, 'boards', '1'), b1);
            batch.set(doc(realDb, 'users', userId, 'boards', '2'), b2);
        } else {
            localBoards.forEach(board => {
                const ref = doc(realDb, 'users', userId, 'boards', board.id);
                batch.set(ref, board);
            });
        }

        // 3. Preferences
        batch.set(doc(realDb, 'users', userId, 'settings', 'preferences'), { 
            theme: localTheme,
            migrated: true 
        }, { merge: true });
        
        batch.set(userRef, { migrated: true }, { merge: true });

        await batch.commit();
        console.log("Migration complete.");
    }
};
