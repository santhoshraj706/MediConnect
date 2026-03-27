import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfigDefault from '../firebase-applet-config.json';

// Use configuration from environment if available, otherwise fallback to default
const firebaseConfig = process.env.FIREBASE_CONFIG 
  ? JSON.parse(process.env.FIREBASE_CONFIG) 
  : firebaseConfigDefault;

console.log("Initializing Firebase with project:", firebaseConfig.projectId);

// Initialize Firebase SDK
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore — only pass databaseId if it exists in config
const firestoreSettings: any = {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
};

export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, firestoreSettings);

export const auth = getAuth(app);
