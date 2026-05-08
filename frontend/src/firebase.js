import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

function firebaseConfigFromEnv() {
  return {
    apiKey: (process.env.REACT_APP_FIREBASE_API_KEY || '').trim(),
    authDomain: (process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '').trim(),
    projectId: (process.env.REACT_APP_FIREBASE_PROJECT_ID || '').trim(),
    storageBucket: (process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '').trim(),
    messagingSenderId: (process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
    appId: (process.env.REACT_APP_FIREBASE_APP_ID || '').trim(),
    measurementId: (process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || '').trim() || undefined,
  };
}

/**
 * Single Firebase app instance, or null if env is not configured.
 * Web API keys are not secret; still keep them in env so builds stay flexible.
 */
export function getFirebaseApp() {
  const cfg = firebaseConfigFromEnv();
  if (!cfg.apiKey || !cfg.projectId) {
    return null;
  }
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(cfg);
}

/** Firebase Auth instance, or null if web SDK env is incomplete. */
export function getFirebaseAuth() {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

/**
 * Google sign-in via Firebase client SDK. Returns an ID token for
 * POST /api/auth/firebase (core-api verifies with Firebase Admin).
 */
export async function signInWithGoogleFirebaseAndGetIdToken() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase web config missing (REACT_APP_FIREBASE_*).');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken(true);
}

/**
 * Analytics only in supported browsers; resolves null otherwise.
 */
export async function initFirebaseAnalytics() {
  const app = getFirebaseApp();
  if (!app) return null;
  if (typeof window === 'undefined') return null;
  try {
    if (!(await isSupported())) return null;
    return getAnalytics(app);
  } catch {
    return null;
  }
}
