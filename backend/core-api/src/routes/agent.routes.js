/**
 * core-api · agent route — THIN ENQUEUE + LONG-POLL LAYER.
 *
 * The actual LLM + tool execution lives in the `agent-worker` service
 * (see backend/agent-worker/). core-api here only:
 *   1. validates input + auth
 *   2. inserts a row into `agent_tasks` (status='queued')
 *   3. polls the row until the worker flips it to 'done' or 'failed'
 *      (or the request hits AGENT_RESPONSE_TIMEOUT_MS — then we return 202
 *      with the task id so the frontend can keep polling).
 *
 * This keeps the frontend's existing `POST /api/agent/chat` contract
 * (returns `{ reply }`) intact, while genuinely splitting the heavy
 * work into a separate Docker service. Real SOA, no UI rewrite.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Tunables ───────────────────────────────────────────────
const RESPONSE_TIMEOUT_MS = parseInt(
  process.env.AGENT_RESPONSE_TIMEOUT_MS,
  10
) || 30_000;
const POLL_INTERVAL_MS = parseInt(
  process.env.AGENT_POLL_INTERVAL_MS,
  10
) || 500;

// ─── POST /api/agent/chat — enqueue + wait for worker ───────
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Зурвас оруулна уу' });
    }

    // Pack the prompt + recent turns into a JSON envelope so the worker
    // gets conversation context. Worker recognises the v1 envelope; falls
    // back to plain string for legacy rows.
    let stored = message.trim();
    if (Array.isArray(history) && history.length > 0) {
      const safeHistory = history
        .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-12)
        .map((h) => ({ role: h.role, content: String(h.content).slice(0, 4000) }));
      stored = JSON.stringify({ v: 1, message: message.trim(), history: safeHistory });
    }

    const taskId = uuidv4();
    await pool.query(
      `INSERT INTO agent_tasks (id, user_id, message, status)
       VALUES (?, ?, ?, 'queued')`,
      [taskId, req.user.id, stored]
    );

    // Long-poll the queue row.
    const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const r = await pool.query(
        `SELECT status, reply, error FROM agent_tasks WHERE id = ?`,
        [taskId]
      );
      const row = r.rows[0];
      if (row && row.status === 'done') {
        return res.json({
          reply: row.reply || 'Хариу боловсруулж чадсангүй. Дахин оролдоно уу.',
          taskId,
        });
      }
      if (row && row.status === 'failed') {
        return res.status(500).json({
          error: row.error || 'AI туслагч асуудалтай байна',
          taskId,
        });
      }
      await new Promise((rs) => setTimeout(rs, POLL_INTERVAL_MS));
    }

    // Worker is still chewing — hand the id back so the client may poll.
    return res.status(202).json({ taskId, status: 'processing' });
  } catch (err) {
    console.error('Agent enqueue error:', err);
    return res.status(500).json({ error: 'AI туслагч асуудалтай байна' });
  }
});

// ─── GET /api/agent/tasks/:id — frontend can poll if the chat
//     endpoint timed out (returned 202).
router.get('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, status, reply, error, created_at, finished_at
         FROM agent_tasks
        WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Task not found' });
    return res.json(row);
  } catch (err) {
    console.error('Agent task fetch error:', err);
    return res.status(500).json({ error: 'Task lookup failed' });
  }
});

module.exports = router;
