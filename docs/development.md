# Development commands

## Prerequisites

- Node.js 20+ (developed on Node 22/25) and npm
- Docker with Compose v2

## First-time setup

```bash
cp .env.example .env         # Windows PowerShell: Copy-Item .env.example .env
# edit .env and set POSTGRES_PASSWORD and VISITOR_COOKIE_SECRET to strong values
npm install
```

## Run the whole stack in Docker

```bash
docker compose up --build
```

Starts `postgres`, runs `migrate` (migrations + seed) as a one-shot job, then
starts `app`. The app is available at `http://localhost:3000` and its health
endpoint at `http://localhost:3000/api/health`.

Stop with `docker compose down` (add `-v` to also delete the database volume).

## Run only the database, develop the app on the host

```bash
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (standalone output) |
| `npm start` | Start the production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit + integration tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests (needs a database) |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Run the idempotent seed |
| `npm run db:reset` | **Development only.** Drop and rebuild the schema |

## Database connection

- On the host, tools use `DATABASE_URL` from `.env` (points at `localhost`).
- Inside Compose, `app` and `migrate` get a `DATABASE_URL` that points at the
  `postgres` service.

Migrations live in `db/migrations/` and are applied in filename order. They are
immutable once applied; add a new file instead of editing an old one.
