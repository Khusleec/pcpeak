import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import ChatWidget from './components/ChatWidget';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const BookingWizard = lazy(() => import('./pages/BookingWizard'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'));
const CafesPage = lazy(() => import('./pages/CafesPage'));
const TournamentDetailPage = lazy(() => import('./pages/TournamentDetailPage'));
const CreateTournamentPage = lazy(() => import('./pages/CreateTournamentPage'));
const EditTournamentPage = lazy(() => import('./pages/EditTournamentPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
  const location = useLocation();

  return (
    <div className="app-root">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          },
        }}
      />
      <Navbar />
      <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="route-main"
          >
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/cafes" element={<CafesPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cafe/:id/book" element={<BookingWizard />} />
              <Route path="/bookings" element={<BookingsPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/new" element={<CreateTournamentPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/tournaments/:id/edit" element={<EditTournamentPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <ChatWidget />
    </div>
  );
}
