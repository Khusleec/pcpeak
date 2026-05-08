import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { AlertOctagon } from 'lucide-react';

import {
  getFirebaseApp,
  startSignInWithGoogleRedirect,
  completeGoogleRedirectSignIn,
  friendlyFirebaseClientErrorMessage,
} from '../firebase';

function loginErrorFromQuery(code) {
  if (code === 'oauth_failed' || code === 'google_oauth_misconfigured') {
    return 'Google нэвтрэлт зөвхөн Firebase-ээр. Доорх товчийг ашиглана уу.';
  }
  return '';
}

function messageFromFirebaseAuthError(err, fallback) {
  const clientMsg = friendlyFirebaseClientErrorMessage(err);
  if (clientMsg) return clientMsg;
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  let msg = d.error || fallback;
  if (d.firebaseCode) msg += ` (${d.firebaseCode})`;
  if (d.firebaseIdTokenAudience) msg += ` Токен төсөл (aud): ${d.firebaseIdTokenAudience}.`;
  if (
    d.idTokenAudience &&
    d.serviceAccountProjectId &&
    d.firebaseProjectsAligned === false
  ) {
    msg += ` DEBUG: JWT aud=${d.idTokenAudience}, service account project_id=${d.serviceAccountProjectId}.`;
  }
  return msg;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [firebaseBackendReady, setFirebaseBackendReady] = useState(false);
  const [firebaseProjectHint, setFirebaseProjectHint] = useState('');
  const [firebaseLoading, setFirebaseLoading] = useState(false);
  const [redirectBusy, setRedirectBusy] = useState(true);

  const hasFirebaseWeb = Boolean(getFirebaseApp());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await completeGoogleRedirectSignIn(api);
        if (cancelled) return;
        if (data) {
          login(data.token, data.user);
          navigate('/', { replace: true });
          return;
        }
      } catch (err) {
        if (!cancelled) {
          setError(messageFromFirebaseAuthError(err, 'НЭВТРЭХ АМЖИЛТГҮЙ БОЛЛОО'));
        }
      } finally {
        if (!cancelled) setRedirectBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  useEffect(() => {
    const err = searchParams.get('error');
    const msg = loginErrorFromQuery(err);
    if (msg) {
      setError(msg);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/config/public');
        if (!cancelled) {
          setFirebaseBackendReady(Boolean(data.firebaseAuthBackendReady));
          const web = (process.env.REACT_APP_FIREBASE_PROJECT_ID || '').trim();
          const admin = String(data.firebaseAdminProjectId || '').trim();
          if (web && admin && web !== admin) {
            setFirebaseProjectHint(
              `Vercel дээрх вэбийн төсөл (${web}) ба Railway API service account-ийн төсөл (${admin}) таарахгүй байна. Аль хоёрын Firebase project_id ижил байх ёстой.`
            );
          } else {
            setFirebaseProjectHint('');
          }
        }
      } catch {
        if (!cancelled) setFirebaseBackendReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const firebaseGoogleEnabled = hasFirebaseWeb && firebaseBackendReady;

  const handleFirebaseGoogle = async () => {
    setError('');
    setFirebaseLoading(true);
    try {
      await startSignInWithGoogleRedirect();
    } catch (err) {
      setError(friendlyFirebaseClientErrorMessage(err) || err.message || 'НЭВТРЭХ АМЖИЛТГҮЙ БОЛЛОО');
      setFirebaseLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />

        <div className="login-header">
          <div className="login-eyebrow">
            <span className="dot alert" />
            <span>// НЭВТРЭХ :: FIREBASE_AUTH</span>
          </div>
          <h1>СИСТЕМД<br /><span style={{ color: 'var(--red)' }}>НЭВТРЭХ</span></h1>
          <div className="login-meta">
            &gt; GOOGLE :: БҮРЭН_ХУУДАС_ШИЛЖИЛТ (popup биш, COOP алдагүй)<br />
            &gt; ШИФРЛЭЛТ :: TLS_1.3
          </div>
        </div>

        {firebaseProjectHint && (
          <div
            className="error-box"
            style={{
              marginBottom: 16,
              borderColor: 'rgba(234, 179, 8, 0.55)',
              background: 'rgba(234, 179, 8, 0.08)',
              color: 'var(--text)',
            }}
          >
            <AlertOctagon size={11} /> {firebaseProjectHint}
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            <AlertOctagon size={11} /> АЛДАА :: {error.toUpperCase()}
          </div>
        )}

        {firebaseGoogleEnabled ? (
          <button
            type="button"
            className="btn btn-google"
            style={{ width: '100%' }}
            onClick={handleFirebaseGoogle}
            disabled={firebaseLoading || redirectBusy}
          >
            <svg width="14" height="14" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
              <path fill="#000" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#000" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#000" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#000" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {redirectBusy || firebaseLoading ? 'УНШИЖ БАЙНА…' : 'GOOGLE-ААР НЭВТРЭХ'}
          </button>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 8px', lineHeight: 1.45 }}>
            Зөвхөн Firebase Auth. Вэб: <span className="mono">REACT_APP_FIREBASE_*</span>, API: Firebase Admin түлхүүр; Firebase консолоос Authorized domains тохируулна уу.
          </p>
        )}

        <p style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>
          Шинэ хэрэглэгч үү? Эхний Google нэвтрэлтээр автоматаар бүртгэгдэнэ.{' '}
          <Link to="/register" style={{ color: 'var(--red)' }}>Бүртгэлийн хуудас</Link>
        </p>
      </div>
    </div>
  );
}
