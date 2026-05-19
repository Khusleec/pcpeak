const express = require('express');
const pool = require('../db/pool');
const { subscribeCafeInventory } = require('../services/cafeInventoryBus');

const router = express.Router();

// ─── SSE: cafe PC inventory changed (bookings, payments, etc.) ──
// Must be registered before GET /cafe/:cafeId so "events" is not parsed as cafeId.
router.get('/cafe/:cafeId/events', (req, res) => {
  const cafeId = parseInt(req.params.cafeId, 10);
  if (!Number.isFinite(cafeId) || cafeId < 1) {
    return res.status(400).json({ error: 'Салбарын ID буруу байна' });
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  try {
    res.write(`data: ${JSON.stringify({ type: 'hello', cafeId, ts: Date.now() })}\n\n`);
  } catch {
    return;
  }

  const onNotify = (payload) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'inventory', cafeId, ...payload })}\n\n`);
    } catch {
      /* connection closed */
    }
  };

  const unsubscribe = subscribeCafeInventory(cafeId, onNotify);

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(ping);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

// ─── Get All Tiers (must be before /:id-style routes) ───────
router.get('/tiers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pc_tiers ORDER BY price_per_hour');
    res.json(result.rows);
  } catch (err) {
    console.error('Get tiers error:', err);
    res.status(500).json({ error: 'Ангилалын мэдээлэл татаж чадсангүй' });
  }
});

// ─── Get PCs by Cafe (grouped by tier, with real-time availability) ──
router.get('/cafe/:cafeId', async (req, res) => {
  try {
    const { cafeId } = req.params;
    const { starts_at, ends_at } = req.query;

    const pcsResult = await pool.query(
      `SELECT p.id, p.label, p.status, p.cafe_id,
              t.id AS tier_id, t.name AS tier_name, t.gpu, t.ram, t.cpu, t.price_per_hour
       FROM pcs p
       JOIN pc_tiers t ON p.tier_id = t.id
       WHERE p.cafe_id = ?
       ORDER BY t.name, p.label`,
      [cafeId]
    );
    const pcs = pcsResult.rows;

    if (starts_at && ends_at) {
      const conflicts = await pool.query(
        `SELECT DISTINCT bi.pc_id FROM booking_items bi
         JOIN bookings b ON bi.booking_id = b.id
         WHERE b.cafe_id = ? AND b.status IN ('confirmed', 'pending_payment')
           AND b.starts_at < ? AND b.ends_at > ?`,
        [cafeId, ends_at, starts_at]
      );
      const conflictSet = new Set(conflicts.rows.map((r) => r.pc_id));
      for (const pc of pcs) {
        pc.is_available = pc.status === 'available' && !conflictSet.has(pc.id);
      }
    } else {
      for (const pc of pcs) {
        pc.is_available = pc.status === 'available';
      }
    }

    // Group by tier
    const grouped = {};
    for (const pc of pcs) {
      if (!grouped[pc.tier_name]) {
        grouped[pc.tier_name] = {
          tier: { id: pc.tier_id, name: pc.tier_name, gpu: pc.gpu, ram: pc.ram, cpu: pc.cpu, price_per_hour: pc.price_per_hour },
          pcs: [],
        };
      }
      grouped[pc.tier_name].pcs.push({
        id: pc.id, label: pc.label, status: pc.status, is_available: pc.is_available
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    console.error('Get PCs error:', err);
    res.status(500).json({ error: 'Компьютеруудын мэдээлэл татаж чадсангүй' });
  }
});

module.exports = router;
