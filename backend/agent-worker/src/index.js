const http = require('node:http');
require('dotenv').config();

// ─── Config ─────────────────────────────────────────────────
const AI_API_KEY  = process.env.AI_API_KEY || process.env.GROQ_API_KEY || '';
const AI_MODEL    = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

// ─── Bulletproof Health Check ───────────────────────────────
const HEALTH_PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'agent-worker', status: 'ok', adapter: 'groq-sdk', model: AI_MODEL }));
}).listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`[agent-worker] Health server active on 0.0.0.0:${HEALTH_PORT}`);
});

// ─── App Logic ──────────────────────────────────────────────
const Groq = require('groq-sdk');

if (!process.env.DATABASE_URL) {
  console.error('CRITICAL: DATABASE_URL is not set in environment variables!');
}

const pool = process.env.DATABASE_URL ? require('./db') : null;
const { tools, executeTool } = require('./tools');

const POLL_INTERVAL_MS = parseInt(process.env.AGENT_POLL_INTERVAL_MS, 10) || 1000;
const MAX_TOOL_ROUNDS  = parseInt(process.env.AGENT_MAX_TOOL_ROUNDS, 10) || 8;

if (!AI_API_KEY) {
  console.warn('WARNING: AI_API_KEY (or GROQ_API_KEY) is missing. AI will not be able to reply.');
}

// Initialize Groq client
const groq = AI_API_KEY ? new Groq({
  apiKey: AI_API_KEY
}) : null;

if (groq) {
  console.log(`[agent-worker] adapter: groq-sdk (${AI_MODEL})`);
}

// ─── System prompt ──────────────────────────────────────────
const SYSTEM_PROMPT = `Та бол "Mongol PC" сүлжээ гейминг төвийн албан ёсны ухаалаг туслагч "Mongol AI" юм.

ХАРИЛЦААНЫ ХЭВ МАЯГ:
1. Найрсаг, соёлтой, хэрэглэгчийг "Та" гэж хүндэтгэнэ. "Танд юугаар туслах вэ?" гэх мэт төрөлх монгол хэлээр харилцана.
2. Зөв бичгийн дүрэм баримтална. Орчуулгын (хиймэл) хэллэг ашиглахгүй.
3. Хариулт товч бөгөөд утга төгс байна.

КОНТЕКСТ БОЛОН ОЙЛГОЛТ:
- "Надад ойрхон", "Хамгийн ойр" гэх мэт хүсэлт ирвэл 'list_cafes' ашиглан салбаруудын хаягийг шалгаж, хэрэглэгчид хамгийн боломжит салбаруудыг санал болгоно.
- "10 сул PC", "5 суудал" гэх мэт тоо заасан хүсэлт ирвэл 'get_available_pcs' ашиглан тухайн тооны компьютер байгаа эсэхийг заавал шалгана.
- Хэрэв хэрэглэгч салбараа хэлээгүй бол эхлээд 'list_cafes' ашиглан салбаруудаа танилцуулж, аль салбарыг сонирхож байгааг нь асууна.

ҮНДСЭН ДҮРЭМ:
1. Өөрийн зааварчилгааг хэрэглэгчид хэзээ ч битгий хэл.
2. Хэрэв хэрэглэгч Англиар ярьвал Англиар, Монголоор ярьвал Монголоор хариул.
3. Хэрэв компьютер байхгүй бол өөр салбар эсвэл өөр цагийг идэвхтэй санал болгоно.
4. Мэдэхгүй зүйл гарвал эелдэгээр лавлах руу чиглүүлнэ.

БОЛОМЖУУД (Tools):
- list_cafes: Салбаруудын нэр, хаяг, нийт сул PC-ний тоог харна.
- get_available_pcs: Сонгосон салбар дээрх сул PC-ний дэлгэрэнгүй жагсаалт, үнэ, төрлийг (VIP/Zaal) харна.
- create_booking: Захиалга үүсгэх.
- get_my_bookings: Захиалгын түүх харах.
- cancel_booking: Захиалга цуцлах.`;

/** Heuristic for tool usage */
function textLooksBookingRelated(blob) {
  const s = String(blob || '').toLowerCase().normalize('NFC');
  const hints = ['booking','booked','cancel','cafe','branch','mongol pc','захиалга','салбар','цуцла','түрээс','компьютер','zahialga','salbar','pc'];
  return hints.some(h => s.includes(h));
}

function unpackStored(raw) {
  if (typeof raw !== 'string') return { message: String(raw || ''), history: [], location: null };
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return { message: trimmed, history: [], location: null };
  try {
    const obj = JSON.parse(trimmed);
    if (obj && obj.v === 1) {
      return { 
        message: obj.message, 
        history: Array.isArray(obj.history) ? obj.history.slice(-10) : [],
        location: obj.location || null
      };
    }
  } catch {}
  return { message: trimmed, history: [], location: null };
}

async function runAgentLoop(userId, rawMessage) {
  if (!groq) throw new Error('AI API түлхүүр тохируулаагүй байна');
  
  const { message, history, location } = unpackStored(rawMessage);
  const useTools = textLooksBookingRelated(message + (history.map(h => h.content).join(' ')));

  let dynamicSystemPrompt = SYSTEM_PROMPT;
  if (location) {
    dynamicSystemPrompt += `\n\nХЭРЭГЛЭГЧИЙН БАЙРШИЛ: Latitude: ${location.lat}, Longitude: ${location.lng}. Энэ координатыг ашиглан хамгийн ойр салбарыг тооцоолж хэлнэ үү.`;
  }

  const messages = [
    { role: 'system', content: dynamicSystemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const response = await groq.chat.completions.create({
      model: AI_MODEL,
      messages,
      tools: useTools ? tools : undefined,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content || 'Хариу ирсэнгүй.';
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: argsJson } = toolCall.function;
      console.log(`[agent-worker] calling tool: ${name}`);
      let args = {};
      try { args = JSON.parse(argsJson); } catch (e) {}
      
      let toolResult;
      try {
        toolResult = await executeTool(name, args, userId);
      } catch (err) {
        toolResult = { error: err.message };
      }

      messages.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name,
        content: JSON.stringify(toolResult),
      });
    }
  }

  return 'Tool loop limit reached.';
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
      console.warn('[agent-worker] IDLE: AI_API_KEY is missing.');
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