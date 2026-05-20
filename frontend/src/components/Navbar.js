import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Power, Database, Terminal, Trophy, Shield, Menu, X, Map } from 'lucide-react';
import { isStaffRole } from '../utils/roles';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  const isActive = (p) => {
    if (p === '/tournaments') return location.pathname.startsWith('/tournaments') ? 'active' : '';
    if (p === '/admin') return location.pathname.startsWith('/admin') ? 'active' : '';
    return location.pathname === p ? 'active' : '';
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="navbar-wrapper">
      <nav className={`navbar ${isMenuOpen ? 'menu-open' : ''}`}>
        <div className="container">
          <Link to="/" className="navbar-brand" onClick={() => setIsMenuOpen(false)}>
            <span className="navbar-brand-mark" />
            PC<span className="navbar-brand-divider">//</span>PEAK
          </Link>

          {/* Desktop Links */}
          <div className="navbar-links desktop-only">
            <Link to="/cafes" className={isActive('/cafes')}><Map size={14} /> САЛБАРУУД</Link>
            <Link to="/tournaments" className={isActive('/tournaments')}><Trophy size={14} /> ТЭМЦЭЭН</Link>
            {user && <Link to="/bookings" className={isActive('/bookings')}><Database size={14} /> ЗАХИАЛГА</Link>}
            {user && isStaffRole(user.role) && (
              <Link to="/admin" className={isActive('/admin')}><Shield size={14} /> АДМИН</Link>
            )}
          </div>

          <div className="navbar-user">
            {user ? (
              <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary desktop-only" style={{ borderRadius: '20px' }}>
                <Terminal size={14} /> НЭВТРЭХ
              </Link>
            )}
            
            <button className="navbar-mobile-toggle" onClick={toggleMenu} aria-label="Toggle menu">
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isMenuOpen && (
          <div className="navbar-mobile-menu">
            <div className="navbar-mobile-links">
              <Link to="/cafes" className={isActive('/cafes')} onClick={() => setIsMenuOpen(false)}>
                <Map size={18} /> САЛБАРУУД
              </Link>
              <Link to="/tournaments" className={isActive('/tournaments')} onClick={() => setIsMenuOpen(false)}>
                <Trophy size={18} /> ТЭМЦЭЭН
              </Link>
              {user && (
                <Link to="/bookings" className={isActive('/bookings')} onClick={() => setIsMenuOpen(false)}>
                  <Database size={18} /> ЗАХИАЛГА
                </Link>
              )}
              {user && isStaffRole(user.role) && (
                <Link to="/admin" className={isActive('/admin')} onClick={() => setIsMenuOpen(false)}>
                  <Shield size={18} /> АДМИН
                </Link>
              )}
              <Link to="/profile" className={isActive('/profile')} onClick={() => setIsMenuOpen(false)}>
                <Terminal size={18} /> ПРОФАЙЛ
              </Link>
              <div style={{ marginTop: 'auto', padding: '20px 0', borderTop: '1px solid var(--line)' }}>
                {user ? (
                  <button className="btn btn-danger btn-block" onClick={handleLogout}>
                    <Power size={16} /> ГАРАХ
                  </button>
                ) : (
                  <Link to="/login" className="btn btn-primary btn-block" onClick={() => setIsMenuOpen(false)}>
                    <Terminal size={16} /> НЭВТРЭХ
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
