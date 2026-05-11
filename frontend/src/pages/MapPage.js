import React, { lazy, Suspense } from 'react';

const CafeMap = lazy(() => import('../components/CafeMap'));

export default function MapPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="section-eyebrow">// МОДУЛЬ_001 — БАЙРШИЛ</div>
            <h2 className="section-title">САЛБАРУУД</h2>
          </div>
          <span className="section-meta">
            <span className="dot live" /> 08_САЛБАР // ШУУД_ХОЛБОЛТ
          </span>
        </div>

        <Suspense fallback={<div className="skeleton" style={{ height: 520 }} />}>
          <CafeMap />
        </Suspense>

        <div className="map-stats-strip">
          <div className="map-stats-cell" style={{ padding: '14px 18px', borderRight: '1px solid var(--line-bright)' }}>
            <div className="label" style={{ marginBottom: 4 }}>// ХУРД</div>
            <div className="mono" style={{ color: 'var(--emerald)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'none' }}>◆ 12MS // САЙН</div>
          </div>
          <div className="map-stats-cell" style={{ padding: '14px 18px', borderRight: '1px solid var(--line-bright)' }}>
            <div className="label" style={{ marginBottom: 4 }}>// ХАМРАХ ХҮРЭЭ</div>
            <div className="mono" style={{ color: 'var(--text)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'none' }}>УБ::ТӨВ_ХЭСЭГ</div>
          </div>
          <div className="map-stats-cell" style={{ padding: '14px 18px' }}>
            <div className="label" style={{ marginBottom: 4 }}>// ТЕХНОЛОГИ</div>
            <div className="mono" style={{ color: 'var(--text)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'none' }}>CARTO_LIGHT // LEAFLET.JS</div>
          </div>
        </div>
      </div>
    </div>
  );
}
