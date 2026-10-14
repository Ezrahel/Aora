# AoraHQ operations runbook

## Release checklist

1. Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
2. Confirm `DATABASE_URL`, `REDIS_URL`, `AORAHQ_MASTER_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `TRUSTED_ORIGINS` are configured in the deployment target.
3. Take and verify a CockroachDB backup before deploying a release with migrations.
4. Deploy one instance first and check `GET /api/health`; it must return `status: "ok"` before expanding capacity.
5. Verify login, a workspace-scoped dashboard request, a sandbox ingestion request, and a signed gateway webhook.

## Alerts and response

Alert on a non-200 health response, `database.connected: false`, sustained gateway-event backlog, webhook delivery failures, and worker failures. The `/api/health` endpoint is intentionally lightweight and returns `degraded` quickly when the database is unavailable.

For a database incident, stop rollout expansion, restore connectivity, then confirm migration checksums and health before enabling payment or webhook workers. Do not modify an already-applied migration: the application rejects checksum drift. Create a new forward migration instead.

## Backup and rollback

Migrations are forward-only. Before a schema release, create a CockroachDB backup and record its restore command/location in the deployment change. If a rollback is required, roll back application code first; restore the database only from the verified pre-release backup and only after pausing writers.

## Tenant access

Dashboard API requests are session-protected and scoped to the active Better Auth organization. Workspaces must be associated with that organization ID. API-key ingestion is limited to `/api/ingress*`; it cannot access dashboard management endpoints.
