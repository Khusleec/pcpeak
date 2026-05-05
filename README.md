# Rigup

> Plain-React frontend + real SOA backend (queue-split AI agent) + one-command Docker launcher.

```
  ┌──────────────┐     HTTP      ┌──────────────┐    SQL    ┌──────────┐
  │  frontend    │  ──────────►  │   core-api   │  ──────►  │  mysql   │
  │ (React/CRA)  │               │   (Express)  │  ◄──┐     └──────────┘
  └──────────────┘               └──────────────┘     │           ▲
                                       enqueue        │ poll      │ SQL
                                       agent_tasks    │           │
                                                      ▼           │
                                            ┌────────────────────┐│
                                            │   agent-worker     │┘
                                            │ (LLM + tool loop)  │
                                            └────────────────────┘
```

## What's inside

| Service | Tech | Purpose |
|---|---|---|
| `frontend` | React 18 (Create React App, plain JS) | UI: map, cafes, PC grid, bookings, chat widget |
| `core-api` | Node 20 + Express | HTTP API: auth, cafes, pcs, bookings, payments, agent enqueue |
| `agent-worker` | Node 20 + OpenAI SDK | Drains `agent_tasks`, runs LLM + tool calls, writes reply back |
| `mysql` | MySQL 8 | Single source of truth (cafes, pcs, bookings, agent queue) |

The agent split is real SOA: `core-api` writes a row into `agent_tasks` and long-polls it; `agent-worker` claims rows atomically (`UPDATE ... WHERE status='queued'`) and processes independently. Either side can scale or restart without breaking the other.

## Quick start

```bash
git clone <repo> && cd Rigup
cp .env.example .env          # edit JWT_SECRET, MYSQL_PASSWORD, AI_API_KEY
npm start                     # or: ./start.ps1   ./start.sh   make start
```

The launcher boots Docker Desktop if needed, brings up every container, waits on health checks, seeds demo data on first launch, and opens the browser.

| Platform | Command |
|---|---|
| Any (Node ≥ 18) | `npm start` |
| Windows | `./start.ps1` |
| macOS / Linux | `./start.sh` |
| Make | `make start` |
| With observability | `npm run full` (adds Prometheus / Grafana / Jaeger) |

### URLs after start

- Frontend: http://localhost:5173
- API: http://localhost:5500/api
- Health: http://localhost:5500/api/health
- MySQL (host): localhost:33306 (only exposed for admin tooling — services talk over the internal network)

> Default ports (5173 / 5500 / 33306) are picked to avoid Windows' Hyper-V excluded port ranges and not collide with common dev ports (3000, 3306, 4000, 5432, 8080). Override any of them in `.env`.
- Grafana (`--full`): http://localhost:3001 · Prometheus: http://localhost:9090 · Jaeger: http://localhost:16686

### Demo login

Created by the seed script on first boot. Check `backend/core-api/src/db/seed.js` for the exact admin email/password — change them in production.

## Common scripts

```bash
npm stop          # docker compose down
npm run logs      # tail every service
npm run ps        # list containers + status
npm run rebuild   # no-cache rebuild + restart
npm run clean     # down + remove volumes (WARNING: drops the DB)
npm run seed      # re-run seed (won't overwrite — schema is idempotent)
npm run db:shell  # mysql REPL inside the container
```

## How the agent flow works

1. Browser hits `POST /api/agent/chat` with a user message.
2. `core-api` validates the JWT, inserts a row into `agent_tasks` (`status='queued'`), and **long-polls that row** for up to `AGENT_RESPONSE_TIMEOUT_MS` (default 30s).
3. `agent-worker` (separate container) polls every `AGENT_WORKER_POLL_INTERVAL_MS` (default 1s), atomically claims the row, runs the OpenAI-compatible chat-with-tools loop (Groq by default), and writes `reply` back.
4. `core-api` sees `status='done'`, returns `{ reply }` to the browser. If the worker is slow, core-api hands back `{ taskId, status: 'processing' }` (HTTP 202) and the frontend can poll `GET /api/agent/tasks/:id`.

Add `AI_API_KEY` to `.env` to enable the assistant. Without a key, chat returns a clean 503-style error.

## Configuration

All knobs live in `.env`. Most useful:

| Var | Default | Purpose |
|---|---|---|
| `MYSQL_PASSWORD` | `change_me_db` | DB user password (also embedded in `DATABASE_URL`) |
| `JWT_SECRET` | placeholder | **Must be ≥32 chars in production** |
| `AI_API_KEY` | empty | Groq / OpenAI-compatible key |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | Swap for OpenAI / together.ai / etc. |
| `AI_MODEL` | `llama-3.3-70b-versatile` | Any model the provider supports |
| `AGENT_RESPONSE_TIMEOUT_MS` | `30000` | core-api long-poll budget |
| `AGENT_WORKER_POLL_INTERVAL_MS` | `1000` | how often the worker checks for new tasks |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | empty | Optional — offline map sim works without it |

## Folder structure

```
Rigup/
├── frontend/                      React (CRA, plain JS) + nginx Dockerfile
├── backend/
│   ├── core-api/                  Express HTTP service
│   │   ├── src/                   routes, middleware, db, config
│   │   ├── db/migrations/         incremental SQL (incl. agent_tasks table)
│   │   └── Dockerfile
│   └── agent-worker/              Background queue worker
│       ├── src/                   db.js, tools.js, index.js
│       └── Dockerfile
├── infra/
│   ├── db/initdb/                 schema + migrations mounted into mysql:initdb.d
│   ├── monitoring/                Prometheus + Grafana configs
│   ├── scripts/start.js           one-command launcher
│   └── docker-compose.observability.yml
├── k8s/                           production Kubernetes manifests (mysql, core-api, agent-worker, frontend, ingress)
├── docs/                          architecture, ADRs, deployment checklist
├── .github/workflows/             CI/CD
├── docker-compose.yml             dev / single-host stack
├── .env / .env.example
├── package.json                   root npm scripts + launcher
├── start.ps1 / start.sh / Makefile
└── README.md
```

## Production (Kubernetes)

```bash
# Edit secrets first!
cp k8s/secrets.example.yaml k8s/secrets.yaml
# fill in MYSQL_PASSWORD, MYSQL_ROOT_PASSWORD, DATABASE_URL, JWT_SECRET, AI_API_KEY

kubectl apply -k k8s/
kubectl get pods -n rigup
```

Every service is independently scalable. The `agent-worker` Deployment is safe to scale horizontally — claims are atomic via `UPDATE ... WHERE status='queued'`.

## License

Private — internal project.
