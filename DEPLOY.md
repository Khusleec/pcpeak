# Rigup — Deployment Guide

Rigup is a multi-service Docker application (frontend + 2 backends + MySQL).
**It cannot deploy as a single Vercel function.** Pick one of these options:

---

## Option 1 — VPS + Docker Compose (Recommended for Diploma)

The simplest path. One server, one IP, identical to local development.
Cost: ~$5/month (Hetzner CX11) or free with student credits (DigitalOcean,
GitHub Education, AWS Educate).

### 1.1 Get a server
- Hetzner Cloud: CX11 (€4/mo, 2 vCPU, 4GB RAM) — best value
- DigitalOcean: $200 free credit for students
- Contabo: VPS S ($5/mo, 4 vCPU, 8GB RAM)

Pick **Ubuntu 22.04** or **Debian 12**.

### 1.2 Point your domain at the server
In your DNS provider:
```
A    rigup.yourdomain.com    →    <server-IP>
```
Wait 1–10 min for DNS to propagate.

### 1.3 SSH in and install Docker
```bash
ssh root@<server-IP>

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Install git
apt update && apt install -y git
```

### 1.4 Clone + configure
```bash
git clone https://github.com/Khusleec/pcpeak.git /opt/rigup
cd /opt/rigup

# Create production env file
cp .env.production.example .env
nano .env   # Edit DOMAIN, JWT_SECRET, MYSQL_PASSWORD, AI_API_KEY
```

**Minimum required edits in `.env`:**
- `DOMAIN=rigup.yourdomain.com`
- `MYSQL_PASSWORD=` (generate strong)
- `MYSQL_ROOT_PASSWORD=` (generate strong)
- `DATABASE_URL=mysql://rigup:<MYSQL_PASSWORD>@mysql:3306/rigup`
- `JWT_SECRET=` (run: `openssl rand -hex 32`)
- `AI_API_KEY=` (your Groq key)

### 1.5 Deploy
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy will automatically issue a Let's Encrypt SSL cert for your domain.
Wait ~30 seconds, then open `https://rigup.yourdomain.com` — done.

### 1.6 Useful commands
```bash
# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f core-api

# Update after git pull
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Stop everything
docker compose -f docker-compose.prod.yml down

# Backup database
docker exec rigup-mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" rigup > backup.sql
```

---

## Option 2 — Railway (GitHub-Push-Deploy)

Railway treats each Docker service as a separate "service". It has native
MySQL plugin, automatic HTTPS, and deploys on every git push.

### 2.1 Sign up
Go to https://railway.app → sign in with GitHub → start trial ($5 free).

### 2.2 Create project
1. **New Project → Deploy from GitHub repo** → pick `Khusleec/pcpeak`
2. Railway will detect 4 services. For each:

   **mysql:**
   - Click **+ New** → **Database** → **MySQL** (Railway managed)
   - Note the `DATABASE_URL` from Variables tab

   **core-api:**
   - Add Service → GitHub repo → set **Root Directory** = `backend/core-api`
   - Variables:
     ```
     PORT=4000
     NODE_ENV=production
     DATABASE_URL=${{ MySQL.DATABASE_URL }}
     JWT_SECRET=<openssl rand -hex 32>
     FRONTEND_URL=https://${{ frontend.RAILWAY_PUBLIC_DOMAIN }}
     PAYMENTS_DEMO_MODE=true
     ```
   - Settings → Networking → **Generate Domain**

   **agent-worker:**
   - Add Service → GitHub repo → set **Root Directory** = `backend/agent-worker`
   - Variables:
     ```
     NODE_ENV=production
     DATABASE_URL=${{ MySQL.DATABASE_URL }}
     AI_API_KEY=<your-groq-key>
     AI_BASE_URL=https://api.groq.com/openai/v1
     AI_MODEL=llama-3.3-70b-versatile
     ```
   - No public domain needed (it's a worker).

   **frontend:**
   - Add Service → GitHub repo → set **Root Directory** = `frontend`
   - Build Variables (must be set BEFORE first build):
     ```
     REACT_APP_API_URL=https://${{ core-api.RAILWAY_PUBLIC_DOMAIN }}/api
     REACT_APP_GOOGLE_MAPS_API_KEY=<optional>
     ```
   - Settings → Networking → **Generate Domain**

3. Each push to `main` re-deploys.

### 2.3 Initialize the database
Railway's MySQL won't auto-run `schema.sql`. You need to run it once:
```bash
# On your laptop, with mysql client installed:
mysql -h <RAILWAY_MYSQL_HOST> -u root -p<RAILWAY_MYSQL_PASS> rigup < backend/core-api/src/db/schema.sql
```

Or use the **Railway CLI** to connect and pipe the file in.

---

## Option 3 — Frontend on Vercel + Backend on Render

If you specifically want the Vercel deploy that errored out:

### Vercel (frontend only)
1. Vercel dashboard → Project Settings → **Build & Development**
2. Set **Root Directory** = `frontend`
3. Framework Preset = **Create React App** (auto-detected)
4. Add Environment Variable:
   - `REACT_APP_API_URL` = `https://<your-render-backend>.onrender.com/api`
6. Redeploy.

### Render (backend)
Render has free Postgres but **no free MySQL**. Use **Aiven free MySQL**
(1-month trial) or **PlanetScale** (deprecated free tier — pay-as-you-go now).

Easier: deploy backend on **Railway** (Option 2) and frontend on **Vercel**.

---

## Production Checklist

Before going live:
- [ ] `JWT_SECRET` is a fresh random 32+ char string
- [ ] `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` are strong (20+ chars)
- [ ] `PAYMENTS_DEMO_MODE=false` if using real QPay credentials
- [ ] DNS A record points to server IP
- [ ] HTTPS works (test: `curl https://rigup.yourdomain.com/api/health`)
- [ ] Firewall allows ports 80, 443 only (close 3306, 4000, 5173, 8090)
- [ ] Set up a daily MySQL backup cron job
- [ ] Monitor logs: `docker compose logs -f --tail=100`

---

## Troubleshooting

**"Cannot find entrypoint" on Vercel** — You're trying to deploy the whole
repo as a Node.js function. Set Root Directory to `frontend` instead.

**Caddy 502** — Check core-api is healthy: `docker compose -f docker-compose.prod.yml ps`.

**SSL not issuing** — DNS hasn't propagated yet, or port 80 is firewalled.
`dig rigup.yourdomain.com` should return your server IP.

**Frontend shows "Network Error"** — `REACT_APP_API_URL` was wrong at build
time. React env vars are baked into the bundle; rebuild after fixing.
