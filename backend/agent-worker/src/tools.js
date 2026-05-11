/**
 * LLM-callable tools — same set + behaviour as the original
 * monolithic agent.routes.js, ported into the worker.
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

/** Same as core-api booking.routes — these bookings still reserve PCs for the slot. */
const BOOKING_BLOCKS_SLOT_SQL = `b.status IN ('confirmed', 'pending_payment')`;

// ─── Schemas exposed to the LLM ─────────────────────────────
const tools = [
  {
    type: 'function',
    function: {
      name: 'list_cafes',
      description:
        'List PC cafes (Mongol PC). Call ONLY when the user clearly asks about branches, locations, or which cafes exist — not for general chat.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_pcs',
      description:
        'Get available PCs at a cafe. Call ONLY when the user asks about booking availability, free machines, or time slots at a specific cafe.',
      parameters: {
        type: 'object',
        properties: {
          cafe_id: { type: 'number', description: 'The cafe ID' },
          tier: { type: 'string', enum: ['Zaal', 'VIP'], description: 'Filter by tier name' },
          starts_at: { type: 'string', description: 'ISO datetime for booking start' },
          ends_at: { type: 'string', description: 'ISO datetime for booking end' },
        },
        required: ['cafe_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description:
        'Create a PC booking. Call ONLY after the user explicitly wants to book and you have cafe_id, pc_ids, starts_at, ends_at.',
      parameters: {
        type: 'object',
        properties: {
          cafe_id: { type: 'number', description: 'The cafe ID' },
          pc_ids: { type: 'array', items: { type: 'number' }, description: 'Array of PC IDs to book' },
          starts_at: { type: 'string', description: 'ISO datetime for booking start' },
          ends_at: { type: 'string', description: 'ISO datetime for booking end' },
        },
        required: ['cafe_id', 'pc_ids', 'starts_at', 'ends_at'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_bookings',
      description:
        "List the signed-in user's bookings. Call ONLY when they ask about their orders, reservations, or booking history.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description:
        'Cancel a booking by ID. Call ONLY when the user explicitly asks to cancel a specific booking.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string', description: 'The booking UUID to cancel' },
        },
        required: ['booking_id'],
      },
    },
  },
];

// ─── helpers ────────────────────────────────────────────────
const toMySQLDate = (iso) =>
  new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
const round2 = (n) => Math.round(n * 100) / 100;

// ─── Executor ───────────────────────────────────────────────
async function executeTool(name, args, userId) {
  switch (name) {
    case 'list_cafes': {
      const r = await pool.query(
        `SELECT c.id, c.name, c.address,
                (SELECT COUNT(*) FROM pcs WHERE cafe_id = c.id AND status='available') AS available_pcs
           FROM cafes c WHERE c.is_active = 1`
      );
      return r.rows;
    }
    case 'get_available_pcs': {
      let q = `SELECT p.id, p.label, t.name AS tier, t.price_per_hour
                 FROM pcs p JOIN pc_tiers t ON p.tier_id = t.id
                WHERE p.cafe_id = ? AND p.status = 'available'`;
      const params = [args.cafe_id];
      if (args.tier) {
        q += ` AND t.name = ?`;
        params.push(args.tier);
      }
      if (args.starts_at && args.ends_at) {
        q += ` AND p.id NOT IN (
          SELECT bi.pc_id FROM booking_items bi
            JOIN bookings b ON bi.booking_id = b.id
           WHERE ${BOOKING_BLOCKS_SLOT_SQL} AND b.starts_at < ? AND b.ends_at > ?
        )`;
        params.push(toMySQLDate(args.ends_at), toMySQLDate(args.starts_at));
      }
      q += ' ORDER BY t.name, p.label';
      const r = await pool.query(q, params);
      return r.rows;
    }
    case 'create_booking': {
      if (!Array.isArray(args.pc_ids) || args.pc_ids.length === 0) {
        return { error: 'Захиалах компьютерээ сонгоно уу' };
      }
      if (!args.cafe_id || !args.starts_at || !args.ends_at) {
        return { error: 'Дутуу мэдээлэлтэй захиалга' };
      }
      if (new Date(args.ends_at) <= new Date(args.starts_at)) {
        return { error: 'Захиалгын төгсөх цаг эхлэх цагаас хойш байх ёстой' };
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const ownership = await client.query(
          `SELECT id FROM pcs WHERE id IN (?) AND cafe_id = ? AND status = 'available'`,
          [args.pc_ids, args.cafe_id]
        );
        if (ownership.rows.length !== args.pc_ids.length) {
          await client.query('ROLLBACK');
          return { error: 'Сонгосон компьютер ийм салбарт байхгүй эсвэл боломжгүй' };
        }

        const conflicts = await client.query(
          `SELECT DISTINCT bi.pc_id FROM booking_items bi
             JOIN bookings b ON bi.booking_id = b.id
            WHERE bi.pc_id IN (?) AND ${BOOKING_BLOCKS_SLOT_SQL}
              AND b.starts_at < ? AND b.ends_at > ?`,
          [args.pc_ids, toMySQLDate(args.ends_at), toMySQLDate(args.starts_at)]
        );
        if (conflicts.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            error: 'Цаг давхардсан байна',
            conflicting_pc_ids: conflicts.rows.map((r) => r.pc_id),
          };
        }

        const prices = await client.query(
          `SELECT p.id AS pc_id, t.price_per_hour
             FROM pcs p JOIN pc_tiers t ON p.tier_id=t.id
            WHERE p.id IN (?)`,
          [args.pc_ids]
        );
        const hours = (new Date(args.ends_at) - new Date(args.starts_at)) / 3600000;
        let total = 0;
        const pm = {};
        for (const r of prices.rows) {
          pm[r.pc_id] = round2(parseFloat(r.price_per_hour) * hours);
          total += pm[r.pc_id];
        }
        total = round2(total);

        const bookingId = uuidv4();
        await client.query(
          `INSERT INTO bookings (id, user_id, cafe_id, total_price, starts_at, ends_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            userId,
            args.cafe_id,
            total,
            toMySQLDate(args.starts_at),
            toMySQLDate(args.ends_at),
          ]
        );
        for (const pid of args.pc_ids) {
          await client.query(
            `INSERT INTO booking_items (booking_id, pc_id, price) VALUES (?, ?, ?)`,
            [bookingId, pid, pm[pid]]
          );
        }
        await client.query('COMMIT');

        const fetched = await pool.query(
          'SELECT * FROM bookings WHERE id = ?',
          [bookingId]
        );
        return { success: true, booking: fetched.rows[0] };
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (rb) { console.error('Rollback failed:', rb); }
        console.error('agent-worker create_booking error:', e);
        return { error: e.message || 'Захиалга бүтсэнгүй' };
      } finally {
        client.release();
      }
    }
    case 'get_my_bookings': {
      const r = await pool.query(
        `SELECT b.id, b.total_price, b.status, b.starts_at, b.ends_at, c.name AS cafe
           FROM bookings b JOIN cafes c ON b.cafe_id=c.id
          WHERE b.user_id=?
          ORDER BY b.created_at DESC`,
        [userId]
      );
      return r.rows;
    }
    case 'cancel_booking': {
      const r = await pool.query(
        `UPDATE bookings SET status='cancelled'
          WHERE id=? AND user_id=? AND status IN ('confirmed', 'pending_payment')`,
        [args.booking_id, userId]
      );
      return r.rowCount > 0
        ? { success: true }
        : { error: 'Захиалга олдсонгүй эсвэл аль хэдийн цуцлагдсан' };
    }
    default:
      return { error: 'Тодорхойгүй команд' };
  }
}

module.exports = { tools, executeTool };
