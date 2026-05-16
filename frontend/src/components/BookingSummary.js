import React from 'react';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BookingSummary({ selectedPCs, tiers, startsAt, endsAt, onBook, loading, paymentsMode = 'local' }) {
  if (!selectedPCs.length) return null;

  const depositFlow = paymentsMode === 'qpay' || paymentsMode === 'demo';
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
    <motion.div
      className="booking-summary"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--red)' }}>
        <span className="label label-red">// ЗАХИАЛГЫН ХУРААНГУЙ</span>
        <span className="dot alert" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>СОНГОСОН — {pcDetails.length} КОМПЬЮТЕР</div>
        <AnimatePresence>
          {pcDetails.map((pc) => (
            <motion.div
              key={pc.id}
              className="summary-row"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`tag ${pc.tier.name === 'VIP' ? 'tag-vip' : 'tag-zaal'}`} style={{ padding: '2px 6px' }}>{pc.tier.name === 'Zaal' ? 'ЗААЛ' : pc.tier.name}</span>
                <span style={{ color: 'var(--text)' }}>№ {pc.label}</span>
              </span>
              <span className="mono" style={{ color: 'var(--text)', textTransform: 'none', fontSize: 10 }}>
                ₮{Math.round(parseFloat(pc.tier.price_per_hour) * hours).toLocaleString()}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
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
        <motion.span
          className="summary-total-value"
          key={total}
          initial={{ scale: 1.1, color: '#fff' }}
          animate={{ scale: 1, color: 'var(--red)' }}
        >
          ₮{Math.round(total).toLocaleString()}
        </motion.span>
      </div>
      <div className="summary-row" style={{ marginBottom: 12 }}>
        <span>30% БАРЬЦАА</span>
        <span className="mono" style={{ color: 'var(--amber)', textTransform: 'none', fontWeight: 700 }}>
          ₮{Math.round(deposit).toLocaleString()}
        </span>
      </div>

      <motion.button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={onBook}
        disabled={loading || !startsAt || !endsAt}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Zap size={11} />{' '}
        {loading ? 'ИЛГЭЭЖ БАЙНА...' : depositFlow ? (paymentsMode === 'demo' ? '30% БАРЬЦААГААР ЗАХИАЛАХ (ЖИШЭЭ)' : '30% БАРЬЦААГААР ЗАХИАЛАХ (QPay)') : 'ЗАХИАЛАХ'}
      </motion.button>

      {!depositFlow && (
        <p className="label" style={{ textAlign: 'center', marginTop: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Төлбөрийн горим: орон нутгийн (QPay тохируулаагүй). Захиалга шууд баталгаажуулна — «Миний захиалга» хэсэгт төлбөрийн товч гарахгүй.
        </p>
      )}

      {paymentsMode === 'demo' && (
        <p className="label" style={{ textAlign: 'center', marginTop: 8, color: 'var(--amber)', lineHeight: 1.5 }}>
          PAYMENTS_DEMO_MODE: жинхэнэ QPay биш. Захиалга «төлбөр хүлээгдэж байна» болно; «Миний захиалга»-д баталгаажуулах товч гарна.
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
    </motion.div>
  );
}
