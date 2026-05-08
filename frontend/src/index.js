import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import 'leaflet/dist/leaflet.css';
import './styles/index.css';

if (typeof window !== 'undefined' && window.location.search.includes('debugEnv=1')) {
  // eslint-disable-next-line no-console -- intentional env probe
  console.log('REACT_APP_API_URL', process.env.REACT_APP_API_URL);
}

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
