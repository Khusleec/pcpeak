import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Power, Map, Database, Terminal, Trophy } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (p) => {
    if (p === '/tournaments') return location.pathname.startsWith('/tournaments') ? 'active' : '';
    return location.pathname === p ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-mark" />
          MONGOL<span className="navbar-brand-divider">//</span>PC
          <span className="mono" style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 10, letterSpacing: '0.06em' }}>v1.0.0</span>
        </Link>

        <div className="navbar-links">
          <Link to="/map" className={isActive('/map')}><Map size={11} /> САЛБАРУУД</Link>
          <Link to="/tournaments" className={isActive('/tournaments')}><Trophy size={11} /> ТЭМЦЭЭН</Link>
          {user && <Link to="/bookings" className={isActive('/bookings')}><Database size={11} /> ЗАХИАЛГА</Link>}
        </div>

        <div className="navbar-user">
          {user ? (
            <>
              <Link
                to="/profile"
                className={`navbar-user-link ${isActive('/profile')}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                title="Профайл харах"
              >
                <span className="dot live" />
                <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none' }}>
                  {user.display_name?.toUpperCase() || 'ХЭРЭГЛЭГЧ'}
                </span>
                {user.avatar_url && (
                  <img src={user.avatar_url} alt="" className="navbar-avatar" />
                )}
              </Link>
              <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 12px' }}>
                <Power size={11} /> ГАРАХ
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              <Terminal size={11} /> НЭВТРЭХ
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
