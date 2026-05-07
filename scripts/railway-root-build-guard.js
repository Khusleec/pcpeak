/**
 * Root package.json "build" runs `docker compose build` for local dev.
 * Railway has no Docker during Nixpacks build — if the service Root Directory
 * is wrong (repo root), fail fast with a clear message.
 */
const { execSync } = require('child_process');

if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
  console.error(
    '\n[Railway] This repo is a monorepo. Do not deploy from the root.\n' +
      '  Service → Settings → Root Directory → one of:\n' +
      '    backend/core-api\n' +
      '    frontend\n' +
      '    backend/agent-worker\n'
  );
  process.exit(1);
}

execSync('docker compose build', { stdio: 'inherit' });
