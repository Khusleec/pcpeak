import React from 'react';
import { Zap } from 'lucide-react';

export default function BookingSummary({ selectedPCs, tiers, startsAt, endsAt, onBook, loading, paymentsMode = 'local' }) {
  if (!selectedPCs.length) return null;

  const pcDetails = [];
  for (const tierGroup of tiers) {
    for (const pc of tierGroup.pcs) {
      if (selectedPCs.includes(pc.id)) {
        pcDetails.push({ ...pc, tier: tierGroup.tier });
      }
    }
  }

  const hours = startsAt && endsAt
    ? (new Date(endsAt) - new Date(startsAt)) / 3600000
    : 1;

  const total = pcDetails.reduce((sum, pc) => sum + parseFloat(pc.tier.price_per_hour) * hours, 0);
  const deposit = total * 0.3;

  return (
    <div className="booking-summary">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--red)' }}>
        <span className="label label-red">// ЗАХИАЛГЫН ХУРААНГУЙ</span>
        <span className="dot alert" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>СОНГОСОН — {pcDetails.length} КОМПЬЮТЕР</div>
        {pcDetails.map((pc) => (
          <div key={pc.id} className="summary-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`tag ${pc.tier.name === 'VIP' ? 'tag-vip' : 'tag-zaal'}`} style={{ padding: '2px 6px' }}>{pc.tier.name === 'Zaal' ? 'ЗААЛ' : pc.tier.name}</span>
              <span style={{ color: 'var(--text)' }}>№ {pc.label}</span>
            </span>
            <span className="mono" style={{ color: 'var(--text)', textTransform: 'none', fontSize: 10 }}>
              ₮{Math.round(parseFloat(pc.tier.price_per_hour) * hours).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="summary-row">
        <span>ХУГАЦАА</span>
        <span className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>{hours.toFixed(1)} ЦАГ</span>
      </div>
      <div className="summary-row">
        <span>ТОО</span>
        <span className="mono" style={{ color: 'var(--text)', textTransform: 'none' }}>×{pcDetails.length}</span>
      </div>

      <div className="summary-total">
        <span className="summary-total-label">// НИЙТ ҮНЭ</span>
        <span className="summary-total-value">₮{Math.round(total).toLocaleString()}</span>
      </div>
      <div className="summary-row" style={{ marginBottom: 12 }}>
        <span>30% БАРЬЦАА</span>
        <span className="mono" style={{ color: 'var(--amber)', textTransform: 'none', fontWeight: 700 }}>
          ₮{Math.round(deposit).toLocaleString()}
        </span>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={onBook}
        disabled={loading || !startsAt || !endsAt}
      >
        <Zap size={11} />{' '}
        {loading ? 'ИЛГЭЭЖ БАЙНА...' : paymentsMode === 'qpay' ? '30% БАРЬЦААГААР ЗАХИАЛАХ (QPay)' : 'ЗАХИАЛАХ'}
      </button>

      {paymentsMode !== 'qpay' && (
        <p className="label" style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Төлбөрийн горим: орон нутгийн (QPay тохируулаагүй). Захиалга шууд баталгаажина — «Миний захиалга»-д төлбөрийн товч гарахгүй.
        </p>
      )}

      {(!startsAt || !endsAt) && (
        <p className="label" style={{ textAlign: 'center', marginTop: 12, color: 'var(--amber)' }}>
          ⚠ ЦАГАА СОНГОНО УУ
        </p>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line-bright)' }}>
        <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'none' }}>
          АЮУЛГҮЙ ХОЛБОЛТ // АВТОМАТ БАТАЛГААЖУУЛАЛТ
        </span>
      </div>
    </div>
  );
}
