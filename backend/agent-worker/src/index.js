/**
 * Rigup · agent-worker
 * --------------------
 * Polls `agent_tasks` for queued rows, runs the OpenAI-compatible
 * chat-with-tools loop, and writes the reply back. Atomic CAS claim
 * (UPDATE ... WHERE status='queued') guarantees a task is processed
 * by exactly one worker even if you scale this service horizontally.
 *
 * Also serves a tiny /health HTTP endpoint so docker compose can
 * health-check it the same way it checks core-api.
 */

const http = require('node:http');
const { OpenAI } = require('openai');
require('dotenv').config();

// ─── Critical Check ─────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error('agent-worker: DATABASE_URL is required');
  process.exit(1);
}

const pool = require('./db');
const { tools, executeTool } = require('./tools');

// ─── Config ─────────────────────────────────────────────────
const POLL_INTERVAL_MS = parseInt(process.env.AGENT_POLL_INTERVAL_MS, 10) || 1000;
const HEALTH_PORT      = parseInt(process.env.PORT || process.env.AGENT_HEALTH_PORT, 10) || 8090;
const MAX_TOOL_ROUNDS  = parseInt(process.env.AGENT_MAX_TOOL_ROUNDS, 10) || 8;
const AI_API_KEY       = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
const AI_BASE_URL      = process.env.AI_BASE_URL || process.env.GEMINI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL         = process.env.AI_MODEL    || process.env.GEMINI_MODEL    || process.env.OPENAI_MODEL    || 'llama-3.3-70b-versatile';

if (!AI_API_KEY) {
  console.warn('agent-worker: AI_API_KEY is not set — tasks will fail until you add a key.');
}

const openai = new OpenAI({ apiKey: AI_API_KEY || 'missing', baseURL: AI_BASE_URL });

// ─── System prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `Та ерөнхий зорилготой ухаалаг AI туслагч. Хэрэглэгчтэй найрсаг, чөлөөтэй, бодит мэт ярилцана уу — яриаг зөвхөн нэг сэдэгт шахахгүй.

ЗАН ТӨРХ:
- Асуултын хүрээ өргөн: программ, техник, сургалт, ажил амьдрал, санаа цуглуулах, энгийн зөвлөгөө, тайлбарлах, орчуулах, тооцоолох, товч тайлбар, жаахан яриа гэх мэт — бүгдийг дэмжинэ.
- Хэрэглэгч платформын талаар огт дурдахгүй байсан ч ерөнхий асуултад сайхан, хүн шиг хариулна уу. Бүх зүйлийг Mongol PC руу буцааж чиглүүлэхгүй.
- Хэрэглэгчийн ярьсан хэлээр хариулна уу. Хэрэглэгч монголоор бичвэл монголоор, англиар бичвэл англиар.
- Хариултыг тохиромжтой урттай гарга — энгийн асуултад богинохон, нарийн асуултад дэлгэрэнгүй.
- Мэдэхгүй зүйлээ зохиож хариулахгүй. "Мэдэхгүй байна" гэж шударга хэлнэ.
- Урьд нь яригдсан зүйлсийг санаж, давтахгүй.

НЭМЭЛТ ХЭРЭГСЛҮҮД (ЗӨВХӨН ХЭРЭГЛЭГЧ ЯВУУЛСАН ҮЕД):
- Mongol PC гэдэг гейминг компьютерийн түрээсийн систем энэ платформ дээр бий. Зөвхөн салбар, сул компьютер, захиалга, үнэ, цагийн талаар тодорхой асуувал ӨГӨГДСӨН ХЭРЭГСЛҮҮДийг ашиглана.
- Тэр бусад бүхий л тохиолдолд хэрэгсэл дуудахгүйгээр шууд ярилцана уу.
- Өгөгдлийн хэрэгсэл (захиалга, салбар) зөвхөн чамд идэвхтэй байх үед л ашиглана — идэвхгүй үед чи ердийн текстээр л хариулна.`;

/** Heuristic: only register function tools when user likely wants DB/booking actions (stops models from "tool spam" on small talk). */
function textLooksBookingRelated(blob) {
  const s = String(blob || '')
    .toLowerCase()
    .normalize('NFC');
  if (!s.trim()) return false;
  const hints = [
    'booking',
    'booked',
    'cancel',
    'cafe',
    'branch',
    'mongol pc',
    'mongolpc',
    'mongol-pc',
    'захиалга',
    'салбар',
    'цуцла',
    'түрээс',
    'компьютер',
    'zahialga',
    'salbar',
    'turees',
    'kompyuter',
    'reservation',
  ];
  for (const h of hints) {
    if (s.includes(h)) return true;
  }
  if (/\bbook\b/i.test(s)) return true;
  if (/\brent\b/i.test(s)) return true;
  if (/\brental\b/i.test(s)) return true;
  // "pc" as its own token (avoid matching unrelated words)
  if (/(^|[^a-z])pc(s)?([^a-z]|$)/i.test(s)) return true;
  return false;
}

function shouldAttachBookingTools(message, history) {
  const mode = (process.env.AGENT_BOOKING_TOOLS_MODE || 'auto').toLowerCase();
  if (mode === 'always') return true;
  const parts = [String(message || '')];
  const recentUser = (history || []).filter((h) => h.role === 'user').slice(-3);
  for (const h of recentUser) parts.push(h.content);
  return textLooksBookingRelated(parts.join('\n'));
}

// ─── Atomic claim: pick a queued row and lock it ────────────
async function claimNextTask() {
  // Step 1: pick the oldest queued id.
  const pick = await pool.query(
    `SELECT id FROM agent_tasks
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1`
  );
  if (pick.rows.length === 0) return null;
  const id = pick.rows[0].id;

  // Step 2: try to flip it to 'processing' atomically.
  const claim = await pool.query(
    `UPDATE agent_tasks
        SET status = 'processing',
            attempts = attempts + 1,
            started_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'queued'`,
    [id]
  );
  if (claim.rowCount === 0) return null; // someone else got it

  const full = await pool.query(
    `SELECT id, user_id, message FROM agent_tasks WHERE id = ?`,
    [id]
  );
  return full.rows[0] || null;
}

async function markDone(id, reply) {
  await pool.query(
    `UPDATE agent_tasks
        SET status='done', reply=?, finished_at=CURRENT_TIMESTAMP
      WHERE id=?`,
    [reply, id]
  );
}

async function markFailed(id, errorMsg) {
  await pool.query(
    `UPDATE agent_tasks
        SET status='failed', error=?, finished_at=CURRENT_TIMESTAMP
      WHERE id=?`,
    [String(errorMsg).slice(0, 4000), id]
  );
}

// ─── Unpack the stored task payload ─────────────────────────
// Frontend (via core-api) may store either:
//   • a plain string (legacy)                              → no history
//   • a JSON envelope `{ v:1, message, history:[...] }`    → prior turns
function unpackStored(raw) {
  if (typeof raw !== 'string') return { message: String(raw || ''), history: [] };
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return { message: trimmed, history: [] };
  try {
    const obj = JSON.parse(trimmed);
    if (obj && obj.v === 1 && typeof obj.message === 'string') {
      const history = Array.isArray(obj.history)
        ? obj.history
            .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
            .slice(-12)
        : [];
      return { message: obj.message, history };
    }
  } catch {
    /* fall through to plain text */
  }
  return { message: trimmed, history: [] };
}

// ─── LLM + tool loop ────────────────────────────────────────
async function runAgentLoop(userId, rawMessage) {
  if (!AI_API_KEY) {
    throw new Error('AI туслагч API түлхүүр тохируулаагүй байна');
  }
  const { message, history } = unpackStored(rawMessage);
  let messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const useTools = shouldAttachBookingTools(message, history);
  const completionOpts = { model: AI_MODEL, messages };
  if (useTools) {
    completionOpts.tools = tools;
    completionOpts.tool_choice = 'auto';
  }

  let response = await openai.chat.completions.create(completionOpts);
  let assistantMsg = response.choices[0].message;
  let rounds = 0;

  while (useTools && assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
    if (rounds >= MAX_TOOL_ROUNDS) {
      return 'AI туслагч хэт олон удаа хэрэгсэл дуудсан тул зогсоолоо. Асуултаа дахин товчоор оруулна уу.';
    }
    rounds += 1;

    messages.push(assistantMsg);

    for (const toolCall of assistantMsg.tool_calls) {
      let toolResult;
      try {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        toolResult = await executeTool(toolCall.function.name, args, userId);
      } catch (toolErr) {
        console.error('Tool execution failed:', toolCall.function?.name, toolErr);
        toolResult = { error: toolErr.message || 'Хэрэгсэл алдаа өглөө' };
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    });
    // follow-up rounds only when tools were enabled for this task
    assistantMsg = response.choices[0].message;
  }

  return assistantMsg.content || 'Хариу боловсруулж чадсангүй. Дахин оролдоно уу.';
}

// ─── Worker tick ────────────────────────────────────────────
let running = true;

async function tick() {
  while (running) {
    try {
      const task = await claimNextTask();
      if (!task) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
      console.log(`[agent-worker] processing task ${task.id}`);
      try {
        const reply = await runAgentLoop(task.user_id, task.message);
        await markDone(task.id, reply);
        console.log(`[agent-worker] done task ${task.id}`);
      } catch (err) {
        console.error(`[agent-worker] failed task ${task.id}:`, err.message);
        await markFailed(task.id, err.message || 'agent failure');
      }
    } catch (loopErr) {
      console.error('[agent-worker] loop error:', loopErr);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

// ─── Tiny health HTTP endpoint ──────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'agent-worker', status: 'ok' }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(HEALTH_PORT, () => {
  console.log(`[agent-worker] health endpoint on :${HEALTH_PORT}`);
  console.log(`[agent-worker] polling every ${POLL_INTERVAL_MS}ms`);
});

// ─── Graceful shutdown ──────────────────────────────────────
const shutdown = async (sig) => {
  console.log(`\n[agent-worker] received ${sig}, draining...`);
  running = false;
  server.close();
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(0);
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// kick off
tick();
