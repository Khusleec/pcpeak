import React, { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Map, Terminal, Database, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CafeMap = lazy(() => import('../components/CafeMap'));

export default function HomePage() {
  const { user } = useAuth();
  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="container" style={{ position: 'relative' }}>
          <div className="corner-mark tl" />
          <div className="corner-mark tr" />

          <div className="hero-eyebrow">
            <span className="dot live" />
            <span>// СИСТЕМ::НЭЭЛТТЭЙ</span>
            <span className="spin-square" style={{ marginLeft: 6 }} />
            <span style={{ color: 'var(--text-dim)' }}>УБ::47.9184°N 106.9177°E</span>
          </div>

          <h1 className="hero-title">
            PC<span className="accent">//</span>PEAK<br />
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ЗАХИАЛГЫН_</span>
            <span className="accent">ТЕРМИНАЛ</span>
          </h1>

          <p className="hero-sub">
            ӨНДӨР ХУЧИН ЧАДАЛТАЙ ГЕЙМИНГ КОМПЬЮТЕРИЙН СҮЛЖЭЭ. 8 САЛБАР. ЗААЛ БА VIP АНГИЙН ТЕХНИК.
            НЭГ УДААД ОЛОН КОМПЬЮТЕР ЗАХИАЛАХ БОЛОМЖТОЙ. AI ТУСЛАГЧТАЙ.
          </p>

          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            <Link to="/map" className="btn btn-primary">
              <Map size={11} /> САЛБАРУУДЫГ ҮЗЭХ <ArrowRight size={11} />
            </Link>
            <Link to="/tournaments" className="btn btn-ghost" style={{ marginLeft: -1 }}>
              <Trophy size={11} /> ТЭМЦЭЭН
            </Link>
            {user ? (
              <Link to="/bookings" className="btn btn-ghost" style={{ marginLeft: -1 }}>
                <Database size={11} /> МИНИЙ ЗАХИАЛГА
              </Link>
            ) : (
              <Link to="/login" className="btn btn-ghost" style={{ marginLeft: -1 }}>
                <Terminal size={11} /> НЭВТРЭХ
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 48 }}>
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// 002 — СИСТЕМИЙН БОЛОМЖ</div>
            <h2 className="section-title">ҮЙЛЧИЛГЭЭ</h2>
          </div>
          <span className="section-meta">03_МОДУЛЬ // БҮГД АЖИЛЛАГААТАЙ</span>
        </div>

        <div className="feature-grid">
          <div className="feature-tile">
            <div className="feature-tile-num">// 01</div>
            <h3>ГАЗРЫН<br />ЗУРАГ</h3>
            <p>ИНТЕРАКТИВ ГАЗРЫН ЗУРАГ. БОДИТ ЦАГИЙН СОЛБИЦОЛ. ШУУД ХАНДАХ БОЛОМЖТОЙ.</p>
          </div>
          <div className="feature-tile">
            <div className="feature-tile-num">// 02</div>
            <h3>ОЛОН<br />ЗАХИАЛГА</h3>
            <p>НЭГ УДААД N-КОМПЬЮТЕР ЗАХИАЛАХ. ДАВХАРДАЛ ШАЛГАХ. АТОМ-ТҮВШНИЙ БҮРТГЭЛ.</p>
          </div>
          <div className="feature-tile">
            <div className="feature-tile-num">// 03</div>
            <h3>AI<br />ТУСЛАГЧ</h3>
            <p>МОНГОЛ ХЭЛЭЭР ХАРИЛЦАХ. ХЭРЭГСЛҮҮД АШИГЛАНА. ШУУД ГҮЙЦЭТГЭНЭ.</p>
          </div>
        </div>
      </section>

      {/* Map Preview */}
      <section className="container" style={{ paddingBottom: 64 }}>
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// 003 — БАЙРШИЛ</div>
            <h2 className="section-title">САЛБАРУУДЫН ЗУРАГ</h2>
          </div>
          <span className="section-meta">
            <span className="dot live" /> ШУУД_ХОЛБОЛТ // УЛААНБААТАР.MN
          </span>
        </div>
        <Suspense fallback={<div className="skeleton" style={{ height: 480 }} />}>
          <CafeMap />
        </Suspense>
      </section>
    </div>
  );
}
