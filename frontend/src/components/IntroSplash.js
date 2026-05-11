import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'rigup_intro_session_v1';

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function readShouldPlay() {
  if (typeof window === 'undefined') return false;
  if (prefersReducedMotion()) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return true;
  }
}

/** ~3s smooth boot sequence — terminal aesthetic; once per tab session. */
export default function IntroSplash() {
  const showIntro = useMemo(() => readShouldPlay(), []);
  const [phase, setPhase] = useState(() => (showIntro ? 'run' : 'gone'));

  useEffect(() => {
    if (!showIntro) return undefined;

    /* Exit starts so fade completes exactly at 3s (smooth handoff to app). */
    const exitTimer = setTimeout(() => setPhase('exit'), 2280);
    const hideTimer = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
      setPhase('gone');
    }, 3000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [showIntro]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`intro-splash${phase === 'exit' ? ' intro-splash--exit' : ''}${phase === 'run' ? ' intro-splash--run' : ''}`}
      role="presentation"
      aria-hidden="true"
    >
      <div className="intro-splash__grid" />
      <div className="intro-splash__scanlines" aria-hidden />
      <div className="intro-splash__frame">
        <div className="corner-mark tl" />
        <div className="corner-mark tr" />
        <div className="corner-mark bl" />
        <div className="corner-mark br" />

        <div className="intro-splash__inner">
          <div className="intro-splash__eyebrow">
            <span className="dot live" />
            <span>// BOOT_SEQUENCE · OK</span>
            <span className="spin-square" aria-hidden />
          </div>

          <div className="intro-splash__brand">
            <span className="intro-splash__mark" aria-hidden />
            <span className="intro-splash__title">
              PC<span className="accent">//</span>PEAK
            </span>
          </div>

          <p className="intro-splash__tag mono">DEPLOYMENT_TERMINAL · HANDSHAKE_SYNC</p>
          <div className="intro-splash__coords mono">47.9184°N · 106.9177°E · UB_GRID</div>

          <div className="intro-splash__progress" aria-hidden>
            <div className="intro-splash__progress-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
