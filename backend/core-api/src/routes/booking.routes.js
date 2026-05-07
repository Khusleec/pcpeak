const express = require('express');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const pool = require('../db/pool');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createBookingSchema } = require('../validators/booking.validator');
const { issueDepositInvoice } = require('../services/qpay.booking');

const router = express.Router();
const DEPOSIT_RATE = 0.3;
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// ─── Create Booking (multi-PC, conflict check) ─────────────
router.post('/', authenticateToken, validate(createBookingSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const { cafe_id, pc_ids, starts_at, ends_at } = req.body;
    const user_id = req.user.id;

    await client.query('BEGIN');

    // 1. Verify all PCs belong to the cafe and are available
    const pcCheck = await client.query(
      `SELECT id, tier_id FROM pcs WHERE id IN (?) AND cafe_id = ? AND status = 'available'`,
      [pc_ids, cafe_id]
    );
    if (pcCheck.rows.length !== pc_ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Сонгосон компьютер ийм салбарт байхгүй эсвэл захиалгатай байна' });
    }

    // 2. Check time conflicts
    const conflicts = await client.query(
      `SELECT DISTINCT bi.pc_id FROM booking_items bi
       JOIN bookings b ON bi.booking_id = b.id
       WHERE bi.pc_id IN (?)
         AND b.status IN ('confirmed', 'pending_payment')
         AND b.starts_at < ?
         AND b.ends_at > ?`,
      [pc_ids, ends_at, starts_at]
    );
    if (conflicts.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Энэ цагт давхардсан захиалга байна',
        conflicting_pc_ids: conflicts.rows.map((r) => r.pc_id),
      });
    }

    // 3. Calculate prices
    const tierPrices = await client.query(
      `SELECT p.id AS pc_id, t.price_per_hour FROM pcs p
       JOIN pc_tiers t ON p.tier_id = t.id
       WHERE p.id IN (?)`,
      [pc_ids]
    );
    const hours = (new Date(ends_at) - new Date(starts_at)) / 3600000;
    let total_price = 0;
    const priceMap = {};
    for (const row of tierPrices.rows) {
      const price = parseFloat(row.price_per_hour) * hours;
      priceMap[row.pc_id] = Math.round(price * 100) / 100;
      total_price += priceMap[row.pc_id];
    }

    // 4. Insert booking with generated UUID
    const bookingId = uuidv4();
    const deposit_amount = roundMoney(total_price * DEPOSIT_RATE);
    const startsAtDb = new Date(starts_at).toISOString().slice(0, 19).replace('T', ' ');
    const endsAtDb = new Date(ends_at).toISOString().slice(0, 19).replace('T', ' ');
    const useDepositFlow = config.qpay.enabled || config.paymentsDemoMode;
    const bookingStatus = useDepositFlow ? 'pending_payment' : 'confirmed';
    const paymentStatus = useDepositFlow ? 'unpaid' : 'not_required';
    await client.query(
      `INSERT INTO bookings (id, user_id, cafe_id, total_price, status, payment_status, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, user_id, cafe_id, total_price, bookingStatus, paymentStatus, startsAtDb, endsAtDb]
    );

    // 5. Insert booking items
    for (const pc_id of pc_ids) {
      await client.query(
        `INSERT INTO booking_items (booking_id, pc_id, price) VALUES (?, ?, ?)`,
        [bookingId, pc_id, priceMap[pc_id]]
      );
    }

    await client.query('COMMIT');

    // 6. Fetch the created booking
    const fetched = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    const booking = fetched.rows[0];

    let qpay = null;
    let qpay_invoice_error = false;
    if (useDepositFlow) {
      try {
        qpay = await issueDepositInvoice(bookingId, user_id);
      } catch (e) {
        console.error('Deposit invoice:', e.message, e.code || e.data || '');
        qpay_invoice_error = true;
      }
    }

    res.status(201).json({
      booking: {
        ...booking,
        deposit_amount,
        pc_ids,
        items: pc_ids.map((id) => ({ pc_id: id, price: priceMap[id] })),
      },
      qpay,
      qpay_invoice_error,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('Rollback failed:', rbErr);
    }
    console.error('Booking error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Захиалга бүтсэнгүй' });
    }
  } finally {
    client.release();
  }
});

// ─── Auto-complete past bookings ───────────────────────────
// Flip any 'confirmed' booking whose end time has passed to 'completed'.
// Runs cheaply on every list call so users always see fresh statuses.
async function autoCompletePastBookings() {
  await pool.query(
    `UPDATE bookings
        SET status = 'completed'
      WHERE status = 'confirmed'
        AND ends_at <= NOW()`
  );
}

// ─── Get User Bookings ─────────────────────────────────────
router.get('/my', authenticateToken, async (req, res) => {
  try {
    await autoCompletePastBookings();
    const result = await pool.query(
      `SELECT b.*, c.name AS cafe_name,
              ROUND(b.total_price * ?, 2) AS deposit_amount,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'pc_id', bi.pc_id,
                  'price', bi.price,
                  'label', p.label,
                  'tier', t.name
                )
              ) AS items
       FROM bookings b
       JOIN cafes c ON b.cafe_id = c.id
       JOIN booking_items bi ON bi.booking_id = b.id
       JOIN pcs p ON bi.pc_id = p.id
       JOIN pc_tiers t ON p.tier_id = t.id
       WHERE b.user_id = ?
       GROUP BY b.id, c.name
       ORDER BY b.created_at DESC`,
      [DEPOSIT_RATE, req.user.id]
    );

    // mysql2 returns JSON columns as already-parsed objects in modern versions,
    // but also sometimes as strings — normalise.
    for (const row of result.rows) {
      if (typeof row.items === 'string') {
        try { row.items = JSON.parse(row.items); } catch { row.items = []; }
      }
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Захиалгын жагсаалт татаж чадсангүй' });
  }
});

// ─── Cancel Booking ─────────────────────────────────────────
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const update = await pool.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND user_id = ? AND status IN ('confirmed', 'pending_payment')`,
      [req.params.id, req.user.id]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({ error: 'Захиалга олдсонгүй эсвэл аль хэдийн цуцлагдсан' });
    }

    const fetched = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json(fetched.rows[0]);
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ error: 'Захиалга цуцлаж чадсангүй' });
  }
});

// ─── Admin: Get All Bookings ────────────────────────────────
router.get('/all', authenticateToken, authorize('admin', 'moderator'), async (req, res) => {
  try {
    await autoCompletePastBookings();
    const result = await pool.query(
      `SELECT b.*, u.display_name AS user_name, u.email AS user_email, c.name AS cafe_name,
              ROUND(b.total_price * ?, 2) AS deposit_amount,
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'pc_id', bi.pc_id,
                  'price', bi.price,
                  'label', p.label,
                  'tier', t.name
                )
              ) AS items
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN cafes c ON b.cafe_id = c.id
       JOIN booking_items bi ON bi.booking_id = b.id
       JOIN pcs p ON bi.pc_id = p.id
       JOIN pc_tiers t ON p.tier_id = t.id
       GROUP BY b.id, u.display_name, u.email, c.name
       ORDER BY b.created_at DESC`,
      [DEPOSIT_RATE]
    );

    for (const row of result.rows) {
      if (typeof row.items === 'string') {
        try { row.items = JSON.parse(row.items); } catch { row.items = []; }
      }
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Get all bookings error:', err);
    res.status(500).json({ error: 'Захиалгын жагсаалт татаж чадсангүй' });
  }
});

module.exports = router;
