const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCafeSchema } = require('../validators/cafe.validator');
const cacheMiddleware = require('../middleware/cache');

const router = express.Router();

// ─── Get All Cafes (public) ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id AND status = 'available') AS available_pcs,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id) AS total_pcs,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id AND tier_id = 2) AS vip_pcs,
              (SELECT gpu FROM pc_tiers WHERE id = 1) AS zaal_gpu,
              (SELECT gpu FROM pc_tiers WHERE id = 2) AS vip_gpu
       FROM cafes c WHERE c.is_active = 1 ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get cafes error:', err);
    res.status(500).json({ error: 'Салбаруудын мэдээлэл татаж чадсангүй' });
  }
});

// ─── Get Single Cafe ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id AND status = 'available') AS available_pcs,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id) AS total_pcs,
              (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id AND tier_id = 2) AS vip_pcs,
              (SELECT gpu FROM pc_tiers WHERE id = 1) AS zaal_gpu,
              (SELECT gpu FROM pc_tiers WHERE id = 2) AS vip_gpu
       FROM cafes c WHERE c.id = ?`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Салбар олдсонгүй' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get cafe error:', err);
    res.status(500).json({ error: 'Салбарын мэдээлэл татаж чадсангүй' });
  }
});

// ─── Admin: Create Cafe ─────────────────────────────────────
router.post('/', authenticateToken, authorize('admin'), validate(createCafeSchema), async (req, res) => {
  try {
    const { name, address, latitude, longitude, phone, image_url } = req.body;
    const insertResult = await pool.query(
      `INSERT INTO cafes (name, address, latitude, longitude, phone, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, address, latitude, longitude, phone ?? null, image_url ?? null]
    );
    const fetched = await pool.query('SELECT * FROM cafes WHERE id = ?', [insertResult.insertId]);
    res.status(201).json(fetched.rows[0]);
  } catch (err) {
    console.error('Create cafe error:', err);
    res.status(500).json({ error: 'Салбар үүсгэж чадсангүй' });
  }
});

module.exports = router;
