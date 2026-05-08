import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OAuth redirect URL үлдээлт — одоо зөвхөн Firebase Google нэвтрэлт ашиглана.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true, state: { fromLegacyOAuth: true } });
  }, [navigate]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />
        <div className="login-eyebrow" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <span className="dot live" />
          <span>// ШИЛЖИЖ БАЙНА</span>
        </div>
        <h1>НЭВТРЭЛТ<span className="blink">...</span></h1>
      </div>
    </div>
  );
}
