# AoraHQ — Billing Orchestration Engine

Developer-first, cloud-based billing orchestration and usage-based metering. Customers bring their own Stripe/Paystack/Flutterwave keys (BYOK); AoraHQ handles the billing logic. Zero asset custody.

## Quick Start

```bash
npm install
# Copy .env.example → .env and set DATABASE_URL, etc.
npm run dev
```

## Verification and operations

```bash
npm run lint
npm test
npm run build
```

See [OPERATIONS.md](./OPERATIONS.md) for production configuration, health checks, backups, and incident response. CI runs these checks for pull requests and pushes to `main`.

## Documentation

- **[Backend Features Guide](./BACKEND_FEATURES_GUIDE.md)** — Detailed walkthrough of proration, ingress metering, deduplication, batch ingestion, sandbox playground, zero-trust encryption, webhook dispatcher, and dunning state machine
- **[Product Roadmap](./ROADMAP.md)** — Vision, what's built, and upcoming phases

## Stack

- **Frontend:** React, TypeScript, Tailwind, Vite
- **Backend:** Express, TypeScript
- **Database:** CockroachDB (PostgreSQL-compatible)
- **Cache:** Redis (in-memory fallback)
- **Payments:** Non-custodial gateway adapter interface (Stripe, Paystack, Flutterwave, Sandbox)
