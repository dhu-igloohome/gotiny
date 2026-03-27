# GoTiny

Minimal manufacturing SaaS based on Next.js App Router + Prisma + PostgreSQL.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Deployment Rule (Important)

To avoid env mismatch and login failures, keep **only one active Vercel project** for this repository.

- Canonical project name: `gotiny` (recommended)
- Other projects (`gotinymes`, `letsgotiny`) should be archived or disconnected from this repo
- `main` branch production deploy must come from the canonical project only

## Required Environment Variables

Set these in the canonical Vercel project:

- `DATABASE_URL`
- `JWT_SECRET`

## Runtime Health Check

After each production deployment, open:

- `/api/health/runtime`

Expected result:

- `checks.hasDatabaseUrl = true`
- `runtime.vercelProjectId` and `runtime.vercelUrl` match the project/domain you are visiting

If `hasDatabaseUrl` is false, login may return `Login service unavailable`.

## Vercel Project Consolidation Checklist

1. Pick one canonical project (recommend: `gotiny`)
2. In canonical project:
   - configure env vars (`DATABASE_URL`, `JWT_SECRET`)
   - redeploy latest `main`
3. In non-canonical projects:
   - remove production domain bindings
   - archive project or unlink repo integration
4. Verify canonical production domain:
   - `/api/health/runtime` is healthy
   - login with `david / david123` succeeds
