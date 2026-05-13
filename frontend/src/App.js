import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const MapPage = lazy(() => import('./pages/MapPage'));
const CafeDetailPage = lazy(() => import('./pages/CafeDetailPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage'));
const CreateTournamentPage = lazy(() => import('./pages/CreateTournamentPage'));
const EditTournamentPage = lazy(() => import('./pages/EditTournamentPage'));

function LoadingFallback() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="spin-square" aria-hidden />
      <div>
        <div className="app-loading__label">Систем ачаалж байна</div>
        <div className="mono" style={{ marginTop: 8, fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.12em', textAlign: 'center' }}>
          PC//PEAK · хуудас ачаалж байна
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
      />
      <Navbar />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/cafe/:id" element={<CafeDetailPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/tournaments/new" element={<CreateTournamentPage />} />
          <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          <Route path="/tournaments/:id/edit" element={<EditTournamentPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Suspense>
      <ChatWidget />
    </>
  );
}
