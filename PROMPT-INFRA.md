# Infrastructure & Deployment Rules

This document defines the infrastructure setup, containerization, CI/CD, and deployment conventions. Follow every instruction exactly.

---

## Tech Stack

- **Hosting (demos):** DigitalOcean droplet (single server)
- **Hosting (production):** DigitalOcean or AWS EC2
- **Containerization:** Docker + Docker Compose
- **Database:** PostgreSQL 17
- **Queue/Cache:** Redis 7
- **File storage:** MinIO (self-hosted, S3-compatible)
- **Health monitoring:** docker-autoheal
- **Log viewer:** Dozzle
- **Email (dev):** Mailpit
- **Reverse proxy:** Caddy (added when a domain is configured)
- **CI/CD:** GitHub Actions
- **No Kubernetes. No managed container services. Single-server Docker Compose.**

---

## 1. Docker Compose — Service Architecture

### Dev / Demo (single server)

API and worker run as a single process to reduce resource usage. Controlled via `WORKER_ENABLED` env variable.

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      - API_ENABLED=true
      - WORKER_ENABLED=true
    env_file:
      - apps/api/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: always
    ports:
      - "5173:80"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:17
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: starter
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  minio:
    image: minio/minio
    restart: always
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  mailpit:
    image: axllent/mailpit
    restart: always
    ports:
      - "8025:8025"
      - "1025:1025"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  autoheal:
    image: willfarrell/autoheal
    restart: always
    environment:
      AUTOHEAL_CONTAINER_LABEL: all
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  dozzle:
    image: amir20/dozzle
    restart: always
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### Resource usage (demo)

| Service | Container | RAM |
|---|---|---|
| API + Worker (combined) | `api` | ~200MB |
| Web (nginx) | `web` | ~10MB |
| PostgreSQL 17 | `postgres` | ~100MB |
| Redis 7 | `redis` | ~30MB |
| MinIO | `minio` | ~100MB |
| docker-autoheal | `autoheal` | ~10MB |
| Dozzle | `dozzle` | ~15MB |
| Mailpit | `mailpit` | ~10MB |
| **Total** | **8 containers** | **~475MB** |

Fits on a **$6/mo DigitalOcean droplet (1GB RAM)**.

### Production override

In production, API and worker run as separate containers from the **same Docker image** (`apps/api/Dockerfile`). The worker runs the same codebase — the only difference is `WORKER_ENABLED`. No separate Dockerfile needed.

Use a `docker-compose.prod.yml` override:

```yaml
# docker-compose.prod.yml
services:
  api:
    environment:
      - API_ENABLED=true
      - WORKER_ENABLED=false

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: always
    environment:
      - API_ENABLED=false
      - WORKER_ENABLED=true
    env_file:
      - apps/api/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      # Worker has no HTTP server — check that the node process is alive and can reach Redis
      test: ["CMD", "node", "-e", "require('ioredis').default && new (require('ioredis').default)().ping().then(() => process.exit(0)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
```

Run with: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

Remove `mailpit` in production. Replace with real SMTP provider.

---

## 2. Dockerfiles

Each deployable app has a multi-stage Dockerfile. Multi-stage builds separate build dependencies from runtime to keep images small.

### API / Worker

```dockerfile
# apps/api/Dockerfile

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Copy all workspace package.json files preserving directory structure
COPY apps/api/package.json ./apps/api/
COPY modules/ ./modules/
COPY packages/ ./packages/
# Remove source files, keep only package.json files for dependency install
RUN find modules packages -type f ! -name 'package.json' -delete 2>/dev/null; \
    corepack enable && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build --filter=@apps/api

# Stage 3: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Web

```dockerfile
# apps/web/Dockerfile

# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build --filter=@apps/web

# Stage 2: Serve
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Rules

1. **Never install dev dependencies in the runtime stage.**
2. **Never copy `.env` files into images.** Environment variables are injected at runtime.
3. **Pin base image versions** — `node:22-alpine`, not `node:alpine`.
4. **Use `USER node` in runtime stage.** Never run as root.
5. **Use `--frozen-lockfile`** to ensure reproducible installs.

---

## 3. Worker Toggle

`apps/api/src/main.ts` uses two environment flags to control what the process runs:

- `API_ENABLED` — start HTTP server (global prefix, pipes, Swagger, port binding)
- `WORKER_ENABLED` — start BullMQ queue consumers

```env
# Dev/demo — single process handles both
API_ENABLED=true
WORKER_ENABLED=true

# Production — API container
API_ENABLED=true
WORKER_ENABLED=false

# Production — Worker container (same image, different flags)
API_ENABLED=false
WORKER_ENABLED=true
```

When `API_ENABLED=false`, the HTTP server is not started — no port binding, no Swagger, no route registration. The process just initializes the NestJS module graph and keeps alive for queue consumers.

When `WORKER_ENABLED=false`, the queue module registers job definitions but does not start consumers. The API can still enqueue jobs — it just doesn't process them.

---

## 4. Health Monitoring

Two layers of health monitoring, zero external cost:

### Layer 1: Crash recovery (Docker built-in)

`restart: always` on every container restarts processes that crash or exit.

### Layer 2: Unhealthy container restart (docker-autoheal)

Docker Compose `healthcheck` directives mark containers as healthy or unhealthy. docker-autoheal watches for unhealthy containers and restarts them automatically.

- API/Worker: `curl` the `/health` endpoint.
- PostgreSQL: `pg_isready`.
- Redis: `redis-cli ping`.
- MinIO: `mc ready local`.

If a container is unhealthy for 3 consecutive checks (90 seconds), autoheal restarts it.

### Adding external monitoring later

When a domain is configured, add UptimeRobot (free tier) to ping the health endpoint from outside. This catches "entire server is down" scenarios that autoheal cannot detect.

---

## 5. Logging

### Application logging

Applications write structured JSON logs to stdout (see PROMPT-API.md section 10). Docker captures stdout and stores logs as JSON files.

### Log rotation

Every container has a log rotation config to prevent disk fill:

```yaml
logging:
  driver: json-file
  options:
    max-size: "50m"    # rotate after 50MB
    max-file: "5"      # keep 5 rotated files
```

This gives ~250MB of log history per service.

### Log viewer (Dozzle)

Dozzle provides a web UI for viewing, searching, and filtering logs from all containers in real time.

- Access at `http://YOUR_IP:8080`
- ~15MB RAM, no storage engine, reads Docker's log files directly.
- Used in both development and production.

### Upgrading later

When dashboards and historical log queries are needed, add Grafana Loki + Grafana. Dozzle can continue running alongside for real-time viewing.

---

## 6. Queue Monitoring (Bull Board)

Bull Board provides a web UI for inspecting BullMQ queues. It mounts as middleware inside the API process — no extra container.

### What it shows

- All registered queues with job counts (waiting, active, completed, failed, delayed, paused)
- Individual job details: payload, return value, error message, stack trace, attempt count
- Manual actions: retry failed jobs, remove jobs, pause/resume queues

### Setup

Use the `@bull-board/nestjs` integration — no Express-specific APIs:

```ts
// packages/queue/bull-board.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter, // NestJS defaults to Express
    }),
    BullBoardModule.forFeature({
      name: 'notification.send',
      adapter: BullMQAdapter,
    }),
    // Register additional queues as needed
  ],
})
export class QueueBoardModule {}
```

### Rules

1. **Protected by auth + admin permission.** Never expose publicly.
2. **Available in all environments.** Useful in both dev and production for debugging stuck/failed jobs.
3. **Access at** `http://YOUR_HOST:3000/admin/queues`.
4. **Registered outside the `/api/v1` prefix** — like health checks, it's an operational endpoint.

---

## 7. File Storage (MinIO)

MinIO provides S3-compatible object storage, running as a Docker container.

### Access

- S3 API: `http://localhost:9000` (used by `packages/files`)
- Web console: `http://localhost:9001` (browse files, manage buckets)

### Environment config

```env
# Dev/demo — MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=uploads

# Production — swap to real S3 (zero code changes)
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=real-key
S3_SECRET_KEY=real-secret
S3_BUCKET=myapp-uploads
```

`packages/files` uses the S3 SDK. Swapping from MinIO to AWS S3 or DigitalOcean Spaces is a config change — no code changes.

### Rules

1. **Never store files in the container filesystem.** Use MinIO volumes or S3.
2. **Generate unique file keys (UUIDs).** Never use user-provided filenames as storage keys.
3. **Serve files via signed URLs with expiration.** Not direct public URLs unless intentionally public.

---

## 8. Email (Development)

Mailpit catches all outgoing emails in development and shows them in a web inbox.

- Web UI: `http://YOUR_IP:8025`
- SMTP: `mailpit:1025`

```env
# Dev/demo — caught by Mailpit
SMTP_HOST=mailpit
SMTP_PORT=1025

# Production — real provider
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
```

Mailpit is removed in production. Replace with a real SMTP provider (Resend, AWS SES, Postmark).

---

## 9. Environments

### Environment files

Each app has a `.env` file for local development (gitignored) and a `.env.example` committed with placeholder values:

```
apps/api/.env           ← gitignored
apps/api/.env.example   ← committed
apps/web/.env           ← gitignored
apps/web/.env.example   ← committed
```

New developers copy `.env.example` to `.env` and fill in real values.

### What differs between environments

| Concern | Dev / Demo | Production |
|---|---|---|
| `NODE_ENV` | development | production |
| `API_ENABLED` | true (combined) | true (api), false (worker) |
| `WORKER_ENABLED` | true (combined) | false (api), true (worker) |
| Swagger UI | Enabled | Disabled |
| Debug logging | Enabled | Disabled |
| Rate limiting | Relaxed | Enforced |
| CORS origins | `localhost:*` / server IP | Production domain |
| Email | Mailpit (caught) | Real SMTP (delivered) |
| File storage | MinIO | MinIO or S3 |
| Database | Local Postgres container | Managed or local with backups |

### Secrets

1. **Never commit secrets to git.** No `.env` files, no hardcoded credentials.
2. **Never bake secrets into Docker images.** Inject via environment variables at runtime.
3. **Dev and production never share credentials.**
4. **For production:** use a secrets manager (DO environment variables, AWS Secrets Manager, Doppler) or encrypted `.env` files deployed separately from the code.

---

## 10. CI/CD Pipeline (GitHub Actions)

### Pipeline stages

Every push to main triggers the full pipeline:

```
lint → test → build → deploy
```

Feature branches run lint + test + build only (no deploy).

### Pipeline definition

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm tsc --noEmit

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @packages/database db:generate
      - run: pnpm test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  build-and-deploy:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      # Build Docker images
      - run: docker build -f apps/api/Dockerfile -t app-api .
      - run: docker build -f apps/web/Dockerfile -t app-web .

      # Push to GitHub Container Registry
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          SHA="${{ github.sha }}"
          docker tag app-api ghcr.io/${{ github.repository }}/api:latest
          docker tag app-api ghcr.io/${{ github.repository }}/api:${SHA::7}
          docker tag app-web ghcr.io/${{ github.repository }}/web:latest
          docker tag app-web ghcr.io/${{ github.repository }}/web:${SHA::7}
          docker push ghcr.io/${{ github.repository }}/api:latest
          docker push ghcr.io/${{ github.repository }}/api:${SHA::7}
          docker push ghcr.io/${{ github.repository }}/web:latest
          docker push ghcr.io/${{ github.repository }}/web:${SHA::7}

      # Deploy to server
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /app
            docker compose pull
            docker compose run --rm api npx prisma migrate deploy
            docker compose up -d --remove-orphans
            docker image prune -f
```

### Rules

1. **Migrations run before the new code starts.** The deploy script pulls new images, runs `prisma migrate deploy`, then restarts services.
2. **Never skip lint or tests.** A merge to main is blocked unless all stages pass.
3. **Docker images are tagged with `latest` and the git SHA** for rollback capability.
4. **Secrets (server host, SSH key) are stored in GitHub Actions secrets**, never in the workflow file.

---

## 11. Database Operations

### Migration workflow

- Developers create migrations locally: `pnpm --filter @packages/database db:migrate`.
- Migration files are committed to git in `packages/database/prisma/migrations/`.
- CI/deploy runs `prisma migrate deploy` (applies pending migrations, never creates new ones).
- **Migrations are forward-only.** Never edit a deployed migration. Create a new migration to fix issues.

### Connection pooling

For production with multiple API instances, use Prisma's built-in connection pooling or PgBouncer to avoid exhausting the database connection limit.

### Backups (production)

Database backups run as a scheduled job in the worker process via `packages/queue` (BullMQ repeatable jobs) — no extra container needed.

```ts
// Registered as a repeatable BullMQ job — runs daily at 2 AM
{
  name: 'database.backup',
  pattern: '0 2 * * *',
  handler: async () => {
    // 1. Run pg_dump
    // 2. Compress output
    // 3. Upload to S3 as timestamped file: backup-2026-03-12T02:00:00.sql.gz
  },
}
```

```env
# Dev — no backups
BACKUP_ENABLED=false

# Production
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=backups
```

The job only writes timestamped files. Retention is handled by an **S3/MinIO lifecycle policy** configured once on the bucket:

```bash
# Auto-delete backups older than 7 days
mc ilm rule add myminio/backups --expire-days 7
```

- 7 daily backups retained at any time. Keeps storage manageable.
- Uses the same S3 config as `packages/files` (MinIO locally, real S3 in production).
- In production, point backups to **external S3** (not local MinIO) so backups survive if the server dies.
- If using managed Postgres (DO/RDS): backups are automatic, this job is unnecessary.
- **Test restores periodically.** A backup that has never been restored is not a backup.

---

## 12. Reverse Proxy & SSL (when domain is configured)

When a domain is added, add Caddy to Docker Compose for automatic HTTPS:

```yaml
# Add to docker-compose.yml when domain is ready
caddy:
  image: caddy:2-alpine
  restart: always
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
  depends_on:
    - api
    - web
```

```
# Caddyfile
app.example.com {
  handle /api/* {
    reverse_proxy api:3000
  }
  handle /health* {
    reverse_proxy api:3000
  }
  handle /admin/* {
    reverse_proxy api:3000
  }
  handle {
    reverse_proxy web:80
  }
}
```

- Caddy auto-provisions SSL via Let's Encrypt. No manual certificate management.
- Remove direct port mappings (3000, 5173) from api and web services — all traffic goes through Caddy.
- Keep infrastructure service ports (Dozzle 8080, MinIO 9001, Mailpit 8025) accessible directly or restrict via firewall.

---

## 13. Production Upgrade Path

When scaling beyond a single server:

| Concern | Current (single server) | Upgrade to |
|---|---|---|
| API + Worker | Combined process | Separate containers (`docker-compose.prod.yml`) |
| Database | Local Postgres container | Managed Postgres (DO/RDS) with backups |
| File storage | MinIO | AWS S3 or DO Spaces (config change only) |
| Email | Mailpit | Resend / AWS SES / Postmark |
| Monitoring | Dozzle | Add Grafana Loki + Grafana |
| External monitoring | None | Add UptimeRobot (free) |
| Scaling | Bigger droplet | Multiple servers, load balancer |
| Reverse proxy | None / Caddy | Cloud load balancer (ALB) |
