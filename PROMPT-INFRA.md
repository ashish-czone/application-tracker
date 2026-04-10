# Infrastructure & Deployment Rules

Infrastructure conventions and deployment setup. Read actual Docker/CI files for YAML — this doc covers rules and decisions, not config duplication.

---

## Tech Stack

- **Hosting:** DigitalOcean (demo: single droplet, prod: droplet or EC2)
- **Containerization:** Docker + Docker Compose
- **DB:** PostgreSQL 17 | **Cache/Queue:** Redis 7
- **File storage:** MinIO (S3-compatible, swappable to real S3)
- **Monitoring:** docker-autoheal + Dozzle (log viewer)
- **Email (dev):** Mailpit | **Reverse proxy:** Caddy (when domain configured)
- **CI/CD:** GitHub Actions
- **No Kubernetes. Single-server Docker Compose.**

---

## 1. Service Architecture

### Dev/Demo (single server, ~475MB RAM, fits $6/mo droplet)

8 containers: api (combined API+worker), web (nginx), postgres, redis, minio, mailpit, autoheal, dozzle.

### Production

API and worker run as separate containers from the **same Docker image**. Only env flags differ (`API_ENABLED`, `WORKER_ENABLED`). Use `docker-compose.prod.yml` override. Remove mailpit.

---

## 2. Dockerfile Rules

1. Multi-stage builds (deps → build → runtime).
2. Never install dev dependencies in runtime stage.
3. Never copy `.env` into images.
4. Pin base image versions (`node:22-alpine`).
5. `USER node` in runtime — never run as root.
6. `--frozen-lockfile` for reproducible installs.

---

## 3. Worker Toggle

`main.ts` uses `API_ENABLED` and `WORKER_ENABLED`:
- `API_ENABLED=false` → no HTTP server, port binding, Swagger.
- `WORKER_ENABLED=false` → job definitions registered but consumers not started. API can still enqueue.

---

## 4. Health Monitoring

**Layer 1:** `restart: always` on every container.
**Layer 2:** `healthcheck` directives + docker-autoheal (restarts unhealthy containers after 90s).

| Service | Check |
|---|---|
| API/Worker | `curl /health` |
| PostgreSQL | `pg_isready` |
| Redis | `redis-cli ping` |
| MinIO | `mc ready local` |

Add UptimeRobot (free) when domain configured for external monitoring.

---

## 5. Logging

- Apps write structured JSON to stdout. Docker captures as JSON files.
- Log rotation per container: `max-size: 50m, max-file: 5` (~250MB history).
- Dozzle at `:8080` for real-time log viewing.
- Upgrade path: Grafana Loki + Grafana for dashboards.

---

## 6. Queue Monitoring (Bull Board)

Mounts inside API process at `/admin/queues`. Shows queue stats, job details, manual retry/remove. Protected by auth + admin permission. Available in all environments.

---

## 7. File Storage (MinIO)

S3-compatible. Swap to real S3 via env config — zero code changes.

**Rules:** Never store in container filesystem. UUID-based file keys. Signed URLs with expiration.

---

## 8. Email

Dev: Mailpit (catches all, web UI at `:8025`). Production: real SMTP (Resend, SES, Postmark).

---

## 9. Environments

`.env` per app (gitignored), `.env.example` committed. Key differences between dev and prod: NODE_ENV, API/WORKER flags, Swagger, debug logging, rate limiting, CORS, email, file storage.

**Secrets:** Never commit. Never bake into images. Dev and prod never share credentials.

---

## 10. CI/CD (GitHub Actions)

Pipeline: `lint → test → build → deploy`. Feature branches: lint + test + build only.

**Rules:**
1. Migrations run before new code starts (pull images → migrate → restart).
2. Never skip lint or tests.
3. Images tagged with `latest` + git SHA for rollback.
4. Secrets in GitHub Actions secrets only.

---

## 11. Database Operations

- Migrations forward-only. Never edit deployed migrations.
- Migration files committed in `packages/core/database/drizzle/`.
- Production backups: BullMQ repeatable job → pg_dump → compress → S3. 7-day retention via lifecycle policy.
- Connection pooling for multiple API instances.

---

## 12. Reverse Proxy & SSL

Caddy auto-provisions HTTPS via Let's Encrypt. Add when domain is configured. Routes: `/api/*` and `/health*` → api, everything else → web. Remove direct port mappings for api/web.

---

## 13. Production Upgrade Path

| Concern | Current | Upgrade |
|---|---|---|
| API + Worker | Combined | Separate containers |
| Database | Local container | Managed (DO/RDS) |
| File storage | MinIO | AWS S3 / DO Spaces |
| Email | Mailpit | Resend / SES |
| Monitoring | Dozzle | Grafana Loki |
| Scaling | Bigger droplet | Multiple servers + LB |
