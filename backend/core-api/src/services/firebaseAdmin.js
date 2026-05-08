const path = require('path');
const fs = require('fs');

/** True if any supported credential env is set (does not load credentials). */
function isFirebaseAdminConfigured() {
  const p = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  const j = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
  const adc = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  return Boolean(p || j || b64 || adc);
}

let initFailed = null;

function ensureFirebaseAdmin() {
  const admin = require('firebase-admin');
  if (admin.apps.length > 0) return;
  if (initFailed) throw initFailed;

  try {
    const p = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
    const jsonRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();

    if (p) {
      const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      if (!fs.existsSync(resolved)) {
        throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH not found: ${resolved}`);
      }
      const cred = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      return;
    }

    if (jsonRaw) {
      const cred = JSON.parse(jsonRaw);
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      return;
    }

    if (b64) {
      const cred = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      return;
    }

    if ((process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      return;
    }

    throw new Error(
      'Firebase Admin: set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, or GOOGLE_APPLICATION_CREDENTIALS'
    );
  } catch (err) {
    initFailed = err;
    throw err;
  }
}

/**
 * Read `project_id` from service-account material (does not initialize Admin SDK).
 * Use for `/config/public` so the SPA can warn if env project ≠ server project.
 */
function peekFirebaseServiceAccountProjectId() {
  try {
    const p = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
    const jsonRaw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    const b64 = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
    const adc = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();

    let cred = null;
    if (p) {
      const resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      if (!fs.existsSync(resolved)) return null;
      cred = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } else if (jsonRaw) {
      cred = JSON.parse(jsonRaw);
    } else if (b64) {
      cred = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } else if (adc) {
      const resolved = path.isAbsolute(adc) ? adc : path.resolve(process.cwd(), adc);
      if (!fs.existsSync(resolved)) return null;
      cred = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }

    const pid = cred && cred.project_id;
    return pid ? String(pid).trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin').auth.DecodedIdToken>}
 */
async function verifyFirebaseIdToken(idToken) {
  ensureFirebaseAdmin();
  const admin = require('firebase-admin');
  return admin.auth().verifyIdToken(idToken, true);
}

module.exports = {
  isFirebaseAdminConfigured,
  verifyFirebaseIdToken,
  peekFirebaseServiceAccountProjectId,
};
