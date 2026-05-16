const http = require('node:http');

// ─── Bulletproof Health Check ───────────────────────────────
// Starts immediately with zero dependencies. 
const HEALTH_PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'agent-worker', status: 'ok', adapter: 'gemini-native' }));
}).listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`[agent-worker] Health server active on 0.0.0.0:${HEALTH_PORT}`);
});

// ─── App Logic ──────────────────────────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('CRITICAL: DATABASE_URL is not set in environment variables!');
}

const pool = process.env.DATABASE_URL ? require('./db') : null;
const { tools, executeTool } = require('./tools');

const POLL_INTERVAL_MS = parseInt(process.env.AGENT_POLL_INTERVAL_MS, 10) || 1000;
const MAX_TOOL_ROUNDS  = parseInt(process.env.AGENT_MAX_TOOL_ROUNDS, 10) || 8;

const AI_API_KEY  = process.env.GEMINI_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
const AI_MODEL    = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash-latest';

if (!AI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is missing. AI will not be able to reply.');
}

// Initialize Native Google SDK
const genAI = AI_API_KEY ? new GoogleGenerativeAI(AI_API_KEY) : null;

// Convert OpenAI tool format to Google Native tool format
const googleTools = {
  functionDeclarations: tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters
  }))
};

// ─── System prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `Та ерөнхий зорилготой ухаалаг AI туслагч. Хэрэглэгчтэй найрсаг, чөлөөтэй, бодит мэт ярилцана уу.

ЗАН ТӨРХ:
- Асуултын хүрээ өргөн: программ, техник, сургалт, ажил амьдрал, санаа цуглуулах, энгийн зөвлөгөө, тайлбарлах, орчуулах, тооцоолох гэх мэт.
- Хэрэглэгчийн ярьсан хэлээр хариулна уу. Хэрэглэгч монголоор бичвэл монголоор, англиар бичвэл англиар.
- Хариултыг тохиромжтой урттай гарга.
- Мэдэхгүй зүйлээ зохиож хариулахгүй. "Мэдэхгүй байна" гэж шударга хэлнэ.

НЭМЭЛТ ХЭРЭГСЛҮҮД (ЗӨВХӨН ХЭРЭГЛЭГЧ ЯВУУЛСАН ҮЕД):
- Mongol PC гэдэг гейминг компьютерийн түрээсийн систем энэ платформ дээр бий. Салбар, сул компьютер, захиалга, үнэ, цагийн талаар асуувал ӨГӨГДСӨН ХЭРЭГСЛҮҮДийг ашиглана.`;

/** Heuristic for tool usage */
function textLooksBookingRelated(blob) {
  const s = String(blob || '').toLowerCase().normalize('NFC');
  const hints = ['booking','booked','cancel','cafe','branch','mongol pc','захиалга','салбар','цуцла','түрээс','компьютер','zahialga','salbar','pc'];
  return hints.some(h => s.includes(h));
}

function unpackStored(raw) {
  if (typeof raw !== 'string') return { message: String(raw || ''), history: [] };
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return { message: trimmed, history: [] };
  try {
    const obj = JSON.parse(trimmed);
    if (obj && obj.v === 1) {
      return { message: obj.message, history: Array.isArray(obj.history) ? obj.history.slice(-10) : [] };
    }
  } catch {}
  return { message: trimmed, history: [] };
}

async function runAgentLoop(userId, rawMessage) {
  if (!genAI) throw new Error('GEMINI_API_KEY тохируулаагүй байна');
  
  const { message, history } = unpackStored(rawMessage);
  const useTools = textLooksBookingRelated(message + (history.map(h => h.content).join(' ')));

  const model = genAI.getGenerativeModel({ 
    model: AI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  // Google Native SDK requires history to start with 'user' and alternate roles.
  // If history starts with 'assistant' (like our welcome message), we must drop it.
  const sanitizedHistory = [];
  let nextRole = 'user';
  for (const h of history) {
    const role = h.role === 'assistant' ? 'model' : 'user';
    if (role === nextRole) {
      sanitizedHistory.push({
        role,
        parts: [{ text: h.content }]
      });
      nextRole = nextRole === 'user' ? 'model' : 'user';
    }
  }

  const chat = model.startChat({
    history: sanitizedHistory,
    tools: useTools ? [googleTools] : []
  });

  let result = await chat.sendMessage(message);
  let response = result.response;
  let rounds = 0;

  // Handle Function Calling
  while (response.candidates[0].content.parts.some(p => p.functionCall) && rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const toolCalls = response.candidates[0].content.parts.filter(p => p.functionCall);
    const toolResponses = [];

    for (const tc of toolCalls) {
      const call = tc.functionCall;
      console.log(`[agent-worker] calling tool: ${call.name}`);
      let toolResult;
      try {
        toolResult = await executeTool(call.name, call.args, userId);
      } catch (err) {
        toolResult = { error: err.message };
      }
      toolResponses.push({
        functionResponse: {
          name: call.name,
          response: { content: toolResult }
        }
      });
    }

    result = await chat.sendMessage(toolResponses);
    response = result.response;
  }

  return response.text() || 'Хариу ирсэнгүй.';
}

// ─── Worker tick ────────────────────────────────────────────
let running = true;
async function tick() {
  while (running) {
    if (!process.env.DATABASE_URL) {
      console.warn('[agent-worker] IDLE: DATABASE_URL is missing.');
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }
    if (!AI_API_KEY) {
      console.warn('[agent-worker] IDLE: GEMINI_API_KEY is missing.');
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    try {
      const task = await claimNextTask();
      if (!task) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
      console.log(`[agent-worker] processing task ${task.id}`);
      try {
        const reply = await runAgentLoop(task.user_id, task.message);
        await markDone(task.id, reply);
        console.log(`[agent-worker] done task ${task.id}`);
      } catch (err) {
        console.error(`[agent-worker] failed task ${task.id}:`, err.message);
        await markFailed(task.id, err.message);
      }
    } catch (err) {
      console.error('[agent-worker] loop error:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

async function claimNextTask() {
  const pick = await pool.query(`SELECT id FROM agent_tasks WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`);
  if (pick.rows.length === 0) return null;
  const id = pick.rows[0].id;
  const claim = await pool.query(`UPDATE agent_tasks SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued'`, [id]);
  if (claim.rowCount === 0) return null;
  const full = await pool.query(`SELECT id, user_id, message FROM agent_tasks WHERE id = ?`, [id]);
  return full.rows[0];
}

async function markDone(id, reply) {
  await pool.query(`UPDATE agent_tasks SET status='done', reply=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`, [reply, id]);
}

async function markFailed(id, errorMsg) {
  await pool.query(`UPDATE agent_tasks SET status='failed', error=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`, [String(errorMsg).slice(0, 4000), id]);
}

const shutdown = async (sig) => {
  console.log(`\n[agent-worker] received ${sig}, draining...`);
  running = false;
  server.close();
  try { if (pool) await pool.end(); } catch {}
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

tick();