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
 *
 * Supports two LLM backends:
 *   • Google Gemini  — set GOOGLE_API_KEY (and optionally AI_MODEL=gemini-*)
 *   • OpenAI-compat  — set AI_API_KEY / OPENAI_API_KEY (default, uses Groq)
 */

const http = require('node:http');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('./db');
const { tools, executeTool } = require('./tools');
require('dotenv').config();

// ─── Config ─────────────────────────────────────────────────
const POLL_INTERVAL_MS = parseInt(process.env.AGENT_POLL_INTERVAL_MS, 10) || 1000;
const HEALTH_PORT      = parseInt(process.env.AGENT_HEALTH_PORT, 10) || 8090;
const MAX_TOOL_ROUNDS  = parseInt(process.env.AGENT_MAX_TOOL_ROUNDS, 10) || 8;
const GOOGLE_API_KEY   = process.env.GOOGLE_API_KEY || '';
const AI_API_KEY       = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
const AI_BASE_URL      = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL         = process.env.AI_MODEL    || process.env.OPENAI_MODEL    || 'llama-3.3-70b-versatile';

// Detect Gemini: explicit GOOGLE_API_KEY or model name contains "gemini"
const USE_GEMINI = Boolean(GOOGLE_API_KEY) || AI_MODEL.toLowerCase().includes('gemini');
const GEMINI_API_KEY = GOOGLE_API_KEY || AI_API_KEY;
const GEMINI_MODEL   = AI_MODEL.toLowerCase().includes('gemini') ? AI_MODEL : 'gemini-2.0-flash';

if (!process.env.DATABASE_URL) {
  console.error('agent-worker: DATABASE_URL is required');
  process.exit(1);
}
if (!GOOGLE_API_KEY && !AI_API_KEY) {
  console.warn('agent-worker: No API key set (GOOGLE_API_KEY / AI_API_KEY) — tasks will fail until you add a key.');
}

if (USE_GEMINI) {
  console.log(`[agent-worker] LLM backend: Google Gemini (model: ${GEMINI_MODEL})`);
} else {
  console.log(`[agent-worker] LLM backend: OpenAI-compatible (model: ${AI_MODEL}, base: ${AI_BASE_URL})`);
}

// ─── LLM clients (lazy — only the active one is used) ───────
const openai = USE_GEMINI
  ? null
  : new OpenAI({ apiKey: AI_API_KEY || 'missing', baseURL: AI_BASE_URL });

const geminiClient = USE_GEMINI
  ? new GoogleGenerativeAI(GEMINI_API_KEY || 'missing')
  : null;

// ─── Gemini format converters ────────────────────────────────

/**
 * Convert OpenAI-style tool definitions to Gemini FunctionDeclaration format.
 * OpenAI: [{ type:'function', function:{ name, description, parameters } }]
 * Gemini: [{ name, description, parameters }]
 */
function openAIToolsToGemini(openAITools) {
  return openAITools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

/**
 * Convert an OpenAI messages array to Gemini's { history, lastUserMessage } shape.
 *
 * Gemini rules:
 *   - history must alternate user / model turns (no system role).
 *   - The system prompt is passed separately via systemInstruction.
 *   - Tool results use role:'user' with parts:[{ functionResponse }].
 *   - Tool calls from the model use role:'model' with parts:[{ functionCall }].
 *   - The final user message is passed as the `message` arg to sendMessage(),
 *     NOT included in history.
 */
function openAIMessagesToGemini(messages) {
  const history = [];
  let lastUserMessage = '';

  // Skip the system message (index 0) — handled via systemInstruction
  const nonSystem = messages.filter((m) => m.role !== 'system');

  for (let i = 0; i < nonSystem.length; i++) {
    const msg = nonSystem[i];
    const isLast = i === nonSystem.length - 1;

    if (msg.role === 'user') {
      if (isLast) {
        // The final user turn is sent as the live message, not in history
        lastUserMessage = msg.content || '';
      } else {
        history.push({ role: 'user', parts: [{ text: msg.content || '' }] });
      }
    } else if (msg.role === 'assistant') {
      // May contain text and/or tool_calls
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
      }
      if (parts.length > 0) history.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      // Tool result — Gemini expects role:'user' with functionResponse parts
      let result = {};
      try { result = JSON.parse(msg.content || '{}'); } catch { result = { raw: msg.content }; }
      history.push({
        role: 'user',
        parts: [{ functionResponse: { name: msg.name || 'tool', response: result } }],
      });
    }
  }

  return { history, lastUserMessage };
}

/**
 * Normalise a Gemini response candidate into an OpenAI-style message object:
 *   { role:'assistant', content: string|null, tool_calls: [...] | undefined }
 *
 * This lets the rest of the agent loop stay provider-agnostic.
 */
function geminiResponseToOpenAI(candidate) {
  const parts = candidate.content?.parts || [];
  let textContent = null;
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) {
      textContent = (textContent || '') + part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini-${part.functionCall.name}-${Date.now()}`,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        },
      });
    }
  }

  return {
    role: 'assistant',
    content: textContent,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

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

/**
 * Gemini-backed agent loop.
 * Uses ChatSession so history is managed by the SDK; tool calls are
 * translated to/from OpenAI format so the executor stays unchanged.
 */
async function runAgentLoopGemini(userId, messages, useTools) {
  const geminiTools = useTools ? [{ functionDeclarations: openAIToolsToGemini(tools) }] : undefined;

  const systemInstruction = messages.find((m) => m.role === 'system')?.content || '';
  const model = geminiClient.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    ...(geminiTools ? { tools: geminiTools } : {}),
  });

  const { history: geminiHistory, lastUserMessage } = openAIMessagesToGemini(messages);
  const chat = model.startChat({ history: geminiHistory });

  let result = await chat.sendMessage(lastUserMessage);
  let assistantMsg = geminiResponseToOpenAI(result.response.candidates[0]);
  let rounds = 0;

  while (useTools && assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
    if (rounds >= MAX_TOOL_ROUNDS) {
      return 'AI туслагч хэт олон удаа хэрэгсэл дуудсан тул зогсоолоо. Асуултаа дахин товчоор оруулна уу.';
    }
    rounds += 1;

    // Execute all tool calls and collect functionResponse parts
    const responseParts = [];
    for (const toolCall of assistantMsg.tool_calls) {
      let toolResult;
      try {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        toolResult = await executeTool(toolCall.function.name, args, userId);
      } catch (toolErr) {
        console.error('Tool execution failed:', toolCall.function?.name, toolErr);
        toolResult = { error: toolErr.message || 'Хэрэгсэл алдаа өглөө' };
      }
      responseParts.push({
        functionResponse: {
          name: toolCall.function.name,
          response: toolResult,
        },
      });
    }

    // Send all tool results back in a single turn
    result = await chat.sendMessage(responseParts);
    assistantMsg = geminiResponseToOpenAI(result.response.candidates[0]);
  }

  return assistantMsg.content || 'Хариу боловсруулж чадсангүй. Дахин оролдоно уу.';
}

/**
 * OpenAI-compatible agent loop (default — works with Groq, OpenAI, etc.).
 */
async function runAgentLoopOpenAI(userId, messages, useTools) {
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
    assistantMsg = response.choices[0].message;
  }

  return assistantMsg.content || 'Хариу боловсруулж чадсангүй. Дахин оролдоно уу.';
}

/**
 * Top-level entry point — dispatches to the correct backend.
 */
async function runAgentLoop(userId, rawMessage) {
  if (!GOOGLE_API_KEY && !AI_API_KEY) {
    throw new Error('AI туслагч API түлхүүр тохируулаагүй байна');
  }
  const { message, history } = unpackStored(rawMessage);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const useTools = shouldAttachBookingTools(message, history);

  if (USE_GEMINI) {
    return runAgentLoopGemini(userId, messages, useTools);
  }
  return runAgentLoopOpenAI(userId, messages, useTools);
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
