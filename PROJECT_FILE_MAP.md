# Rigup — Project File Map for Diploma

## System Architecture

### 1. Өндөр түвшний бүтэц (High-Level)

```
                    ┌─────────────────────────────────────────┐
                    │            DOCKER COMPOSE                │
                    │         (rigup-network bridge)           │
                    │                                         │
┌──────────┐       ┌──────────┐       ┌──────────┐          │
│ FRONTEND │ HTTP  │ CORE-API │ SQL   │  MYSQL   │          │
│ React 18 │──────▶│ Express  │──────▶│   8.0    │          │
│ nginx:80 │       │ :4000    │       │  :3306   │          │
│  :5173   │       │          │       │          │          │
└──────────┘       └────┬─────┘       └────▲─────┘          │
                        │                  │                 │
                        │  INSERT task     │ SQL             │
                        │  (agent_tasks)   │                 │
                        ▼                  │                 │
                   ┌──────────┐            │                 │
                   │  AGENT-  │────────────┘                 │
                   │  WORKER  │  poll + UPDATE               │
                   │ Node.js  │                              │
                   │  :8090   │                              │
                   └────┬─────┘                              │
                        │  HTTPS (Groq API)                  │
                        ▼                                    │
                   ┌──────────┐                              │
                   │  GROQ    │                              │
                   │  Llama   │                              │
                   │  3.3 70B │                              │
                   └──────────┘                              │
                    └─────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │         ГАДААД СИСТЕМҮҮД                 │
                    │  • QPay API    (merchant.qpay.mn)       │
                    │  • Google OAuth (accounts.google.com)   │
                    │  • Google Maps  (maps.googleapis.com)   │
                    │  • Groq API     (api.groq.com)          │
                    └─────────────────────────────────────────┘
```

### 2. CORE-API доторх бүтэц (Internal)

```
┌─────────────────────────────────────────────────────────────┐
│                     CORE-API (Express)                       │
│                                                             │
│  MIDDLEWARE: helmet → cors → rate-limit → passport          │
│  AUTH:      authenticateToken (JWT) → authorize(role)       │
│                                                             │
│  ROUTES (6 файл):                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  /auth   │ │ /cafes   │ │  /pcs    │ │  /bookings   │  │
│  │ register │ │ CRUD     │ │ filter   │ │ create/my/   │  │
│  │ login    │ │          │ │ by cafe  │ │ cancel/all   │  │
│  │ Google   │ │          │ │          │ │              │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────┐ ┌──────────────┐                         │
│  │  /payments   │ │   /agent     │                         │
│  │ invoice      │ │ POST chat    │                         │
│  │ simulate     │ │ GET task/:id │                         │
│  │ sync/callback│ │              │                         │
│  └──────────────┘ └──────────────┘                         │
│                                                             │
│  SERVICES:                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │   qpay.api.js       │  │  qpay.booking.js    │          │
│  │ • auth/token        │  │ • issueDepositInv   │          │
│  │ • invoice create    │  │ • markPaidIfCheck   │          │
│  │ • payment/check     │  │ • callbackSignature │          │
│  │ • ebarimt/create    │  │                     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  DATA: pool.js (MySQL2) → mysql:3306                       │
└─────────────────────────────────────────────────────────────┘
```

### 3. AGENT-WORKER доторх бүтэц

```
┌─────────────────────────────────────────────────────────────┐
│                 AGENT-WORKER (Node.js)                       │
│                                                             │
│  MAIN LOOP (tick → 1 sec тутамд):                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. claimNextTask()                                   │  │
│  │    SELECT queued → UPDATE status='processing'        │  │
│  │    (atomic CAS — давхар боловсруулалтаас хамгаална)  │  │
│  │                                                      │  │
│  │ 2. runAgentLoop(userId, message)                     │  │
│  │    ┌────────────────────────────────────────────┐    │  │
│  │    │ SYSTEM PROMPT (Монгол хэл, найрсаг)        │    │  │
│  │    │ + history (өмнөх 12 яриа)                  │    │  │
│  │    │ + user message                             │    │  │
│  │    └────────────────┬───────────────────────────┘    │  │
│  │                     ▼                                │  │
│  │    shouldAttachBookingTools()?                       │  │
│  │    "захиалга/салбар/booking" → tools ON/OFF         │  │
│  │                     ▼                                │  │
│  │    Groq API → Llama 3.3 70B                         │  │
│  │                     ▼                                │  │
│  │    LLM tool_call? → executeTool() → SQL → result    │  │
│  │    (max 8 rounds, tool-д хариу буцааж LLM-д өгнө)   │  │
│  │                                                      │  │
│  │ 3. markDone(id, reply) / markFailed(id, error)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  5 TOOLS (LLM function calling):                            │
│  list_cafes | get_available_pcs | create_booking            │
│  get_my_bookings | cancel_booking                           │
│                                                             │
│  HEALTH: HTTP :8090/health (Docker healthcheck)             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Өгөгдлийн сангийн бүтэц (MySQL Schema — 9 хүснэгт)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────┐
│  roles   │────▶│  users   │────▶│ bookings │────▶│booking_items │
│ id,name  │     │ id(UUID) │     │ id(UUID) │     │ booking_id   │
│ admin,   │     │ email    │     │ user_id  │     │ pc_id, price │
│ mod,user │     │ google_id│     │ cafe_id  │     └──────┬───────┘
└──────────┘     │ password │     │ total_price│           │
                 │ role_id  │     │ status    │            ▼
                 └──────────┘     │ starts_at │     ┌──────────┐
                      │           │ ends_at   │     │   pcs    │
                      │           │ payment_  │     │ id,label │
┌──────────┐         │           │  status   │     │ tier_id  │
│  cafes   │         │           │ qpay_inv  │     │ cafe_id  │
│ id,name  │◀────────┼───────────│ cafe_id   │     │ status   │
│ address  │         │           └───────────┘     └────┬─────┘
│ lat,lng  │         │                                 │
└──────────┘         │           ┌──────────┐          ▼
                     │           │ pc_tiers │     ┌──────────┐
┌──────────────────┐ │           │ id,name  │◀────│   pcs    │
│oauth_exchange_   │ │           │ gpu,ram  │     └──────────┘
│     codes        │ │           │ cpu      │
│ code(64),user_id │ │           │ price/hr │
│ expires_at,used  │ │           └──────────┘
└──────────────────┘ │
                     │
┌──────────────────────┐
│    agent_tasks       │
│ id(UUID), user_id    │
│ message, status      │
│ reply, error         │
│ status: queued →     │
│ processing → done    │
└──────────────────────┘
```

### 5. Хүсэлтийн урсгал — Захиалга үүсгэх

```
ХЭРЭГЛЭГЧ          FRONTEND              CORE-API                MYSQL
─────────          ────────              ────────                ─────
   │                 │                     │                      │
   │ PC+цаг сонгоно  │                     │                      │
   │────────────────▶│                     │                      │
   │                 │ POST /api/bookings  │                      │
   │                 │────────────────────▶│                      │
   │                 │                     │ BEGIN TRANSACTION    │
   │                 │                     │─────────────────────▶│
   │                 │                     │ PC шалгах (cafe+stat)│
   │                 │                     │─────────────────────▶│
   │                 │                     │◀─────────────────────│
   │                 │                     │ Цаг давхардал шалгах │
   │                 │                     │─────────────────────▶│
   │                 │                     │◀─────────────────────│
   │                 │                     │ Үнэ бодох (hrs×rate) │
   │                 │                     │ INSERT booking+items │
   │                 │                     │─────────────────────▶│
   │                 │                     │ COMMIT               │
   │                 │                     │─────────────────────▶│
   │                 │                     │ QPay invoice үүсгэх  │
   │                 │                     │ (demo эсвэл real)    │
   │                 │ { booking, qpay }   │                      │
   │                 │◀────────────────────│                      │
   │ Захиалга харна │                     │                      │
   │◀────────────────│                     │                      │
```

### 6. Хүсэлтийн урсгал — AI Чат

```
ХЭРЭГЛЭГЧ       FRONTEND         CORE-API          MYSQL        AGENT-WORKER      GROQ
─────────       ────────         ────────          ─────        ────────────      ────
   │              │                │                 │               │              │
   │ "Салбарууд"  │                │                 │               │              │
   │─────────────▶│                │                 │               │              │
   │              │ POST /agent/   │                 │               │              │
   │              │      chat      │                 │               │              │
   │              │───────────────▶│                 │               │              │
   │              │                │ INSERT queued   │               │              │
   │              │                │────────────────▶│               │              │
   │              │                │ LONG POLL (30s) │               │              │
   │              │                │◀────────────────│               │              │
   │              │                │                 │ claimNextTask │              │
   │              │                │                 │◀──────────────│              │
   │              │                │                 │ UPDATE proc   │              │
   │              │                │                 │──────────────▶│              │
   │              │                │                 │               │ Chat API     │
   │              │                │                 │               │─────────────▶│
   │              │                │                 │               │ list_cafes() │
   │              │                │                 │               │◀─────────────│
   │              │                │                 │ SELECT cafes  │              │
   │              │                │                 │◀──────────────│              │
   │              │                │                 │──────────────▶│              │
   │              │                │                 │               │ result→LLM   │
   │              │                │                 │               │─────────────▶│
   │              │                │                 │               │◀─────────────│
   │              │                │                 │ markDone()    │              │
   │              │                │                 │◀──────────────│              │
   │              │                │ POLL → done     │               │              │
   │              │                │◀────────────────│               │              │
   │              │ { reply }      │                 │               │              │
   │              │◀───────────────│                 │               │              │
   │ "3 салбар"   │                │                 │               │              │
   │◀─────────────│                │                 │               │              │
```

### 7. Хүсэлтийн урсгал — Төлбөр (Payment)

```
DEMO MODE:
  Хэрэглэгч → "ТӨЛБӨР ТӨЛӨХ (ЖИШЭЭ)" → payDeposit()
  → POST invoice (demo invoice, QPay API дуудагдахгүй)
  → POST simulate → UPDATE status='confirmed', payment='paid'
  → Toast: "ТӨЛБӨР БАТАЛГААЖЛАА (ЖИШЭЭ)"

REAL QPAY:
  Хэрэглэгч → "ТӨЛБӨР ТӨЛӨХ (QPay)" → payDeposit()
  → POST invoice → qpay.api.js:
      1. POST /v2/auth/token (Basic auth) → access_token
      2. POST /v2/invoice (amount, callback_url, ebarimt data)
      3. QPay → payment URLs + QR code
  → Frontend opens payment page (bank app / QPay app)
  → Хэрэглэгч төлбөрөө хийнэ
  → QPay POST /api/payments/qpay/callback?booking_id=X&sig=Y
  → HMAC signature verify (timingSafeEqual)
  → qpay.api.js: POST /v2/payment/check → paid = true
  → UPDATE status='confirmed', payment='paid'
  → Optional: POST /v2/ebarimt/create → e-barimt
```

---

## 1. Root Level — Project Configuration

| File | Purpose |
|---|---|
| `docker-compose.yml` | Defines all 4 services (mysql, core-api, agent-worker, frontend), their ports, environment variables, healthchecks, and Docker network |
| `.env` | All environment variables: database credentials, JWT secret, QPay payment config, AI API keys, service ports |
| `.env.example` | Template for `.env` with documentation comments |
| `Makefile` | Shortcut commands (`make up`, `make down`, `make logs`) |
| `start.sh` | One-click start script for Linux/macOS |
| `start.ps1` | One-click start script for Windows PowerShell |
| `package.json` | Root npm scripts (`npm start` → runs `infra/scripts/start.js`) |
| `README.md` | Project overview, features, tech stack, setup instructions |

---

## 2. Backend — `core-api` (Express REST API)

The main HTTP service. Handles authentication, cafe/PC management, booking creation, payment processing, and AI chat enqueueing.

### 2.1 Entry Point

| File | Purpose |
|---|---|
| `backend/core-api/src/index.js` | **Application bootstrap.** Creates Express app, applies security middleware (helmet, cors, rate-limit), mounts all 6 route groups, exposes `/api/config/public` (tells frontend payment mode), `/api/health` (Docker healthcheck) |

### 2.2 Configuration

| File | Purpose |
|---|---|
| `backend/core-api/src/config/index.js` | **Central configuration.** Reads all environment variables, builds `config.qpay` object (enabled only when invoice_code + auth credentials are present), determines `paymentsDemoMode`, `simulatePaymentAllowed`, JWT settings, AI provider settings |
| `backend/core-api/src/config/passport.js` | Google OAuth 2.0 strategy setup using Passport.js |

### 2.3 Database Layer

| File | Purpose |
|---|---|
| `backend/core-api/src/db/schema.sql` | **Full MySQL schema.** Creates 8 tables: `roles` (RBAC), `users` (Google OAuth + email/password), `cafes` (branches with GPS), `pc_tiers` (Zaal/VIP with hardware specs), `pcs` (individual machines), `bookings` (reservations), `booking_items` (junction table), `oauth_exchange_codes` (secure token exchange). Seeds default roles and PC tiers |
| `backend/core-api/src/db/pool.js` | MySQL2 connection pool with retry logic and connection management |
| `backend/core-api/src/db/init.js` | Runs `schema.sql` on first startup |
| `backend/core-api/src/db/migrate.js` | Adds QPay payment columns (`payment_status`, `deposit_amount`, `qpay_invoice_id`, `qpay_ebarimt_json`) to existing tables |
| `backend/core-api/src/db/seed.js` | Inserts demo data: 3 cafe branches across Ulaanbaatar, 15 PCs (5 per branch), test user account |
| `backend/core-api/src/db/reset.js` | Drops and recreates all tables (development tool) |

### 2.4 Middleware

| File | Purpose |
|---|---|
| `backend/core-api/src/middleware/auth.js` | **JWT authentication + RBAC.** `authenticateToken` — verifies Bearer token from Authorization header. `authorize('admin', 'moderator')` — checks user role from database. `generateToken` — creates signed JWT with user id and email |
| `backend/core-api/src/middleware/validate.js` | Zod schema validation middleware factory — validates request body against a schema, returns 400 with Mongolian error messages on failure |

### 2.5 Validators (Zod Schemas)

| File | Purpose |
|---|---|
| `backend/core-api/src/validators/auth.validator.js` | Validation schemas for register (email format, password min 6 chars, display name required), login, OAuth exchange code |
| `backend/core-api/src/validators/booking.validator.js` | Validation schema for create booking (cafe_id, pc_ids array, ISO datetime strings) |
| `backend/core-api/src/validators/cafe.validator.js` | Validation schema for cafe queries |

### 2.6 Routes (API Endpoints)

| File | Endpoints | Purpose |
|---|---|---|
| `backend/core-api/src/routes/auth.routes.js` | `POST /api/auth/register`<br>`POST /api/auth/login`<br>`GET /api/auth/me`<br>`GET /api/auth/google`<br>`GET /api/auth/google/callback`<br>`POST /api/auth/oauth/exchange` | **Authentication service.** Local email/password registration with bcrypt (12 rounds). Login returns JWT. Google OAuth 2.0 flow with one-time exchange codes (no JWT in browser URL for security). Current user endpoint |
| `backend/core-api/src/routes/cafe.routes.js` | `GET /api/cafes`<br>`GET /api/cafes/:id`<br>`POST /api/cafes` (admin)<br>`PUT /api/cafes/:id` (admin) | **Cafe CRUD.** List/search cafes with available PC counts. Admin create/update with GPS coordinates |
| `backend/core-api/src/routes/pc.routes.js` | `GET /api/pcs`<br>`GET /api/pcs/:id` | **PC listing.** Filter by cafe, tier (Zaal/VIP), availability status |
| `backend/core-api/src/routes/booking.routes.js` | `POST /api/bookings`<br>`GET /api/bookings/my`<br>`PATCH /api/bookings/:id/cancel`<br>`GET /api/bookings/all` (admin) | **Booking engine.** Multi-PC booking with: (1) PC ownership verification, (2) time conflict detection using SQL overlap query, (3) price calculation from tier rates × hours, (4) deposit flow decision (`useDepositFlow = qpay.enabled \|\| paymentsDemoMode`), (5) automatic invoice generation. Cancel with status validation |
| `backend/core-api/src/routes/payment.routes.js` | `POST /api/payments/qpay/bookings/:id/invoice`<br>`POST /api/payments/simulate/bookings/:id`<br>`POST /api/payments/qpay/bookings/:id/sync`<br>`GET\|POST /api/payments/qpay/callback` | **Payment layer.** Invoice creation (demo or real QPay). Simulate payment for development. Sync with QPay to check payment status. Callback handler with HMAC-SHA256 signature verification (timing-safe comparison) |
| `backend/core-api/src/routes/agent.routes.js` | `POST /api/agent/chat`<br>`GET /api/agent/tasks/:id` | **AI chat thin layer.** Enqueues user message into `agent_tasks` table with conversation history. Long-polls the row (up to 30 seconds) until agent-worker marks it done/failed. Returns 202 if timeout — frontend can poll `/tasks/:id` |

### 2.7 Services (Business Logic)

| File | Purpose |
|---|---|
| `backend/core-api/src/services/qpay.api.js` | **QPay HTTP client.** `POST /v2/auth/token` — Basic auth (client_id:client_secret) → access token (cached in memory, auto-refreshed). `POST /v2/invoice` — creates payment invoice with amount, description, callback URL, e-barimt receiver data. `POST /v2/payment/check` — verifies if invoice was paid (object_type=INVOICE). `POST /v2/ebarimt/create` — issues e-barimt after successful payment |
| `backend/core-api/src/services/qpay.booking.js` | **Deposit invoice orchestration.** `issueDepositInvoice` — in demo mode returns fake invoice with frontend URL, in real mode calls qpay.api. `markPaidIfCheckSucceeds` — checks QPay payment status, updates booking to confirmed/paid in database. `callbackSignature` — generates HMAC-SHA256 signature for callback verification |

---

## 3. Backend — `agent-worker` (AI Background Service)

A separate Node.js process that polls the database for queued AI tasks and executes them using an LLM with tool-calling capability.

| File | Purpose |
|---|---|
| `backend/agent-worker/src/index.js` | **Worker main loop.** Polls `agent_tasks` for queued rows every 1 second. Claims tasks atomically (`UPDATE...WHERE status='queued'` — prevents duplicate processing if scaled horizontally). Runs LLM + tool loop with Groq API (Llama 3.3 70B). Writes reply or error back to database. Serves `/health` on port 8090 for Docker healthcheck. Graceful shutdown on SIGINT/SIGTERM |
| `backend/agent-worker/src/tools.js` | **5 LLM-callable tools** with OpenAI function schemas: `list_cafes` — returns active branches with available PC counts. `get_available_pcs` — filters by cafe, tier, time slot (excludes conflicting bookings). `create_booking` — full booking flow with conflict check, price calculation, transaction. `get_my_bookings` — user's reservation history. `cancel_booking` — status validation and update |
| `backend/agent-worker/src/db.js` | MySQL2 connection pool (connects to same database as core-api) |

**How the AI chat works:**
1. User types message in ChatWidget → `POST /api/agent/chat`
2. core-api inserts row into `agent_tasks` table (status = `queued`)
3. core-api long-polls the row (up to 30 seconds)
4. agent-worker picks up the row, calls Groq/Llama API with system prompt + tools
5. If user asks about bookings/cafes → LLM calls appropriate tool → worker executes SQL → returns structured result
6. LLM formats a natural language response from the tool result
7. Worker writes reply to database → core-api returns it to frontend

---

## 4. Frontend — React SPA

Single Page Application built with React 18, React Router 6, and custom CSS (dark theme, glassmorphism design).

### 4.1 Entry & Routing

| File | Purpose |
|---|---|
| `frontend/src/index.js` | ReactDOM render, wraps App in BrowserRouter, AuthProvider (context), react-hot-toast |
| `frontend/src/App.js` | Route definitions: `/` (Home), `/login`, `/register`, `/map`, `/cafes/:id` (booking), `/bookings` (my reservations), `/profile`, `/auth/callback` (OAuth) |

### 4.2 Pages

| File | Purpose |
|---|---|
| `frontend/src/pages/HomePage.js` | Landing page with hero section, feature cards (3 reasons to use Mongol PC), call-to-action button |
| `frontend/src/pages/LoginPage.js` | Email/password login form with validation, Google OAuth button, link to register |
| `frontend/src/pages/RegisterPage.js` | Registration form (display name, email, password, confirm password) |
| `frontend/src/pages/MapPage.js` | Map view with CafeMap component showing all branches |
| `frontend/src/pages/CafeDetailPage.js` | **Booking form.** Shows cafe info, PC grid (Zaal/VIP cards with hardware specs and pricing), datetime pickers for start/end time, BookingSummary with price breakdown. Creates booking via `POST /api/bookings` |
| `frontend/src/pages/BookingsPage.js` | **My bookings dashboard.** Splits into two sections: (1) Active — confirmed/pending_payment bookings with future end time, (2) History — cancelled/completed/past bookings. Payment buttons: "ТӨЛБӨР ТӨЛӨХ" (QPay or demo), "Жишээ: баталгаажуулах" (simulate), "ЦУЦЛАХ" (cancel). Auto-detects payment mode from `/api/config/public` |
| `frontend/src/pages/ProfilePage.js` | User profile with display name, email, role, booking statistics |
| `frontend/src/pages/AuthCallback.js` | Handles Google OAuth callback — extracts one-time code from URL, exchanges it for JWT via `POST /api/auth/oauth/exchange`, redirects to home |

### 4.3 Components

| File | Purpose |
|---|---|
| `frontend/src/components/Navbar.js` | Top navigation bar with logo, links (Map, Bookings), user menu (profile, logout) |
| `frontend/src/components/CafeMap.js` | Google Maps integration with custom markers for each cafe branch. Falls back to static list if no API key |
| `frontend/src/components/PCGrid.js` | PC tier selection cards showing Zaal (RTX 4070, ₮3,500/hr) and VIP (RTX 5070, ₮5,500/hr) with hardware specifications |
| `frontend/src/components/BookingSummary.js` | Price breakdown: hours × hourly rate, total price, 30% deposit amount |
| `frontend/src/components/ChatWidget.js` | Floating AI chat bubble (bottom-right). Sends messages to `/api/agent/chat`, displays conversation history, shows typing indicator |

### 4.4 Infrastructure

| File | Purpose |
|---|---|
| `frontend/src/api/axios.js` | Axios instance with base URL from env, automatic Authorization header injection from stored token |
| `frontend/src/context/AuthContext.js` | React Context for global user state: login, register, logout functions, token management in localStorage, user object |
| `frontend/src/utils/qpay.js` | `pickQpayLink` — extracts the correct payment URL from QPay response (handles multiple URL formats: urls array, qr_text for QR codes) |
| `frontend/src/styles/index.css` | Global CSS: dark theme, glassmorphism effects, monospace typography, neon accent colors (red/amber/cyan), responsive layout |

### 4.5 Deployment

| File | Purpose |
|---|---|
| `frontend/Dockerfile` | Multi-stage build: (1) Node.js stage builds React app with `npm run build`, (2) Nginx stage serves static files with custom nginx.conf |
| `frontend/nginx.conf` | Nginx config: serves React build, proxies `/api` requests to core-api, enables gzip compression, sets caching headers |

---

## 5. Infrastructure

| File | Purpose |
|---|---|
| `infra/scripts/start.js` | **Automated startup script.** Checks Docker engine, starts Docker Desktop if needed (Windows), runs `docker compose up -d`, waits for all healthchecks, seeds demo data if database is empty, prints access URLs, opens browser |
| `infra/db/initdb/` | MySQL initialization scripts that run on first container boot (schema + seed data) |
| `infra/docker-compose.observability.yml` | Optional monitoring stack: Prometheus (metrics collection), Grafana (dashboards), Jaeger (distributed tracing) |
| `infra/monitoring/` | Prometheus configuration and Grafana dashboard JSON files |

---

## 6. Documentation

| File | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | System architecture diagram and component descriptions |
| `docs/API.md` | Complete API endpoint reference with request/response examples |
| `docs/ARCHITECTURE_DECISION_RECORDS.md` | Key technical decisions: why MySQL, why JWT, why Docker Compose, why Groq/Llama, why deposit flow |
| `docs/DEVELOPER_GUIDE.md` | Development setup: prerequisites, local development without Docker, environment variables, testing |
| `docs/DEPLOYMENT_CHECKLIST.md` | Production deployment steps: server requirements, SSL, domain, QPay configuration |
| `docs/QUICKSTART.md` | Quick start guide for new developers |

---

## 7. Key Technical Decisions

### Why Microservices (4 containers)?
- **Separation of concerns**: API handles HTTP, worker handles AI — they scale independently
- **Fault isolation**: If AI worker crashes, bookings still work
- **Different resource profiles**: Worker needs more CPU/RAM for LLM inference

### Why MySQL?
- Relational data model fits the domain (users → bookings → PCs → cafes)
- ACID transactions for booking creation (prevent double-booking)
- JSON column support for flexible data (e-barimt responses)

### Why QPay Deposit Flow (30%)?
- Reduces no-shows — users have skin in the game
- Industry standard in Mongolian gaming cafes
- Demo mode allows testing without real merchant account

### Why Groq + Llama 3.3 for AI?
- Groq provides fastest inference (LPU hardware)
- Llama 3.3 70B is open-weight, cost-effective
- OpenAI-compatible API — easy to swap providers

### Why JWT + Google OAuth?
- Stateless authentication — no server-side sessions
- Google OAuth removes password friction
- RBAC (admin/moderator/user) for future admin panel

---

## 8. Data Flow: Booking Creation

```
1. User selects cafe → picks PCs → chooses time → clicks "Захиалах"
2. CafeDetailPage.js → POST /api/bookings { cafe_id, pc_ids, starts_at, ends_at }
3. booking.routes.js:
   a. BEGIN transaction
   b. Verify all PCs belong to cafe AND are available
   c. Check time conflicts (SQL overlap: existing.starts < new.ends AND existing.ends > new.starts)
   d. Calculate price: tier.price_per_hour × hours
   e. Decide deposit flow: qpay.enabled || paymentsDemoMode → pending_payment, else → confirmed
   f. INSERT booking + booking_items
   g. COMMIT
   h. If deposit flow: call issueDepositInvoice → creates QPay invoice (real or demo)
4. Response: { booking, qpay (invoice URLs), deposit_amount }
5. Frontend shows booking card with "ТӨЛБӨР ТӨЛӨХ" button
```

## 9. Data Flow: Payment Confirmation

```
DEMO MODE:
1. User clicks "ТӨЛБӨР ТӨЛӨХ (ЖИШЭЭ)"
2. payDeposit() → POST /api/payments/qpay/bookings/:id/invoice → returns fake invoice
3. Auto-calls POST /api/payments/simulate/bookings/:id
4. Database: status → 'confirmed', payment_status → 'paid'
5. Toast: "ТӨЛБӨР БАТАЛГААЖЛАА (ЖИШЭЭ)"

REAL QPAY MODE:
1. User clicks "ТӨЛБӨР ТӨЛӨХ (QPay)"
2. payDeposit() → POST /api/payments/qpay/bookings/:id/invoice
3. qpay.api.js → POST /v2/auth/token (Basic auth) → access_token
4. qpay.api.js → POST /v2/invoice { invoice_code, amount, callback_url, ... }
5. QPay returns payment URLs + QR code
6. Frontend opens payment page in new tab
7. User pays via bank app / QPay app
8. QPay POSTs to /api/payments/qpay/callback?booking_id=X&sig=Y
9. payment.routes.js verifies HMAC signature
10. qpay.booking.js → POST /v2/payment/check → confirms payment
11. Database: status → 'confirmed', payment_status → 'paid'
12. Optional: POST /v2/ebarimt/create → e-barimt issued
```

---

*Generated for diploma documentation — May 2026*
