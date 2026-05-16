import React, { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Map, Terminal, Database, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const CafeMap = lazy(() => import('../components/CafeMap'));

export default function HomePage() {
  const { user } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero */}
      <section className="hero">
        <div className="container" style={{ position: 'relative' }}>
          <motion.div variants={itemVariants} className="hero-eyebrow">
            <span className="dot live" />
            <span>// СИСТЕМ::НЭЭЛТТЭЙ</span>
            <span className="spin-square" style={{ marginLeft: 6 }} />
            <span style={{ color: 'var(--text-dim)' }}>УБ::47.9184°N 106.9177°E</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="hero-title">
            PC<span className="accent">//</span>PEAK<br />
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>ЗАХИАЛГЫН_</span>
            <span className="accent">ТЕРМИНАЛ</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="hero-sub">
            ӨНДӨР ХУЧИН ЧАДАЛТАЙ ГЕЙМИНГ КОМПЬЮТЕРИЙН СҮЛЖЭЭ. 8 САЛБАР. ЗААЛ БА VIP АНГИЙН ТЕХНИК.
            НЭГ УДААД ОЛОН КОМПЬЮТЕР ЗАХИАЛАХ БОЛОМЖТОЙ. AI ТУСЛАГЧТАЙ.
          </motion.p>

          <motion.div variants={itemVariants} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/map" className="btn btn-primary">
              <Map size={14} /> САЛБАРУУДЫГ ҮЗЭХ <ArrowRight size={14} />
            </Link>
            <Link to="/tournaments" className="btn btn-ghost">
              <Trophy size={14} /> ТЭМЦЭЭН
            </Link>
            {user ? (
              <Link to="/bookings" className="btn btn-ghost">
                <Database size={14} /> МИНИЙ ЗАХИАЛГА
              </Link>
            ) : (
              <Link to="/login" className="btn btn-ghost">
                <Terminal size={14} /> НЭВТРЭХ
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ paddingTop: 80, paddingBottom: 48 }}>
        <motion.div variants={itemVariants} className="section-head">
          <div>
            <div className="section-eyebrow">// 002 — СИСТЕМИЙН БОЛОМЖ</div>
            <h2 className="section-title">ҮЙЛЧИЛГЭЭ</h2>
          </div>
          <span className="section-meta">03_МОДУЛЬ // БҮГД АЖИЛЛАГААТАЙ</span>
        </motion.div>

        <motion.div variants={containerVariants} className="feature-grid" style={{ borderRadius: 12, overflow: 'hidden' }}>
          <motion.div variants={itemVariants} className="feature-tile">
            <div className="feature-tile-num">// 01</div>
            <h3>ГАЗРЫН ЗУРАГ</h3>
            <p>ИНТЕРАКТИВ ГАЗРЫН ЗУРАГ. БОДИТ ЦАГИЙН СОЛБИЦОЛ. ШУУД ХАНДАХ БОЛОМЖТОЙ.</p>
          </motion.div>
          <motion.div variants={itemVariants} className="feature-tile">
            <div className="feature-tile-num">// 02</div>
            <h3>ОЛОН ЗАХИАЛГА</h3>
            <p>НЭГ УДААД N-КОМПЬЮТЕР ЗАХИАЛАХ. ДАВХАРДАЛ ШАЛГАХ. АТОМ-ТҮВШНИЙ БҮРТГЭЛ.</p>
          </motion.div>
          <motion.div variants={itemVariants} className="feature-tile">
            <div className="feature-tile-num">// 03</div>
            <h3>AI ТУСЛАГЧ</h3>
            <p>МОНГОЛ ХЭЛЭЭР ХАРИЛЦАХ. ХЭРЭГСЛҮҮД АШИГЛАНА. ШУУД ГҮЙЦЭТГЭНЭ.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* Map Preview */}
      <section className="container" style={{ paddingBottom: 64 }}>
        <motion.div variants={itemVariants} className="section-head">
          <div>
            <div className="section-eyebrow">// 003 — БАЙРШИЛ</div>
            <h2 className="section-title">САЛБАРУУДЫН ЗУРАГ</h2>
          </div>
          <span className="section-meta">
            <span className="dot live" /> ШУУД_ХОЛБОЛТ // УЛААНБААТАР.MN
          </span>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Suspense fallback={<div className="skeleton" style={{ height: 480, borderRadius: 12 }} />}>
            <CafeMap />
          </Suspense>
        </motion.div>
      </section>
    </motion.div>
  );
}
