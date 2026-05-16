import React from 'react';
import { motion } from 'framer-motion';

export default function PCGrid({ tiers, selectedPCs, onTogglePC }) {
  if (!tiers || tiers.length === 0) {
    return (
      <div className="empty">
        <div className="empty-mark"><span className="spin-square" /></div>
        <h3 style={{ marginBottom: 8 }}>КОМПЬЮТЕР ОЛДСОНГҮЙ</h3>
        <p className="label">ЭНЭ САЛБАРТ КОМПЬЮТЕР АЛГА</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {tiers.map((tierGroup, tierIdx) => {
        const tierName = tierGroup.tier.name;
        const tagClass = tierName === 'VIP' ? 'tag-vip' : 'tag-zaal';
        const available = tierGroup.pcs.filter((p) => p.is_available).length;
        const total = tierGroup.pcs.length;

        return (
          <motion.div
            key={tierName}
            className="tier-section"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: tierIdx * 0.1 }}
          >
            <div className="tier-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`tag ${tagClass}`}>// {tierName === 'Zaal' ? 'ЗААЛ' : tierName} АНГИ</span>
                <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'none' }}>
                  {tierGroup.tier.gpu} · {tierGroup.tier.ram} · {tierGroup.tier.cpu}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="label">
                  <span className={available > 0 ? 'dot live' : 'dot dead'} />
                  {available}/{total} СУЛ
                </span>
                <span className="display" style={{ color: 'var(--red)', fontSize: 18 }}>
                  ₮{parseFloat(tierGroup.tier.price_per_hour).toLocaleString()}<span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'normal', letterSpacing: '0.2em' }}>/ЦАГ</span>
                </span>
              </div>
            </div>

            <div className="pc-grid">
              {tierGroup.pcs.map((pc) => {
                const isSelected = selectedPCs.includes(pc.id);
                const isAvailable = pc.is_available;
                let className = 'pc-seat';
                if (isSelected) className += ' selected';
                else if (isAvailable) className += ' available';
                else className += ' occupied';

                return (
                  <motion.div
                    key={pc.id}
                    className={className}
                    onClick={() => isAvailable && onTogglePC(pc.id)}
                    title={isAvailable ? `${pc.label} :: ${isSelected ? 'СОНГОЛТЫГ ЦУЦЛАХ' : 'СОНГОХ'}` : 'ЗАХИАЛГАТАЙ'}
                    whileHover={isAvailable ? { scale: 1.02, translateY: -2 } : {}}
                    whileTap={isAvailable ? { scale: 0.96 } : {}}
                    animate={isSelected ? { borderColor: 'var(--red)', boxShadow: '0 0 15px var(--red-glow)' } : {}}
                  >
                    <span className="pc-seat-label">#{pc.label.replace(/[^0-9]/g, '') || pc.label}</span>
                    <span className="pc-seat-status">
                      {isSelected ? '◆ СОНГОСОН' : isAvailable ? 'СУЛ' : 'БАНД'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
