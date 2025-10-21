// Fix: Combined type and value imports to resolve potential module resolution issues.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut,
    type User
} from "firebase/auth";

// Your web app's Firebase configuration
// These values are loaded from environment variables.
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID
};

// Validate that all Firebase config values are present to prevent initialization errors.
const requiredConfigKeys: (keyof typeof firebaseConfig)[] = [
    'apiKey', 'authDomain', 'projectId', 'appId'
];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
    throw new Error(`Firebase configuration is missing required environment variables: ${missingKeys.join(', ')}. Please check your 'frontend/.env' file and ensure all VITE_FIREBASE_* variables are set correctly as per the README.md.`);
}

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, 
    googleProvider, 
    onAuthStateChanged, 
    signInWithPopup, 
    signOut, 
    type User
};