import React, { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';

const CafeMap = lazy(() => import('../components/CafeMap'));

export default function HomePage() {
  return (
    <motion.div
      className="map-home-route"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{ width: '100%', height: '100vh', position: 'relative' }}
    >
      <Suspense fallback={
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <div className="spin-square" style={{ width: 24, height: 24, borderColor: 'var(--red)' }} />
        </div>
      }>
        <CafeMap fullscreen={true} />
      </Suspense>
    </motion.div>
  );
}
