import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';

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
 * Full-page redirect flow (avoids signInWithPopup + Cross-Origin-Opener-Policy issues on Vercel / strict headers).
 */
export async function startSignInWithGoogleRedirect() {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase web config missing (REACT_APP_FIREBASE_*).');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(auth, provider);
}

/**
 * After returning from Google/Firebase redirect, exchange ID token for app JWT.
 * No-op (resolves null) if this load was not finishing a redirect sign-in.
 */
export async function completeGoogleRedirectSignIn(apiClient) {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  const idToken = await result.user.getIdToken(true);
  const { data } = await apiClient.post('/auth/firebase', { idToken });
  return data;
}

/** Clear Firebase Auth session (call on app logout). */
export async function signOutFirebase() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
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
