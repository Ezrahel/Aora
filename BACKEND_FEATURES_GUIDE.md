# AoraHQ Backend Features — Implementation Walkthrough

This document is a detailed, code-level guide to the eight backend services built for AoraHQ's billing engine. Each section explains the _why_, the _architecture_, the _key files_, and the _integration points_. Use this to understand, debug, or extend the system.

---

## Table of Contents

1. [Proration Service](#1-proration-service)
2. [Fair Ingress Metering](#2-fair-ingress-metering)
3. [24-Hour Deduplication Engine](#3-24-hour-deduplication-engine)
4. [Batch Ingestion](#4-batch-ingestion)
5. [Sandbox Playground](#5-sandbox-playground)
6. [Zero-Trust Credential Encryption](#6-zero-trust-credential-encryption)
7. [Secure Webhook Dispatcher & Transactional Outbox](#7-secure-webhook-dispatcher--transactional-outbox)
8. [Dunning & Automated Retry State Machine](#8-dunning--automated-retry-state-machine)

---

## 1. Proration Service

### Goal

When a customer adds or removes seats mid-cycle, charge or credit the _exact_ prorated amount for the remaining time. No rounding losses. No arbitrary flat fees. The calculation must be fair to both merchant and customer.

### Architecture

**Files:**
- `src/api/services/proration-service.ts` — Core math (`calculateProratedAmount`) and orchestration (`ProrationService.updateSubscriptionSeats`)
- `src/api/db/migrate.ts` — Migration v5: `seat_adjustments` audit table + extended `credit_ledger` type constraint

**Database changes (migration v5):**

```sql
CREATE TABLE seat_adjustments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id     UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    previous_seat_count INT NOT NULL,
    new_seat_count      INT NOT NULL,
    adjustment_cents    DECIMAL(18,4) NOT NULL,
    is_charge           BOOL NOT NULL,
    transaction_ref     STRING(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_type_check;
ALTER TABLE credit_ledger ADD CONSTRAINT credit_ledger_type_check
    CHECK (type IN ('credit_issued','credit_consumed','credit_expired',
                    'credit_reversed','proration_credit','proration_charge'));
```

### Proration Math

`calculateProratedAmount()` in `proration-service.ts`:

```
millisecondsInPeriod = periodEnd - periodStart    (bigint, ms precision)
millisecondsRemaining = periodEnd - adjustmentAt    (bigint)

proratedAmount = floor(fullAmount * millisecondsRemaining / millisecondsInPeriod)
```

Key design decisions:
- All amounts are `bigint` in the lowest denomination (cents). No `number` or `Decimal` to avoid floating-point loss.
- Division is **ceiling** (`ceilDiv`) so the merchant never loses a fractional cent.
- A positive adjustment is charged via the non-custodial gateway; a negative adjustment writes a `proration_credit` to `credit_ledger`.

### Integration Points

- Used by subscription seat-change endpoints (expects `workspaceId`, `subscriptionId`, `newSeatCount`, a `NonCustodialPaymentGateway`, and the merchant's decrypted `secretKey`).
- Creates a `seat_adjustments` row (audit trail) _and_ an `invoices` row for positive adjustments.
- Reads subscription `current_period_start`/`current_period_end` to compute remaining time.

### Usage Example

```typescript
const service = new ProrationService();
const result = await service.updateSubscriptionSeats({
  workspaceId: "ws_abc",
  subscriptionId: "sub_xyz",
  newSeatCount: 15,
  gateway: stripeNonCustodialGateway,
  secretKey: "sk_live_...",
});
// result: { chargeAmount: 5000n, transactionId: "pi_xxx", isCharge: true }
```

---

## 2. Fair Ingress Metering

### Goal

Measure every byte that passes through the ingestion API and bill in 64 KB units. Provide a Redis-backed counter buffer that flushes to PostgreSQL every 60 seconds. No meter event is ever lost, even under high throughput.

### Architecture

**Files:**
- `src/api/services/ingress-meter.ts` — Core service: `validateAndMeasureIngress`, `handleBatchIngress`, `flushIngressCounters`, `getIngressUsage`, `startIngressFlushLoop`
- `src/api/cache/redis.ts` — `CacheClient` with Redis pipeline support + in-memory Map fallback
- `src/api/routes/ingress.ts` — `POST /ingress`, `GET /ingress/usage`, `POST /ingress/flush`
- `src/api/db/migrate.ts` — Migration v6: `ingress_ledger` table

### Data Flow

```
POST /ingress
  │
  ├─ 1. Extract tenantId from API key / workspace header
  ├─ 2. Measure raw JSON byte size (Buffer.byteLength)
  ├─ 3. Compute billable units = ceil(bytes / 65536)
  ├─ 4. Dedup check (Redis SETNX, 24h TTL)
  ├─ 5. Buffer counters in Redis HINCRBY (event_count, billable_units, batch_count)
  │
  └─ [Background flush every 60s]
       │
       ├─ Scan Redis for ingress:* keys
       ├─ Read HGETALL counters per tenant+hour_bucket
       └─ UPSERT into ingress_ledger table
```

### Database Schema (migration v6)

```sql
CREATE TABLE ingress_ledger (
    tenant_id      UUID NOT NULL,
    hour_bucket    TIMESTAMPTZ NOT NULL,
    event_count    BIGINT NOT NULL DEFAULT 0,
    billable_units BIGINT NOT NULL DEFAULT 0,
    batch_count    BIGINT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, hour_bucket)
);
```

### Redis Key Format

| Purpose | Key Pattern |
|---|---|
| Dedup (single) | `dedup:{env}:{tenantId}:{eventId}` |
| Dedup (batch) | `dedup:{env}:{tenantId}:{eventId}` (pipelined) |
| Counter buffer | `ingress:{tenantId}:{hourBucketISO}` → HASH with fields `event_count`, `billable_units`, `batch_count` |

### In-Memory Fallback (Redis unavailable)

When `REDIS_URL` is not set, `CacheClient` falls back to an in-memory `Map<string, MemoryEntry>`:
- `setNx` → checks `Map.has(key)` if not expired, then sets with TTL
- `batchSetNx` → loops over keys serially
- `batchHIncrBy` → increments numbers in a JSON object keyed by hash field
- `hGetAll` → returns the in-memory hash as a plain object
- `del` → deletes the key
- `scanKeys` → scans all keys matching a glob pattern

All Redis operations are fire-and-forget safe; the background Postgres flush provides durability.

### Counter Flush

```typescript
// Called every 60s by startIngressFlushLoop()
export async function flushIngressCounters(): Promise<number> {
  const keys = await cacheClient.scanKeys("ingress:*");
  await withTransaction(async (client) => {
    for (const key of keys) {
      const { event_count, billable_units, batch_count } = await cacheClient.hGetAll(key);
      await client.query(`UPSERT INTO ingress_ledger ...`);
    }
    // Delete processed keys from Redis
  });
}
```

---

## 3. 24-Hour Deduplication Engine

### Goal

Prevent duplicate billing when a customer retries sending the same usage event. The dedup window is 24 hours. Primary layer is Redis (SETNX with TTL); Postgres is the durable fallback.

### Architecture

**Files:**
- `src/api/services/deduplication-service.ts` — `DeduplicationService` with `checkAndMark`, `batchCheckAndMark`, `revoke`
- `src/api/middleware/deduplication.ts` — Express middleware `deduplicateEvent`
- `src/api/db/migrate.ts` — Migration v7: `processed_events` table

### Two-Layer Strategy

```
checkAndMark(tenantId, eventId, isTest)
  │
  ├─ LAYER 1: Redis SET NX EX 86400
  │   Key: dedup:{env}:tenant_{tenantId}:event_{eventId}
  │   ├─ true → key was set (new event) → return { isDuplicate: false, source: 'redis' }
  │   └─ false → key exists (duplicate) → return { isDuplicate: true, source: 'redis' }
  │
  └─ LAYER 2 (fallback if Redis unavailable):
       PostgreSQL INSERT ... ON CONFLICT DO NOTHING
       └─ rowCount === 1 → new event
       └─ rowCount === 0 → duplicate
```

### Fail-Open Guarantee

If _both_ Redis and Postgres fail, the middleware sets `req.isDuplicate = false` and logs aggressively. Ingestion never crashes due to dedup failure.

### Database Schema (migration v7)

```sql
CREATE TABLE processed_events (
    dedup_key  STRING(512) PRIMARY KEY,
    tenant_id  UUID NOT NULL,
    event_id   STRING(255) NOT NULL,
    is_test    BOOL NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Express Middleware Integration

```typescript
// Mount on any ingestion route:
router.post("/ingest", deduplicateEvent, handler);

// Handler checks:
if (req.isDuplicate) {
  // Process business logic but DO NOT count toward billing
}
```

The middleware extracts:
- **Tenant ID** from `req.workspace?.id` (set by auth middleware), `X-Workspace-Id` header, or `workspace` query param
- **Event ID** from `body.eventId`, `body.idempotencyKey`, or `Idempotency-Key` header
- **Sandbox mode** from `req.context.isTest`

---

## 4. Batch Ingestion

### Goal

Accept arrays of up to 1000 usage events in a single request, measure each event's byte size, deduplicate via pipelined Redis, apply a batch discount multiplier, and write the aggregated result to the ledger.

### Architecture

**Files:**
- `src/api/services/batch-ingestion-service.ts` — `BatchIngestionService.processBatch`
- `src/api/routes/ingress.ts` — `POST /ingress/batch`
- `src/api/db/migrate.ts` — Migration v8: `charged_units` on `ingress_ledger`

### Processing Pipeline

```
POST /ingress/batch   [{eventId, customerId, meterId, value, ...}, ...]
  │
  ├─ 1. Validate: non-empty array, max 1000 events
  ├─ 2. Measure each event's JSON byte size (Buffer.byteLength)
  ├─ 3. Pipeline dedup: batchCheckAndMark(tenantId, eventIds, isTest)
  ├─ 4. Compute per-event base units = ceil(bytes / 65536)
  ├─ 5. Apply batch discount: chargedUnits = round(baseUnits * 0.8)
  │    (zero for sandbox)
  └─ 6. UPSERT into ingress_ledger (with is_test flag)
```

### Response Format

```json
{
  "status": "processed",
  "total_received": 100,
  "successfully_metered": 92,
  "duplicates_ignored": 8,
  "base_units": 92,
  "charged_units": 73.6,
  "batch_discount": 0.8,
  "events": [
    { "index": 0, "event_id": "evt_001", "base_units": 1, "is_duplicate": false, "accepted": true },
    { "index": 1, "event_id": "evt_002", "base_units": 2, "is_duplicate": false, "accepted": true }
  ]
}
```

### Database Changes (migration v8)

```sql
ALTER TABLE ingress_ledger ADD COLUMN IF NOT EXISTS charged_units DECIMAL(18,4) NOT NULL DEFAULT 0;
```

### writeToLedger Implementation

Uses UPSERT to atomically increment counters in the hourly bucket:

```sql
UPSERT INTO ingress_ledger
  (tenant_id, hour_bucket, event_count, billable_units, charged_units, is_test, batch_count, created_at)
VALUES ($1, $2,
  COALESCE((SELECT event_count  FROM ingress_ledger WHERE ...), 0) + $3,
  COALESCE((SELECT billable_units FROM ingress_ledger WHERE ...), 0) + $4,
  COALESCE((SELECT charged_units  FROM ingress_ledger WHERE ...), 0) + $5,
  $6,
  COALESCE((SELECT batch_count FROM ingress_ledger WHERE ...), 0) + 1,
  now())
```

---

## 5. Sandbox Playground

### Goal

Let merchants test the entire billing flow — API calls, metering, charges, refunds, subscription renewals — without touching real payment gateways or incurring costs. Achieve this with zero configuration: the API key prefix (`sk_test_` vs `sk_live_`) determines the mode.

### Architecture

**Files:**
- `src/gateways/sandbox-adapter.ts` — `SandboxPaymentAdapter` (simulated charge/refund)
- `src/api/middleware/sandbox.ts` — `sandboxIsolationMiddleware` (auth, context, time-travel)
- Cross-cutting changes to `auth.ts`, `deduplication-service.ts`, `ingress-meter.ts`, `batch-ingestion-service.ts`, `deduplication.ts`, `ingress.ts`

### API Key Routing

| Prefix | Mode | Workspace Environment | Gateway Adapter |
|---|---|---|---|
| `sk_live_xxx` | production | `'production'` | Real gateway from `gateway_connections` (or sandbox fallback) |
| `sk_test_xxx` | sandbox | `'sandbox'` or `'development'` | `SandboxPaymentAdapter` |

### sandboxIsolationMiddleware

```typescript
// Mounted in router.ts early in the chain:
apiRouter.use(sandboxIsolationMiddleware);

// On each request:
// 1. Extract Authorization header or x-api-key
// 2. Match key prefix via regex /^(sk_test_|sk_live_)(.+)$/
// 3. Query workspaces table matching environment:
//    - sk_test_ → WHERE environment = ANY(['sandbox', 'development'])
//    - sk_live_ → WHERE environment = 'production'
// 4. For live mode, look up workspace's primary gateway:
//    SELECT gateway FROM gateway_connections
//    WHERE workspace_id = $1 AND mode = 'live' AND is_verified = true
// 5. Parse X-AoraHQ-Simulate-Time header (e.g., +7d, +30d, +2h)
// 6. Set req.context = { isTest, workspace, paymentAdapter, timeOffset, keyPrefix }
// 7. Also set req.workspace for backward compatibility
```

### SandboxPaymentAdapter

| Scenario | Amount | Behavior |
|---|---|---|
| Normal charge | Any amount (last 4 digits ≠ 4002) | Returns `{ status: "succeeded", transactionId: "ch_sandbox_..." }` |
| Simulated decline | Amount ends in `4002` (e.g., `4002¢`, `1004002¢`) | Throws `NonCustodialBillingError` with code `card_declined` |
| Refund | Any | Always succeeds with `{ status: "succeeded", refundId: "ref_sandbox_..." }` |

Uses deterministic mock IDs with a monotonic counter and random suffix, plus simulated 5-15ms network latency.

### Time-Travel

```
Header: X-AoraHQ-Simulate-Time: +7d
Header: X-AoraHQ-Simulate-Time: +30d
Header: X-AoraHQ-Simulate-Time: +2h
```

The `parseTimeOffset()` function parses the header into a `TimeOffset` struct. Use `nowWithOffset(context)` instead of `new Date()` in subscription renewal calculations when processing sandbox requests.

```typescript
export function nowWithOffset(context: SandboxContext): Date {
  return applyTimeOffset(new Date(), context.timeOffset);
}
```

Valid formats: `+{number}{h|d}`. Max: 720h (30 days), 365d (1 year).

### Cross-Contamination Prevention

Every function that touches data has an `isTest: boolean = false` parameter:

| Service | What changes when `isTest = true` |
|---|---|
| `DeduplicationService` | Redis key gets `test:` prefix instead of `live:`; Postgres dedup key uses `{is_test}:{tenantId}:{eventId}`; `is_test` column is written |
| `IngressMeter` | `billableUnits = 0` (metered but not billed); dedup keys use `{env}` prefix; `getIngressUsage` filters by `is_test` |
| `BatchIngestionService` | `chargedUnits = 0`, batch discount effectively 0; writes `is_test = true` to ledger |
| `requireApiKey` (auth.ts) | Matches `sandbox`/`development` environments instead of `production` |

### Database Isolation (migration v9)

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE ingress_ledger ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;
ALTER TABLE processed_events ADD COLUMN IF NOT EXISTS is_test BOOL NOT NULL DEFAULT false;

-- Partial indexes: live-only queries skip sandbox rows automatically
CREATE INDEX IF NOT EXISTS idx_customers_live ON customers (workspace_id, email, status)
    WHERE NOT is_deleted AND NOT is_test;
CREATE INDEX IF NOT EXISTS idx_subscriptions_live ON subscriptions (customer_id, status)
    WHERE NOT is_test;
```

### End-to-End Sandbox Flow

```bash
# 1. Create a sandbox workspace (environment = 'sandbox')
# 2. Generate an sk_test_xxx API key
# 3. Ingest events — metered but not charged
curl -X POST https://api.aorahq.com/ingress \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -H "X-AoraHQ-Simulate-Time: +7d" \
  -d '{"customerId":"...", "meterId":"...", "value":42, "eventId":"evt_001"}'

# 4. Simulate a subscription charge
curl -X POST https://api.aorahq.com/subscriptions/sub_xyz/update-seats \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{"seats": 10}'
# → Works through SandboxPaymentAdapter, creates invoices/seat_adjustments
#   with is_test=true, no real money moves

# 5. Simulate a decline (amount ending in 4002)
curl -X POST https://api.aorahq.com/subscriptions/sub_xyz/update-seats \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{"seats": 15}'  # seat price = 4002¢
# → 400 error: card_declined
```

---

## Integration Map

```
API Gateway (router.ts)
  │
  ├─ sandboxIsolationMiddleware ─────────────────────────┐
  │   │  Sets req.context.isTest, paymentAdapter, etc.   │
  │   └──────────────────────────────────────────────────┤
  │                                                      │
  ├─ requireApiKey (auth.ts)                             │
  │   Now accepts sk_test_ / sk_live_ prefixes           │
  │                                                      │
  ├─ deduplicateEvent (deduplication.ts)                 │
  │   Passes req.context.isTest to DeduplicationService  │
  │                                                      │
  ├─ POST /ingress                                       │
  │   └─ handleBatchIngress(tenantId, rawBody, isTest)   │
  │       ├─ validateAndMeasureIngress()                 │
  │       │   └─ cacheClient.setNx(dedupKey)             │
  │       └─ bufferIngressCounters()                     │
  │           └─ cacheClient.batchHIncrBy()              │
  │                                                      │
  ├─ POST /ingress/batch                                 │
  │   └─ batchIngestionService.processBatch(             │
  │         tenantId, events, isTest)                    │
  │       ├─ dedupService.batchCheckAndMark()            │
  │       │   └─ cacheClient.batchSetNx() (pipelined)    │
  │       └─ writeToLedger() (UPSERT ingress_ledger)     │
  │                                                      │
  ├─ PATCH subscriptions/:id/seats                       │
  │   └─ ProrationService.updateSubscriptionSeats()      │
  │       ├─ calculateProratedAmount() (bigint math)     │
  │       ├─ paymentAdapter.chargeToken / credit_ledger  │
  │       └─ CREATE seat_adjustments + invoices          │
  │                                                      │
  ├─ GET /ingress/usage                                  │
  │   └─ getIngressUsage(tenantId, from, to, isTest)     │
  │                                                      │
  └─ POST /ingress/flush (manual trigger)                │
      └─ flushIngressCounters() (background or manual)   │
          ├─ cacheClient.scanKeys("ingress:*")            │
          ├─ cacheClient.hGetAll(key)                     │
          ├─ UPSERT ingress_ledger (withTransaction)      │
          └─ cacheClient.del(key)                         │
```

### Redis Data Flow Summary

```
SET NX EX (dedup)          ←──── DeduplicationService
HINCRBY (counter buffer)   ←──── IngressMeter / BatchIngestion
  │
  │  [every 60s: flushIngressCounters]
  │
  └──── HGETALL → UPSERT → PostgreSQL ingress_ledger
```

### Transaction Safety

- `ProrationService` uses `withTransaction()` with retryable serializable isolation
- `flushIngressCounters` wraps all UPSERTs + Redis DEL in `withTransaction`
- `BatchIngestionService`` writeToLedger` uses a single UPSERT (atomic per-request)
- Dedup uses Redis SETNX (atomic read-and-write) with PostgreSQL fallback

---

## Verification Checklist

After implementing or modifying any of these features:

```bash
# TypeScript compilation (0 new errors expected)
npx tsc --noEmit

# Lint (if configured)
npm run lint

# Verify routes exist
npx tsx -e "
  import apiRouter from './src/api/router.ts';
  console.log('Router loaded successfully');
"

# Manual smoke test (requires running server + DB)
curl -X POST http://localhost:3000/api/ingress \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","meterId":"...","value":1,"eventId":"test_001"}'

# Expected: 200 with { accepted: true, billableUnits: 0, ... }
# (billableUnits is 0 because sk_test_ → isTest=true → no billing)
```

---

## 6. Zero-Trust Credential Encryption

### Goal

Merchant gateway API keys (Stripe `sk_live_...`, Paystack `sk_live_...`) must NEVER exist in plaintext in the database. They are encrypted at rest with AES-256-GCM and only decrypted in-memory during the precise moment a billing worker needs to make a gateway call. The decrypted buffer is wiped immediately after use.

### Architecture

**Files:**
- `src/gateways/encryption-service.ts` — `EncryptionService` class (native Node.js `crypto`, AES-256-GCM)
- `src/gateways/encrypted-gateway-repository.ts` — `EncryptedGatewayRepository` (encrypt-on-write, decrypt-on-read)
- `src/gateways/encryption.ts` — Legacy wrapper for backward compatibility with old `gateway_connections`
- `src/api/routes/gateways.ts` — V2 routes (`/gateways/v2/`) demonstrating zero-trust lifecycle
- `src/api/db/migrate.ts` — Migration v10: `tenant_gateways` table

### Algorithm

```
AES-256-GCM (Galois/Counter Mode)
  ├─ Key:      32 bytes (256 bits) from AORAHQ_MASTER_ENCRYPTION_KEY
  ├─ IV:       12 bytes (96 bits), crypto.randomBytes() per encryption
  ├─ Auth Tag: 16 bytes (128 bits), auto-generated by GCM
  └─ Storage:  ciphertext, iv, tag stored as base64 in separate columns
```

### EncryptionService

```typescript
import { encryptionService } from "./encryption-service.ts";

// Encrypt
const encrypted = encryptionService.encrypt("sk_live_abc123...");
// → { ciphertext: "base64...", iv: "base64...", tag: "base64..." }

// Decrypt
const decrypted = encryptionService.decryptParts(
  encrypted.ciphertext,
  encrypted.iv,
  encrypted.tag,
);
// → { plaintext: "sk_live_abc123...", buffer: WipeableBuffer }

const plaintext = decrypted.plaintext;
// ... use the key for gateway API call ...
decrypted.buffer.wipe();  // clears from memory
```

### Master Key Validation (Startup Crash)

On application boot, `encryption-service.ts` calls `loadMasterKey()` which:

1. Reads `AORAHQ_MASTER_ENCRYPTION_KEY` from environment
2. Validates it is exactly 32 bytes (accepts hex or base64url encoding)
3. If missing or wrong length, prints a fatal error and calls `process.exit(1)`

No graceful fallback. No silent degradation. The app refuses to start.

### Database Schema (migration v10)

```sql
CREATE TABLE tenant_gateways (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id              UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    gateway                   STRING(20) NOT NULL CHECK (gateway IN ('stripe','paystack','flutterwave','sandbox')),
    mode                      STRING(10) NOT NULL DEFAULT 'test' CHECK (mode IN ('live', 'test')),

    -- AES-256-GCM cryptographic primitives (base64-encoded)
    encrypted_secret_key      STRING(512) NOT NULL,
    encryption_iv             STRING(32) NOT NULL,
    encryption_tag            STRING(32) NOT NULL,

    -- Optional webhook secret (same encryption scheme)
    encrypted_webhook_secret  STRING(512),
    webhook_iv                STRING(32),
    webhook_tag               STRING(32),

    -- Safe display preview (last 4 chars only)
    key_preview               STRING(20) NOT NULL,

    -- Connection metadata
    is_verified               BOOL NOT NULL DEFAULT false,
    last_verified_at          TIMESTAMPTZ,
    gateway_account_id        STRING(255),
    gateway_account_name      STRING(255),
    gateway_account_email     STRING(320),
    metadata                  JSONB DEFAULT '{}'::JSONB,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE INDEX idx_tgw_ws_gateway_mode (workspace_id, gateway, mode)
);
```

The three cryptographic columns (`encrypted_secret_key`, `encryption_iv`, `encryption_tag`) are stored **separately** instead of as a single blob. This allows independent validation of each component and makes the schema self-documenting.

### EncryptedGatewayRepository

The repository provides a clean API that hides all encryption details:

| Method | Description |
|---|---|
| `create(input)` | Encrypts `plaintextApiKey` before INSERT |
| `findByWorkspace(wsId)` | Returns rows with ciphertext only (safe for API responses) |
| `getDecryptedKey(id)` | Decrypts in memory and returns `DecryptedCredential` |
| `updateApiKey(id, newKey)` | Encrypts new key before UPDATE |
| `verifyDecryption(id)` | Health-check: verifies stored data is decryptable (without exposing plaintext) |
| `delete(id)` | Removes the row |

### In-Memory Credential Lifecycle

```typescript
import { encryptedGatewayRepository } from "./encrypted-gateway-repository.ts";

async function chargeCustomer(gatewayId: string, amount: bigint) {
  // 1. LOAD: ciphertext from DB, decrypted in memory
  const credential = await encryptedGatewayRepository.getDecryptedKey(gatewayId);

  try {
    // 2. USE: plaintext exists only in this scope
    const adapter = getAdapter(credential.row.gateway);
    return await adapter.chargeToken({
      secretKey: credential.secretKey,  // in-memory only
      customerToken: "cus_xxx",
      paymentToken: "pm_xxx",
      amount,
      currency: "usd",
    });
  } finally {
    // 3. WIPE: overwrite buffer with zeros, runs even on exception
    credential.secretKeyBuffer.wipe();
    credential.webhookBuffer?.wipe();
  }
  // After this: the credential variable is out of scope and the
  // buffer has been zero-filled. GC has nothing sensitive to collect.
}
```

Key points:
- The `WipeableBuffer.wipe()` method calls `buf.fill(0)` to overwrite the memory
- The `finally` block ensures wiping happens even if the gateway API throws
- After the function returns, the `credential` variable is out of scope and the underlying `Buffer` has been cleared
- The plaintext string (`credential.secretKey`) is a JavaScript string — it will be GC'd normally but the underlying `Buffer` is explicitly zeroed

### Gateway V2 Routes

The new `/gateways/v2/*` endpoints demonstrate the zero-trust pattern:

| Endpoint | Description |
|---|---|
| `POST /gateways/v2/connect` | Create connection (key encrypted before DB write) |
| `GET /gateways/v2` | List connections (safe metadata only) |
| `GET /gateways/v2/:id` | Get single connection |
| `POST /gateways/v2/:id/charge` | Charge via decrypted key (demonstrates wipe pattern) |
| `POST /gateways/v2/:id/re-verify` | Re-verify stored credentials |
| `GET /gateways/v2/:id/health` | Decryption integrity health check |
| `DELETE /gateways/v2/:id` | Remove connection |

### Backward Compatibility

The existing `encryption.ts` wrapper delegates to `EncryptionService` and converts between the old colon-delimited hex format and the new base64 encoding. Old `gateway_connections` rows continue to work. New code should use `EncryptionService` directly.

### Security Properties

| Property | Mechanism |
|---|---|
| Confidentiality | AES-256-GCM ciphertext; key never in DB |
| Integrity | 128-bit GCM authentication tag; decryption throws `SecurityError` on tamper |
| IV Uniqueness | `crypto.randomBytes(12)` per call; NIST-compliant 96-bit IV |
| Memory Safety | `buf.fill(0)` wipe after use; `finally` block guarantees cleanup |
| Key Rotation | Update `AORAHQ_MASTER_ENCRYPTION_KEY` and re-encrypt all rows |
| Auditability | Three separate columns for ciphertext, IV, tag — each independently verifiable |

### Verification

```bash
# 1. Set the master key
export AORAHQ_MASTER_ENCRYPTION_KEY=$(openssl rand -hex 32)

# 2. App starts and validates the key
npx tsx server.ts

# 3. Connect a gateway (key is encrypted before storage)
curl -X POST http://localhost:3000/api/gateways/v2/connect \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"gateway":"stripe","apiKey":"sk_live_xxx","mode":"test"}'

# 4. Health check verifies stored data is decryptable
curl http://localhost:3000/api/gateways/v2/<id>/health

# 5. Charge with in-memory lifecycle (credential wiped after)
curl -X POST http://localhost:3000/api/gateways/v2/<id>/charge \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"customerToken":"cus_xxx","paymentToken":"pm_xxx","amount":2000,"currency":"usd"}'
```

---

## 7. Secure Webhook Dispatcher & Transactional Outbox

### Goal

When a subscription state changes (e.g., `subscription.renewed`, `subscription.past_due`, `customer.seats_changed`), the merchant's server must be notified instantly via HTTP POST webhook. The system guarantees:

1. **No lost events** — webhook events are written to an outbox table *inside the same DB transaction* as the state change (Transactional Outbox Pattern)
2. **No spoofed webhooks** — every payload is signed with HMAC-SHA256 using a unique merchant secret
3. **No permanently missed deliveries** — failed deliveries retry with exponential backoff over a 24-hour window

### Architecture

**Files:**
- `src/api/services/webhook-signer.ts` — `WebhookSigner` (HMAC-SHA256 signing + verification)
- `src/api/services/webhook-outbox-repository.ts` — `WebhookOutboxRepository` (transactional outbox DB layer)
- `src/api/services/webhook-queue.ts` — BullMQ queue factory + `enqueueWebhookDelivery()`
- `src/api/services/webhook-dispatcher-worker.ts` — `WebhookDispatcherWorker` (BullMQ background worker)
- `src/api/db/migrate.ts` — Migration v11: `webhook_outbox` + `webhook_delivery_logs` tables

### Data Flow

```
API Request (e.g., subscription.renewed)
  │
  ├─ BEGIN TRANSACTION
  │   ├─ UPDATE subscriptions SET status = 'active', ...
  │   └─ INSERT INTO webhook_outbox (event_type, payload, ...)
  └─ COMMIT TRANSACTION  ← both succeed or both roll back
        │
        ▼
  enqueueWebhookDelivery(outboxId)
        │
        ▼
  BullMQ Queue (Redis)
        │
        ▼
  WebhookDispatcherWorker
    ├─ 1. Claim outbox row (SELECT ... FOR UPDATE SKIP LOCKED)
    ├─ 2. Look up webhook_endpoint (url, secret)
    ├─ 3. Sign payload: HMAC-SHA256(secret, timestamp + "." + payload)
    ├─ 4. POST to merchant endpoint (10s timeout)
    │
    ├─ 2xx → markDelivered(), logDelivery(success)
    │
    └─ Non-2xx / timeout / network error →
        ├─ logDelivery(failed, http_status, response_body, duration_ms)
        ├─ scheduleRetry() with exponential backoff
        │  (2^retry minutes, max 24h)
        └─ BullMQ retries the job
```

### Transactional Outbox Pattern

The core guarantee: webhook events are never written outside a database transaction.

```typescript
import { withTransaction } from "../db/pool.ts";
import { webhookOutboxRepository } from "./webhook-outbox-repository.ts";

// In a subscription renewal handler:
await withTransaction(async (client) => {
  // 1. Update subscription state
  await client.query(
    `UPDATE subscriptions SET status = 'active', current_period_end = $2 WHERE id = $1`,
    [subscriptionId, newPeriodEnd],
  );

  // 2. Write webhook event — same transaction
  await webhookOutboxRepository.insert(client, {
    tenantId: workspace.id,
    workspaceId: workspace.id,
    webhookId: webhookEndpoint.id,
    eventType: "subscription.renewed",
    payload: {
      subscriptionId,
      status: "active",
      currentPeriodEnd: newPeriodEnd,
      seats: seatCount,
    },
  });
});

// 3. Enqueue for delivery (outside transaction, non-critical)
await enqueueWebhookDelivery(outboxId);
```

### WebhookSigner (HMAC-SHA256)

```
Header format:  X-AoraHQ-Signature: t=1719300000,v1=sha256_hash

t  = Unix epoch seconds (replay protection)
v1 = HMAC-SHA256(secret, timestamp + "." + payload)
```

```typescript
import { WebhookSigner } from "./webhook-signer.ts";

// Generate a secret for a new webhook endpoint
const secret = WebhookSigner.generateSecret();
// → "whsec_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

// Sign a payload
const sig = WebhookSigner.sign(secret, { event: "subscription.renewed", ... });
// → { header: "t=1719300000,v1=abc123...", timestamp: 1719300000, signature: "abc123..." }

// Merchants verify with:
const isValid = WebhookSigner.verify(secret, payloadString, header, toleranceMs);
```

The `verify()` method:
- Parses the `t=...,v1=...` header
- Checks the timestamp is within `toleranceMs` (default 5 min) — replay protection
- Recomputes the HMAC and compares with `crypto.timingSafeEqual()` — timing-attack safe

### Database Schema (migration v11)

```sql
CREATE TABLE webhook_outbox (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    webhook_id       UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event_type       STRING(100) NOT NULL,
    payload          JSONB NOT NULL,
    status           STRING(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','delivered','failed','cancelled')),
    retry_count      INT NOT NULL DEFAULT 0,
    max_retries      INT NOT NULL DEFAULT 48,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error       STRING(2000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_delivery_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id        UUID NOT NULL REFERENCES webhook_outbox(id) ON DELETE CASCADE,
    webhook_id       UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    attempt_number   INT NOT NULL DEFAULT 1,
    status           STRING(20) NOT NULL CHECK (status IN ('success','failed')),
    http_status      INT,
    response_body    STRING(5000),
    response_headers JSONB,
    duration_ms      INT NOT NULL DEFAULT 0,
    error_message    STRING(1000),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### BullMQ Queue + Worker

**Queue setup** (`webhook-queue.ts`):
- Uses the same ioredis connection as the existing `CacheClient`
- Default job options: 48 max attempts, exponential backoff starting at 1 minute
- Deduplicates by `jobId = outboxId` (no duplicate deliveries)

**Worker** (`webhook-dispatcher-worker.ts`):
- 5 concurrent workers, 30s job lock, 15s stalled-job check
- On each job:
  1. `claimPending()` uses `SELECT ... FOR UPDATE SKIP LOCKED` for safe concurrent claiming
  2. Resolves the webhook endpoint URL and secret from `webhook_endpoints`
  3. Signs the payload with `WebhookSigner`
  4. POSTs with native `fetch` and 10s `AbortController` timeout
  5. On 2xx: marks `delivered`, logs success
  6. On failure: logs the attempt, increments retry, schedules backoff, throws to BullMQ

### Exponential Backoff Schedule

BullMQ computes delays as: `delay = 60,000ms * 2^(attempt - 1)`

| Attempt | Delay | Cumulative Time |
|---------|-------|-----------------|
| 1 | 1 min | 1 min |
| 2 | 2 min | 3 min |
| 3 | 4 min | 7 min |
| 4 | 8 min | 15 min |
| 5 | 16 min | 31 min |
| 6 | 32 min | 63 min |
| 7 | 64 min | ~2h |
| 8 | 128 min | ~4h |
| 9 | 256 min | ~8h |
| 10 | 512 min | ~17h |
| 11+ | capped at ~24h | 24h |

After reaching the `max_retries` limit (48), the outbox row is marked as `failed` permanently.

### Starting the Worker

```typescript
// In server.ts or your main entry point:
import { startWebhookWorker } from "./api/services/webhook-dispatcher-worker.ts";

const worker = startWebhookWorker();
// null if Redis is unavailable — outbox rows remain pending

// Graceful shutdown:
// await stopWebhookWorker();
```

### Verification

```bash
# 1. Create a webhook endpoint
curl -X POST http://localhost:3000/api/webhooks \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://merchant.example.com/webhooks",
    "events": ["subscription.renewed", "subscription.past_due"]
  }'

# Response includes webhook_id and secret (whsec_...)
# → { id: "webhook_id", url: "...", secret: "whsec_abc...", events: [...] }

# 2. Trigger a state change that writes to the outbox
# (handled automatically by subscription service code)

# 3. Monitor the outbox
curl http://localhost:3000/api/webhooks/outbox \
  -H "Authorization: Bearer sk_live_..."

# 4. Check delivery logs for a specific outbox row
curl http://localhost:3000/api/webhooks/outbox/:id/deliveries \
  -H "Authorization: Bearer sk_live_..."

# 5. Merchants verify the signature on their end
# The merchant runs:
#   crypto.timingSafeEqual(
#     HMAC-SHA256(whsec_secret, timestamp + "." + raw_body),
#     Buffer.from(signature_from_header, "hex"),
#   )
```

---

# 8. Dunning & Automated Retry State Machine

## Overview

The dunning state machine manages the lifecycle of subscription payment failures through a configurable retry sequence. It implements a 3-step policy:

| Step | Retry Day | Status  | Action                          |
|------|-----------|---------|---------------------------------|
| 0    | —         | active  | No failure (normal billing)     |
| 1    | Day 3     | active  | First failure → schedule retry  |
| 2    | Day 7     | past_due | Second failure → final retry    |
| 3    | —         | canceled | Max retries → cancel            |

## Files

| File | Purpose |
|------|---------|
| `src/api/services/dunning-state-machine.ts` | `DunningStateMachine` class + `processDueDunningRetries` worker |
| `src/api/db/migrate.ts` (v12) | Migration: dunning columns + `dunning_retry_log` table |

## Key Design Decisions

### Deterministic State Transitions

The state machine uses a strict step counter (`dunning_step`):

- **Step 0 → Step 1**: Initial payment failure. Subscription stays `active` (grace period). `next_retry_at` set to `+3 days`. Webhook `invoice.payment_failed` dispatched.
- **Step 1 → Step 2**: First retry attempt fails. Subscription transitions to `past_due`. `next_retry_at` set to `+4 days` (7 total days from first failure). Webhook `subscription.past_due` dispatched.
- **Step 2 → Step 0 (cancel)**: Second retry attempt fails. Subscription set to `canceled`. Webhook `subscription.canceled` dispatched.
- **Any Step → Step 0 (success)**: Successful charge resets dunning step to 0, sets status to `active`, and extends `current_period_end`.

### Concurrent Safety

The `processDueDunningRetries` worker uses `SELECT ... FOR UPDATE SKIP LOCKED` to safely process subscriptions across multiple worker instances. Each subscription is locked atomically during the charge attempt to prevent double-billing.

### Transactional Outbox Integration

Every dunning state transition writes a webhook outbox event inside the same `SERIALIZABLE` transaction as the subscription update. This ensures that webhook events are never lost even if the worker crashes mid-flight.

### Dunning Retry Log

Every automated payment attempt is logged to `dunning_retry_log`:

```sql
CREATE TABLE dunning_retry_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id),
    attempt_number    INT NOT NULL,       -- 1, 2, or 3
    dunning_step      INT NOT NULL,       -- step at time of attempt
    amount_cents      DECIMAL(18,4) NOT NULL,
    status            STRING(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message     STRING(1000),
    gateway_response  JSONB,              -- raw charge result/error
    attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Worker Configuration

The background worker (`processDueDunningRetries`) is designed to be called from a cron job or scheduler:

```
Schedule: every 60 seconds (configurable)
Batch:    up to 25 subscriptions per cycle
Concurrency: processed via Promise.allSettled
Locking:  FOR UPDATE SKIP LOCKED (safe for multi-worker deployment)
```

## Usage

### 1. Initial Payment Failure

```typescript
import { dunningStateMachine } from "../services/dunning-state-machine.ts";

await withTransaction(async (client) => {
  await dunningStateMachine.handleInitialPaymentFailure(
    client,
    subscriptionId,
    workspaceId,
    priceCents,
    "Card declined: insufficient funds",
    { code: "card_declined", decline_code: "insufficient_funds" },
  );
  // Outbox event is automatically inserted
});
```

### 2. Background Retry Worker

```typescript
import { processDueDunningRetries } from "../services/dunning-state-machine.ts";

// Called every 60 seconds from a cron job
async function cronTick() {
  const processed = await processDueDunningRetries("workspace_id");
  console.log(`Processed ${processed} dunning retries`);
}
```

### 3. Manual Retry Trigger

```typescript
const result = await dunningStateMachine.handleRetryAttempt(
  subscriptionId,
  workspaceId,
);

if (result.success) {
  console.log(`Subscription renewed until ${result.newPeriodEnd}`);
} else {
  console.log(`Retry failed: ${result.error} → ${result.nextStatus}`);
}
```

## Migration

```sql
-- v12: dunning_state_machine

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS dunning_step INT NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_payment_attempt_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_dunning
    ON subscriptions (next_retry_at)
    WHERE next_retry_at IS NOT NULL AND status IN ('active', 'past_due');

CREATE TABLE IF NOT EXISTS dunning_retry_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    attempt_number    INT NOT NULL,
    dunning_step      INT NOT NULL,
    amount_cents      DECIMAL(18,4) NOT NULL,
    status            STRING(20) NOT NULL CHECK (status IN ('success', 'failed')),
    error_message     STRING(1000),
    gateway_response  JSONB,
    attempted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    INDEX idx_drl_subscription (subscription_id, attempt_number DESC),
    INDEX idx_drl_pending (subscription_id, status) WHERE status = 'failed'
) LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;
```
