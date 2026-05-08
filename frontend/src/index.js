import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { getFirebaseApp, initFirebaseAnalytics } from './firebase';
import 'leaflet/dist/leaflet.css';
import './styles/index.css';

// CRA inlines REACT_APP_* at build time. Use ?debugEnv=1 to see what this deploy embedded.
if (typeof window !== 'undefined' && window.location.search.includes('debugEnv=1')) {
  // eslint-disable-next-line no-console -- intentional env probe
  console.log('REACT_APP_API_URL', process.env.REACT_APP_API_URL);
  // eslint-disable-next-line no-console
  console.log('REACT_APP_FIREBASE_PROJECT_ID', process.env.REACT_APP_FIREBASE_PROJECT_ID);
}

getFirebaseApp();
initFirebaseAnalytics().catch(() => {});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
