# Orbit

**Real-time crypto paper trading platform.** Trade 100 live Binance markets with $100,000 of virtual
money — including short selling at 1x with server-side forced liquidation.

Orbit is built like a real trading system, not a demo: fills are priced by the server, every trade is
a single ACID database transaction, all money arithmetic runs on arbitrary-precision decimals, and a
background margin sweep closes shorts that run past what the account can cover.

---

## Table of contents

- [Why it exists](#why-it-exists)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [How trading works](#how-trading-works)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Design documents](#design-documents)
- [Roadmap](#roadmap)

---

## Why it exists

Most paper-trading toys let you buy and sell and stop there. Orbit includes **short selling**,
because the lesson it teaches — that a losing position can be closed *without asking you* — is the
single most valuable thing a practice platform can demonstrate, and it cannot be learned safely with
real money.

---

## Features

**Trading**

- Market buy/sell against live Binance prices, executed at a **server-side price** — the browser never
  supplies its own fill price
- **Short selling** with a 1x margin ceiling (short exposure may never exceed equity)
- **Forced liquidation**: a 15-second server sweep closes shorts largest-first when equity falls below
  25% of short exposure
- Signed positions, so one code path covers opening, adding, reducing, closing, and *flipping*
  direction in a single order
- Realised and unrealised P&L, correct in both directions (a short profits as price falls)

**Market data**

- 25 markets **discovered at boot** — the busiest USDT spot pairs by real traded volume, not a
  hardcoded list. Leveraged tokens (`BTCUP`, `ETHDOWN`), stablecoin pairs and anything without a
  real logo are filtered out, so every listed coin renders with its own artwork
- **One** upstream Binance WebSocket connection for the whole platform, fanned out to every browser
  over Orbit's own `/ws` gateway. This keeps Orbit inside Binance's rate limits and means users in
  regions Binance blocks still see live prices
- Historical candles (7 intervals) via Binance REST, rendered with TradingView Lightweight Charts
- New tabs receive the full price cache on connect, so the first paint shows real prices

**Platform**

- Supabase Auth (JWKS / HS256 verified server-side); credentials are never stored in Orbit's database
- Just-in-time user provisioning — the profile row and its $100,000 wallet are created in one
  transaction on first authenticated request
- Three-tier rate limiting (reads / orders / chart requests), Helmet, CORS with Vercel preview-URL
  support, and request validation on every endpoint
- Graceful shutdown: feed, client sockets, and Postgres pool close in order on `SIGTERM`
- Responsive marketing landing page + authenticated app shell, light and dark themes

---

## Architecture

```
                    Browser (React + Vite, Vercel)
                          |            |
              REST + Bearer JWT     WS /ws  (live ticks)
                          |            |
              ┌───────────┴────────────┴───────────┐
              │        Express 5 API (Railway)     │
              │                                    │
              │   Auth middleware (Supabase JWT)   │
              │   Trading engine  ── tradingMath   │
              │   Liquidation sweep (15s timer)    │
              │   Market data service ── cache     │
              │   WebSocket gateway (fan-out)      │
              └───────────┬────────────┬───────────┘
                          │            │
                    Prisma ORM    1x WebSocket + REST
                          │            │
                Supabase Postgres   Binance
```

Two properties hold the design together:

1. **Prices are never persisted.** They live in an in-memory cache fed by the Binance socket.
   Portfolio value, unrealised P&L, and margin are all derived at read time.
2. **Money arithmetic is isolated and pure.** `tradingMath.js` contains no database access, so the
   position and margin rules can be tested exactly against decimal strings.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, shadcn/ui, TanStack Query, Framer Motion, Lightweight Charts |
| Backend | Node.js ≥20.19, Express 5, `ws`, Helmet, express-rate-limit, express-validator |
| Database | Supabase PostgreSQL + Prisma 7 (driver adapter, pooled runtime / direct migrations) |
| Auth | Supabase Auth, verified server-side with `jose` (JWKS or HS256) |
| Market data | Binance REST (`/ticker/24hr`, `/klines`) + combined WebSocket ticker stream |
| Precision | `Prisma.Decimal` end to end; `DECIMAL(24,8)` columns |
| Hosting | Vercel (frontend) · Railway (API) · Supabase (database) |

---

## How trading works

Every fill is one database transaction: read wallet and positions → apply the fill → move cash →
check margin → write the order and its transaction row → commit. Nothing is written outside the
transaction, because a partial write would leave a wallet that doesn't match its holdings.

**Position model.** A position carries a *signed* quantity; negative means short. Buying and selling
are the same operation with opposite signs.

| Case | Quantity | Average price | Realised P&L |
| --- | --- | --- | --- |
| Open | set to fill | fill price | — |
| Add (same direction) | summed | cost-weighted average | — |
| Reduce / close | summed | unchanged | booked on the closed portion |
| Flip through zero | summed (sign flips) | reset to fill price | booked on the old position |

**Margin rules**

- Cash may never go negative — borrowing to buy is leverage by another name
- Short exposure may not exceed equity (`equity = cash + Σ positions at market`) — a 1x ceiling
- Maintenance requirement is 25% of short exposure
- Below maintenance, shorts are force-closed **largest first**, so the fewest forced trades restore
  the account
- The sweep is **skipped while the market feed is disconnected** — valuing positions against stale
  prices could liquidate an account that is perfectly solvent
- Liquidations are written as ordinary fills, so they appear in order and transaction history like
  any other trade

---

## Getting started

**Prerequisites:** Node.js ≥ 20.19, a Supabase project (Postgres + Auth).

```bash
git clone https://github.com/AnkitShaw-100/Orbit.git
cd Orbit
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, SUPABASE_URL
npm run db:migrate        # apply the Prisma migration
npm run dev               # http://localhost:8080
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env      # fill in VITE_API_URL + Supabase keys
npm run dev               # http://localhost:5173
```

Sign up, and the first authenticated request provisions your account with $100,000.

### Scripts

| Backend | |
| --- | --- |
| `npm run dev` | nodemon, hot reload |
| `npm start` | production server |
| `npm run start:migrate` | `migrate deploy` then start (used by Railway) |
| `npm run db:migrate` / `db:deploy` / `db:studio` | Prisma migrate dev / deploy / Studio |
| `npm test` | Node's built-in test runner |

| Frontend | |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite |
| `npm run lint` | ESLint |

---

## Environment variables

**Backend** (`backend/.env`)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Supabase pooled connection (pgbouncer, port 6543) — runtime queries |
| `DIRECT_URL` | ✅ | Supabase direct connection (port 5432) — migrations |
| `SUPABASE_URL` | ✅ | Token issuer; the API verifies but never issues tokens |
| `SUPABASE_JWT_SECRET` | | Only for legacy HS256 projects. Blank = verify via JWKS |
| `PORT` | | Defaults to `8080` |
| `NODE_ENV` | | Rate limiting is skipped outside production |
| `BINANCE_REST_URL` / `BINANCE_WS_URL` | | Sensible defaults |
| `SYMBOL_LIMIT` | | Markets to list. Defaults to `100` |
| `CLIENT_URL` | | Allowed CORS origin |
| `VERCEL_PROJECT` | | Project slug, so branch/PR preview URLs are allowed automatically |
| `EXTRA_ORIGINS` | | Comma-separated additional origins |

**Frontend** (`frontend/.env`) — `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## API reference

Base path `/api`. Protected routes take `Authorization: Bearer <supabase access token>`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | — | Service banner: status, feed state, markets listed, endpoint index |
| `GET` | `/health` | — | Health check (used by Railway) |
| `GET` | `/api/markets` | — | All listed markets with last price, 24h change, volume, high/low |
| `GET` | `/api/markets/:symbol/klines` | — | Candles. `interval` ∈ `1m,5m,15m,1h,4h,1d,1w`, `limit` 10–500 |
| `GET` | `/api/me` | ✅ | Profile + wallet (provisions the account on first call) |
| `GET` | `/api/wallet` | ✅ | Cash balance and starting cash |
| `GET` | `/api/portfolio` | ✅ | Holdings, equity, unrealised P&L, short exposure, margin ratio, at-risk flag |
| `POST` | `/api/orders` | ✅ | Place a market order — `{ symbol, side: BUY\|SELL, quantity }` |
| `GET` | `/api/orders` | ✅ | Order history (`limit` ≤ 200, optional `symbol`) |
| `GET` | `/api/transactions` | ✅ | Transaction history with realised P&L |
| `WS` | `/ws` | — | `{ type: "snapshot" }` on connect, then `{ type: "tick", ... }` per update |

Errors are uniform: `{ "error": { "message": "...", "details": [...] } }` with 400 / 401 / 404 /
502 / 503 as appropriate.

---

## Testing

```bash
cd backend && npm test
```

18 tests over the trading engine's arithmetic, run against exact decimal strings rather than
approximate equality — a rounding bug here would compound silently across an account's lifetime.

- `tradingMath.test.js` — no floating-point drift (`0.1 × 3` is `0.3`, not `0.30000000000000004`);
  a buy/sell round trip lands back on `100000.00` to the cent; quantity validation
- `shorting.test.js` — the full position lifecycle (open, add, partially cover, close, flip in both
  directions), equity and short-notional computation, the 1x margin ceiling, the cash-negative
  refusal, the liquidation threshold, and a complete short lifecycle returning exact starting cash

---

## Project structure

```
backend/
  prisma/
    schema.prisma            users · wallets · portfolios · orders · transactions
    migrations/
  src/
    config/env.js            fails loudly at boot on missing config
    lib/prisma.js            PrismaClient + pg driver adapter
    middleware/              authenticate · validate · rateLimit · errorHandler
    routes/index.js          all endpoints, with per-route validators
    services/
      marketData.service.js  Binance discovery, socket, in-memory price cache
      order.service.js       the trading engine (one transaction per fill)
      tradingMath.js         pure decimal arithmetic: fills, equity, margin
      liquidation.service.js the 15-second margin sweep
      portfolio.service.js   derived portfolio values and margin ratio
      *.test.js
    websocket/gateway.js     fan-out to browsers + heartbeat
    app.js  server.js

frontend/
  src/
    components/
      landing/               hero, markets table, charts, FAQ, CTA
      app/                   AppShell, Sidebar, RequireAuth, Panel, QueryState
      ui/                    shadcn/ui primitives
    pages/
      app/                   Dashboard · Markets · Trade · Portfolio · Transactions · Profile · Settings
      auth/                  Login · Signup
    hooks/useOrbitPrices.js  live ticks over Orbit's own WS, with backoff reconnect
    lib/api.js               single API client; token read per call so refreshes are picked up
    context/AuthProvider.jsx
```

---

## Deployment

| Piece | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | `vercel.json` — Vite build, SPA rewrites |
| Backend | Railway | `railway.json` — Nixpacks, `/health` check, `migrate deploy` on start, restart on failure |
| Database | Supabase | Pooled URL at runtime, direct URL for migrations |

Supabase pauses free projects after 7 days without database activity, which takes the whole app
down with it. [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) runs a daily query
against the database to keep that clock from reaching zero. It needs one repository secret,
`SUPABASE_DB_URL` (the same value as `DIRECT_URL`). It lives in GitHub Actions rather than in the API
on purpose — the API only touches the database while it is deployed and running.

CORS accepts the configured client, any preview URL on the same Vercel project, and origin-less
requests (curl, health checks). A refused origin withholds CORS headers and logs, rather than
throwing a 500 that reads as "the API is broken."

---

## Design documents

Orbit was specified before it was built. The four documents in the repo root are the source of truth,
and the code cites them by section:

- [`Orbit_PRD_Phase1_v1.md`](Orbit_PRD_Phase1_v1.md) — scope, business rules, the short-selling model
- [`Orbit_Technical_Design_Document_v1.md`](Orbit_Technical_Design_Document_v1.md) — architecture, flows, security
- [`Orbit_Database_Design_Document_v1.md`](Orbit_Database_Design_Document_v1.md) — schema, indexes, transaction flows
- [`Orbit_Frontend_Design_System_v1.md`](Orbit_Frontend_Design_System_v1.md) — palette, type scale, spacing

---

## Roadmap

**Phase 1 (current)** — spot paper trading, short selling at 1x, forced liquidation.
**Phase 2** — watchlists, limit orders, stop-losses, price alerts, analytics.
**Phase 3** — options, futures, leverage above 1x, AI insights.

Deliberately out of scope for now: leverage above 1x, borrowing fees and funding rates, and partial
liquidation tuned to restore an exact minimum margin — Orbit closes whole positions.

---

Built by [Ankit Shaw](https://github.com/AnkitShaw-100).
