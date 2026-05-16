import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Power, Map, Database, Terminal, Trophy, Shield } from 'lucide-react';
import { isStaffRole } from '../utils/roles';

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
    if (p === '/admin') return location.pathname.startsWith('/admin') ? 'active' : '';
    return location.pathname === p ? 'active' : '';
  };

  return (
    <div className="navbar-wrapper">
      <nav className="navbar">
        <div className="container">
          <Link to="/" className="navbar-brand">
            <span className="navbar-brand-mark" />
            PC<span className="navbar-brand-divider">//</span>PEAK
          </Link>

          <div className="navbar-links">
            <Link to="/map" className={isActive('/map')}><Map size={14} /> САЛБАРУУД</Link>
            <Link to="/tournaments" className={isActive('/tournaments')}><Trophy size={14} /> ТЭМЦЭЭН</Link>
            {user && <Link to="/bookings" className={isActive('/bookings')}><Database size={14} /> ЗАХИАЛГА</Link>}
            {user && isStaffRole(user.role) && (
              <Link to="/admin" className={isActive('/admin')}><Shield size={14} /> АДМИН</Link>
            )}
          </div>

          <div className="navbar-user">
            {user ? (
              <>
                <Link
                  to="/profile"
                  className={`navbar-user-link ${isActive('/profile')}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderRadius: '16px' }}
                  title="Профайл харах"
                >
                  <span className="dot live" />
                  <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none' }}>
                    {user.display_name?.toUpperCase() || 'ХЭРЭГЛЭГЧ'}
                  </span>
                  {user.avatar_url && (
                    <img src={user.avatar_url} alt="" className="navbar-avatar" style={{ borderRadius: '50%' }} />
                  )}
                </Link>
                <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 12px', borderRadius: '20px' }}>
                  <Power size={14} /> ГАРАХ
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary" style={{ borderRadius: '20px' }}>
                <Terminal size={14} /> НЭВТРЭХ
              </Link>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
