# Eks-Clean — Household Services Operating System

> A production-grade, enterprise-ready SaaS platform for household services businesses.
> Manages customers, workers, field operations, logistics, subscriptions, inventory,
> quality assurance, analytics, and a future gig marketplace.

---

## Architecture

Eks-Clean is **modular, domain-driven, event-driven, API-first**, and designed to support
millions of users.

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, React 19, TypeScript 5, TailwindCSS 4, shadcn/ui, React Query, React Hook Form, Zod |
| Backend | Next.js API Routes (Route Handlers), Prisma ORM, JWT + refresh-token rotation, RBAC, MFA-ready |
| Database | PostgreSQL 16 (production) / SQLite (dev) — schema is portable |
| Cache | Redis 7 (production; in-memory in dev) |
| Queue | BullMQ-compatible abstraction (in-memory in dev) |
| Realtime | socket.io mini-service on port 3001 |
| Payments | PaymentGateway interface — sole impl is `PayswapGateway` (Payswap treated like Stripe) |
| Infra | Docker, docker-compose, GitHub Actions CI, Prometheus metrics, OpenAPI |

### Bounded Contexts

```
src/lib/modules/
├── auth/             # register, login, refresh, logout, MFA-ready
├── customers/        # profiles, addresses, households, favorites
├── workers/          # onboarding, KYC, skills, certifications, training
├── field-managers/   # recruit, audit, route planning
├── sales/            # leads, conversions, commissions
├── services/         # catalog (configurable, no code changes to add services)
├── bookings/         # lifecycle, status flow, history
├── dispatch/         # auto-assign: rating + quality + proximity + utilization + tenure
├── quality/          # customer ratings + manager audits
├── subscriptions/    # plans + pause/resume/cancel via Payswap
├── inventory/        # chemicals, tools, PPE; warehouse + worker stock; movements
├── training/         # modules, exams, recertification dates
├── laundry/          # pickup → sort → wash → dry → iron → pack → deliver
├── waste/            # schedules, zones, truck routing
├── payments/         # thin orchestration over PaymentGateway — never stores cards
├── marketplace/      # future-ready, gated behind feature flag
├── analytics/        # revenue, retention, utilization, completion rates
└── notifications/    # in-app notifications
```

### Critical Payment Contract

> The application **MUST NEVER** implement payment logic.
> Payments are delegated entirely to Payswap's REST API.
> The application only stores payment references.

```ts
// src/lib/payment/gateway.ts
export interface PaymentGateway {
  createCustomer()
  createPaymentIntent()
  capturePayment()
  refundPayment()
  createCheckoutSession()
  createSubscription()
  cancelSubscription()
  transferToWorker()
  createConnectedAccount()
  verifyWebhook()
  syncInvoice()
}
```

- The **only** implementation is `PayswapGateway` (`src/lib/payment/payswap-gateway.ts`).
- No business logic imports `PayswapGateway` directly — all callers go through
  `getPaymentGateway()` which returns `PaymentGateway`.
- In dev, `PayswapGateway` runs in MOCK mode: it generates Payswap-shaped ids
  (`psw_cust_*`, `psw_pi_*`, etc.) and simulates success. Set `PAYS_SWAP_API_KEY`
  to switch to LIVE mode.

---

## Quickstart

```bash
# 1. Install deps
npm install

# 2. Set up the database (SQLite by default; see .env)
npx prisma db push

# 3. Seed demo data
npm run seed

# 4. Start the dev server (Next.js)
npm run dev

# 5. In a separate terminal, start the realtime service
cd mini-services/realtime && npm run dev
```

Open the preview panel to view the app.

### Demo accounts (password: `EksClean123!`)

| Role | Email |
|------|-------|
| Admin | `admin@eksclean.example` |
| Field Manager | `fm1@eksclean.example` |
| Sales Agent | `sales1@eksclean.example` |
| Customer | `adwoa@example.com` |
| Worker | `samuel.w@eksclean.example` |

---

## Production deployment

```bash
# Build & start the full stack
docker compose up -d

# Run migrations
docker compose exec app npx prisma migrate deploy

# Seed (optional)
docker compose exec app npm run seed
```

Services exposed:
- `:3000` — Next.js app
- `:3001` — socket.io (websocket)
- `:9090` — Prometheus
- `:5432` — PostgreSQL
- `:6379` — Redis

### Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | `file:./db/custom.db` | Prisma datasource (SQLite or PostgreSQL URL) |
| `JWT_SECRET` | `eks_clean_dev_secret_change_me` | HS256 signing secret |
| `PAYS_SWAP_API_KEY` | (unset → MOCK mode) | Payswap API key |
| `PAYS_SWAP_BASE_URL` | `https://api.payswap.example/v1` | Payswap base URL |
| `PAYS_SWAP_WEBHOOK_SECRET` | `psw_wh_secret_dev` | Payswap webhook HMAC secret |
| `REALTIME_INTERNAL_URL` | `http://127.0.0.1:3002` | Realtime service internal HTTP API |

---

## API surface

See the **Architecture** tab in the app for the full list, or
[`docs/openapi.yaml`](docs/openapi.yaml) for the OpenAPI spec.

Highlights:
- `POST /api/auth/{register,login,refresh,logout}` · `GET /api/auth/me`
- `GET|POST /api/customers` · `GET /api/customers/:id`
- `GET|POST /api/workers` · `PATCH /api/workers/:id` · `POST /api/workers/:id/{kyc,skills,availability,training}`
- `GET /api/services` · `PATCH /api/services/:id`
- `GET|POST /api/bookings` · `GET|PATCH /api/bookings/:id` · `POST /api/bookings/:id/{dispatch,payment,ratings}`
- `GET|POST /api/dispatch`
- `GET|POST /api/subscriptions` · `POST /api/subscriptions/:id/{pause,resume,cancel}`
- `GET|POST /api/inventory/items` · `GET|POST /api/inventory/:id/stock`
- `GET /api/analytics/{overview,revenue}`
- `GET /api/audit`
- `GET|POST /api/sales/leads` · `POST /api/sales/leads/:id/convert`
- `POST /api/field-managers/:id/recruits`
- `POST /api/payments/checkout` · `GET /api/payments/intents` · `POST /api/payments/intents/:id/{capture,refund}`
- `POST /api/payments/payouts` · `POST /api/payments/webhooks`
- `GET|POST /api/laundry/orders`
- `GET|POST /api/waste/schedules`
- `POST /api/marketplace/applications` · `POST /api/marketplace/applications/:id/approve`
- `GET|PATCH /api/feature-flags`
- `GET /api/notifications` · `GET /api/health`

---

## Security

- **RBAC** — 5 roles, 40+ permissions, data-driven (see `src/lib/rbac/index.ts`)
- **JWT** — HS256, 15-minute access tokens, 30-day opaque refresh tokens (hashed in DB)
- **Refresh-token rotation** — every refresh issues a new token and revokes the old
- **MFA-ready** — `User.mfaEnabled` + `User.mfaSecret` columns; wire `otplib` to enable
- **Rate limiting** — token-bucket per (ip, email) on login; configurable per route
- **Audit log** — every state change is persisted (`AuditLog` table)
- **Soft delete** — `deletedAt` on all customer/worker/booking tables
- **GDPR-ready** — soft deletes + audit log + retention policy hooks
- **Encryption** — passwords PBKDF2-SHA256 (120k iter); JWT HS256; webhook HMAC verification

---

## Future-ready modules (gated behind feature flags)

| Flag | Module |
|------|--------|
| `marketplace.open` | Independent worker marketplace + Payswap payout splitting |
| `ai.demand_forecast` | Demand forecasting agent |
| `ai.dispatch_optimizer` | AI dispatch optimizer |
| `ai.qa_prediction` | Quality prediction |
| `ai.support_assistant` | Customer support AI |

Toggle from the UI (`GET /api/feature-flags` → `PATCH`) or directly in DB.

---

## Testing

The codebase is structured for testability:
- `src/lib/**/*.ts` — framework-agnostic, pure functions (unit-testable)
- `src/lib/payment/payswap-gateway.ts` — MOCK mode for deterministic e2e
- Factories + seed script in `scripts/seed.ts`

Run:
```bash
npm run lint
npx tsc --noEmit
npm run seed   # against a test DB
```

---

## License

Proprietary © 2026 Eks-Clean. All rights reserved.
