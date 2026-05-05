#!/usr/bin/env node
/**
 * Rigup one-command launcher.
 *  - Verifies Docker is installed
 *  - Starts Docker Desktop on Windows if it isn't running
 *  - Brings the full stack up with `docker compose up -d`
 *  - Waits for health endpoints, auto-seeds demo data on first boot,
 *    prints access URLs, opens the browser
 *
 * Usage:
 *   npm start          -> base stack (frontend + core-api + agent-worker + mysql)
 *   npm run full       -> base stack + observability (Prometheus / Grafana / Jaeger)
 */

const { execSync, spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const FULL = process.argv.includes('--full');

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m'
};
const log = (msg) => console.log(msg);
const banner = (msg) => log(`\n${c.bold}${c.magenta}▶ ${msg}${c.reset}`);
const ok = (msg) => log(`  ${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => log(`  ${c.yellow}!${c.reset} ${msg}`);
const fail = (msg) => log(`  ${c.red}✗${c.reset} ${msg}`);

function tryDockerInfo() {
  const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function ensureDocker() {
  banner('Checking Docker engine');
  const v = tryDockerInfo();
  if (v) { ok(`Docker engine ${v} is running`); return; }

  warn('Docker engine not reachable, attempting to start Docker Desktop...');
  if (os.platform() === 'win32') {
    const candidates = [
      'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
      `${process.env.LOCALAPPDATA}\\Docker\\Docker Desktop.exe`
    ];
    const exe = candidates.find((p) => {
      try { require('node:fs').accessSync(p); return true; } catch { return false; }
    });
    if (!exe) {
      fail('Docker Desktop is not installed. Install it from https://www.docker.com/products/docker-desktop/');
      process.exit(1);
    }
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
  } else if (os.platform() === 'darwin') {
    spawn('open', ['-a', 'Docker'], { detached: true, stdio: 'ignore' }).unref();
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const ver = tryDockerInfo();
    if (ver) { ok(`Docker engine ${ver} is online`); return; }
    process.stdout.write(`  ${c.dim}waiting for Docker...${c.reset}\r`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  fail('Docker did not become ready in 90s.');
  process.exit(1);
}

function bringUp() {
  banner(FULL ? 'Starting full stack (app + observability)' : 'Starting Rigup stack');
  const files = FULL
    ? ['-f', 'docker-compose.yml', '-f', 'infra/docker-compose.observability.yml']
    : [];
  const args = ['compose', ...files, 'up', '-d'];
  const r = spawnSync('docker', args, { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    fail('docker compose up failed');
    process.exit(r.status || 1);
  }
  ok('Containers started');
}

async function waitForHealth(url, label, maxMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) { ok(`${label} ready (${url})`); return true; }
    } catch (_) { /* not ready */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fail(`${label} did not become healthy in ${maxMs / 1000}s (${url})`);
  return false;
}

function autoSeed() {
  // Seed only if no users exist yet — keeps re-launches idempotent.
  banner('Checking demo data');
  const probe = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'core-api', 'node', '-e',
     "const p=require('./src/db/pool'); p.query('SELECT COUNT(*) AS n FROM users').then(r=>{console.log(r.rows[0].n);process.exit(0)}).catch(e=>{console.error(e.message);process.exit(2)})"
    ],
    { encoding: 'utf8', cwd: ROOT }
  );
  if (probe.status !== 0) {
    warn(`Could not probe users table (${(probe.stderr || '').trim().slice(0, 120)}). Skipping seed.`);
    return;
  }
  const userCount = parseInt(String(probe.stdout).trim(), 10) || 0;
  if (userCount > 0) {
    ok(`${userCount} user(s) already in DB — skipping seed`);
    return;
  }
  warn('Empty database — running seed...');
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'core-api', 'node', 'src/db/seed.js'],
    { stdio: 'inherit', cwd: ROOT }
  );
  if (r.status === 0) ok('Demo data seeded');
  else warn('Seed exited non-zero — check logs');
}

function openBrowser(url) {
  try {
    if (os.platform() === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    else if (os.platform() === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch (_) { /* ignore */ }
}

function readEnv() {
  const file = path.join(ROOT, '.env');
  const out = {};
  try {
    const raw = require('node:fs').readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch (_) { /* no .env yet */ }
  return out;
}

function summary({ apiPort = '5500', fePort = '5173' } = {}) {
  log('');
  log(`${c.bold}${c.cyan}╭──────────────────────────────────────────────╮${c.reset}`);
  log(`${c.bold}${c.cyan}│                RIGUP — RUNNING               │${c.reset}`);
  log(`${c.bold}${c.cyan}╰──────────────────────────────────────────────╯${c.reset}`);
  log(`${c.bold}  Frontend  ${c.reset}→ ${c.green}http://localhost:${fePort}${c.reset}`);
  log(`${c.bold}  API       ${c.reset}→ ${c.green}http://localhost:${apiPort}/api${c.reset}`);
  log(`${c.bold}  Health    ${c.reset}→ ${c.green}http://localhost:${apiPort}/api/health${c.reset}`);
  if (FULL) {
    log(`${c.bold}  Grafana   ${c.reset}→ ${c.green}http://localhost:3001${c.reset} ${c.dim}(admin / admin)${c.reset}`);
    log(`${c.bold}  Prometheus${c.reset}→ ${c.green}http://localhost:9090${c.reset}`);
    log(`${c.bold}  Jaeger    ${c.reset}→ ${c.green}http://localhost:16686${c.reset}`);
  }
  log('');
  log(`${c.dim}  Services:  mysql · core-api (HTTP) · agent-worker (queue) · frontend${c.reset}`);
  log(`${c.dim}  Stop:      npm stop      Logs: npm run logs      Status: npm run ps${c.reset}`);
  log(`${c.dim}  DB shell:  npm run db:shell${c.reset}`);
  log('');
}

(async () => {
  try {
    ensureDocker();
    bringUp();
    banner('Waiting for services');
    const env = readEnv();
    const apiPort = env.CORE_API_PORT || '5500';
    const fePort  = env.FRONTEND_PORT || '5173';
    const apiUrl  = `http://localhost:${apiPort}/api/health`;
    const feUrl   = `http://localhost:${fePort}`;
    const apiOk = await waitForHealth(apiUrl, 'API');
    const fe = await waitForHealth(feUrl, 'Frontend');
    if (apiOk) autoSeed();
    summary({ apiPort, fePort });
    if (apiOk && fe) openBrowser(feUrl);
  } catch (err) {
    fail(err?.message || String(err));
    process.exit(1);
  }
})();
