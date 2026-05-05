# Deployment Checklist

Use this checklist before each production release.

## Pre-deploy

- [ ] `.env` is based on `.env.example`
- [ ] `POSTGRES_PASSWORD` is strong and rotated
- [ ] `CORE_API_JWT_SECRET` is strong and rotated
- [ ] `VITE_API_BASE_URL` points to the production API URL
- [ ] Required ports are open (`3000`, `8080`, `5432` if needed internally only)
- [ ] Docker daemon is running on deploy host

## Build and start

- [ ] Run `./infra/scripts/deploy.ps1` from repo root (PowerShell)
- [ ] Confirm all services show `Up` in `docker compose ps`
- [ ] Wait until all healthchecks are `healthy`

## Smoke test

- [ ] Open frontend URL and verify main page loads
- [ ] Check API health endpoint (`/health`) returns status ok
- [ ] Login and one protected API route works
- [ ] Worker container logs show no startup errors

## Post-deploy

- [ ] Save deployment timestamp and image digests/tags
- [ ] Capture `docker compose ps` output for release record
- [ ] Monitor logs and metrics for at least 15 minutes
