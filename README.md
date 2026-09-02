# Orbit

Real-time crypto paper trading. Trade live spot markets with $100,000 of virtual money, including
short selling with server-enforced margin and forced liquidation.

[![tests](https://github.com/AnkitShaw-100/Orbit/actions/workflows/test.yml/badge.svg)](https://github.com/AnkitShaw-100/Orbit/actions/workflows/test.yml)

Orbit is built to the standards of a real trading system rather than a demo. Fills are priced by the
server, every fill is a single ACID database transaction taken under a row lock, all money
arithmetic runs on fixed-precision decimals, and a background sweep closes short positions that run
past what the account can cover.

API: https://orbit-qfq8.onrender.com

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Trading model](#trading-model)
- [Order safety](#order-safety)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Design documents](#design-documents)
- [Roadmap](#roadmap)

## Features

### Trading

* Market buy and sell orders filled at a server-side price. The browser never supplies its own
  execution price.
* Short selling with a 1x exposure ceiling: short notional may never exceed account equity.
* Forced liquidation. A 15 second sweep closes shorts largest-first when equity falls below 25% of
  short exposure. Liquidations are written as ordinary fills, so they appear in order and
  transaction history like any other trade.
* Signed positions, so one code path covers opening, adding, reducing, closing and flipping
  direction within a single order.
* Realised and unrealised P&L computed correctly in both directions, so a short profits as price
  falls.
* Per-fill cash ledger. Every transaction records the cash it moved and the balance it left behind,
  which makes any balance auditable from its own row instead of by replaying history.

### Market data

* 25 markets discovered at boot from live traded volume rather than a hardcoded list. Leveraged
  tokens (BTCUP, ETHDOWN), stablecoin pairs and tickers with no available artwork are filtered out,
  so every listed market renders with its own logo.
* Two providers. Binance is preferred and Bybit is the automatic fallback, chosen because it names
  spot symbols identically, so a failover changes nothing above the provider layer. Both are
  re-checked on every discovery cycle, so Orbit returns to Binance on its own once a ban lifts.
* Host rotation within each provider. A 418 or 429 on shared cloud egress is usually a ban inherited
  from another tenant, so requests walk a list of alternate hosts and promote whichever one answers.
* A single upstream market socket for the whole platform, fanned out to every browser over Orbit's
  own `/ws` gateway. This keeps Orbit inside exchange rate limits and lets users in restricted
  regions still receive live prices.
* Historical candles across seven intervals, rendered with TradingView Lightweight Charts.
* New tabs receive the full price cache on connect, so the first paint shows real prices.

### Platform

* Supabase Auth, verified server-side through JWKS or legacy HS256. Credentials are never stored in
  Orbit's database.
* Just-in-time provisioning. The profile row and its $100,000 wallet are created in one transaction
  on the first authenticated request.
* Rate limiting built on an in-house token bucket across four tiers (reads, orders, chart requests,
  and failed authentication), so a burst is forgiven while the sustained rate is held exactly.
* Failed token verification is rate limited separately and refused before any signature check runs,
  so forged tokens cannot make the API do unbounded cryptographic work. A successful verification
  clears the record.
* Helmet, CORS with automatic Vercel preview-URL support, request validation on every endpoint, and
  a uniform error envelope.
* Graceful shutdown. The market feed, client sockets and Postgres pool close in order on `SIGTERM`.
* Responsive marketing site and authenticated app shell, with light and dark themes.

## Architecture

```
                    Browser (React + Vite, Vercel)
                          |            |
              REST + Bearer JWT     WS /ws  (live ticks)
                          |            |
              +-----------+------------+-----------+
              |        Express 5 API (Render)      |
              |                                    |
              |   Auth middleware (Supabase JWT)   |
              |   Trading engine  -> tradingMath   |
              |   Liquidation sweep (15s timer)    |
              |   Market data service -> cache     |
              |   WebSocket gateway (fan-out)      |
              +-----------+------------+-----------+
                          |            |
                    Prisma ORM    1 socket + REST
                          |            |
                Supabase Postgres   Binance / Bybit
```

Two decisions carry the design:

1. **Prices are never persisted.** They live in an in-memory cache fed by the market socket.
   Portfolio value, unrealised P&L and margin are all derived at read time.
2. **Money arithmetic is pure and isolated.** `tradingMath.js` touches no database, so position and
   margin rules are tested directly against exact decimal strings.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, shadcn/ui, Base UI, TanStack Query, Framer Motion, Lightweight Charts, Recharts |
| Backend | Node.js >= 20.19, Express 5, `ws`, Helmet, express-validator, custom token-bucket limiter |
| Database | Supabase PostgreSQL, Prisma 7 with the `pg` driver adapter (pooled at runtime, direct for migrations) |
| Auth | Supabase Auth, verified server-side with `jose` (JWKS or HS256) |
| Market data | Binance REST and WebSocket, with Bybit as fallback |
| Precision | `Prisma.Decimal` end to end, `DECIMAL(24,8)` columns |
| Testing | Node's built-in test runner, integration suite against a real Postgres |
| Hosting | Vercel (frontend), Render (API), Supabase (database) |

## Trading model

Every fill is one database transaction: lock the account, read the balance and positions, apply the
fill, move cash, check margin, write the order and its transaction row, commit. Nothing is written
outside the transaction, because a partial write would leave a wallet that disagrees with its
holdings.

**Positions.** A position carries a signed quantity, where negative means short. Buying and selling
are the same operation with opposite signs.

| Case | Quantity | Average price | Realised P&L |
| --- | --- | --- | --- |
| Open | set to fill | fill price | none |
| Add in the same direction | summed | cost-weighted average | none |
| Reduce or close | summed | unchanged | booked on the closed portion |
| Flip through zero | summed, sign flips | reset to fill price | booked on the old position |

**Margin rules.**

* Cash may never go negative. Borrowing to buy is leverage under another name.
* Short exposure may not exceed equity, where `equity = cash + positions valued at market`. This is
  the 1x ceiling.
* The maintenance requirement is 25% of short exposure.
* Below maintenance, shorts are force-closed largest-first, so the fewest forced trades restore the
  account.
* The sweep is skipped while the market feed is disconnected. Valuing positions against stale prices
  could liquidate an account that is perfectly solvent.

## Order safety

Two guarantees hold the order path together, and both are proved by integration tests against a real
Postgres rather than asserted here.

**Concurrency.** The transaction opens by taking the wallet row's write lock with
`SELECT ... FOR UPDATE`. Postgres runs READ COMMITTED by default, where an unlocked read blocks
nothing, so without this lock two orders placed at the same instant would both read the same
balance, both decide they can afford it, and the second write would overwrite the first. The wallet
row acts as the account's mutex: it serialises one user's fills without serialising unrelated users.

**Idempotency.** `POST /api/orders` accepts an `Idempotency-Key` header, or an `idempotencyKey` body
field for clients that cannot set headers. A repeat of the same key returns the original order with
`replayed: true` and HTTP 200 instead of placing a second one, so a double-click, a dropped response
or an automatic retry is safe. The key is checked once outside the lock as a fast path and again
while holding it, backed by a unique index scoped per user. Clients that send no key are unaffected,
since Postgres treats each NULL in a unique index as distinct.

## Getting started

**Prerequisites:** Node.js 20.19 or newer, and a Supabase project with Postgres and Auth enabled.

```bash
git clone https://github.com/AnkitShaw-100/Orbit.git
cd Orbit
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, SUPABASE_URL
npm run db:migrate        # apply the Prisma migrations
npm run dev               # http://localhost:8080
```

**Frontend**, in a second terminal:

```bash
cd frontend
npm install
cp .env.example .env      # fill in VITE_API_URL and the Supabase keys
npm run dev               # http://localhost:5173
```

Sign up, and the first authenticated request provisions the account with $100,000.

### Scripts

| Backend | Purpose |
| --- | --- |
| `npm run dev` | nodemon with hot reload |
| `npm start` | production server |
| `npm run start:migrate` | `migrate deploy`, then start (used by Render) |
| `npm run db:migrate` | Prisma `migrate dev` |
| `npm run db:deploy` | Prisma `migrate deploy` |
| `npm run db:studio` | Prisma Studio |
| `npm test` | unit tests |
| `npm run test:integration` | integration tests against a real Postgres |
| `npm run test:all` | both suites |

| Frontend | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | production build to `dist/` |
| `npm run preview` | serve the production build |
| `npm run lint` | ESLint |

## Configuration

**Backend** (`backend/.env`)

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase pooled connection (pgbouncer, port 6543), used for runtime queries |
| `DIRECT_URL` | Yes | Supabase direct connection (port 5432), used for migrations |
| `SUPABASE_URL` | Yes | Token issuer. The API verifies tokens but never issues them |
| `SUPABASE_JWT_SECRET` | No | Only for legacy HS256 projects. Blank means verification via JWKS |
| `PORT` | No | Defaults to `8080` |
| `NODE_ENV` | No | Rate limiting is disabled outside production |
| `BINANCE_REST_URL`, `BINANCE_WS_URL` | No | Preferred hosts, tried ahead of the built-in alternates |
| `SYMBOL_LIMIT` | No | Number of markets listed. Defaults to `25` |
| `CLIENT_URL` | No | Allowed CORS origins, comma separated |
| `VERCEL_PROJECT` | No | Project slug, so branch and pull-request preview URLs are allowed automatically |
| `EXTRA_ORIGINS` | No | Additional allowed origins, comma separated |

**Frontend** (`frontend/.env`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## API reference

Base path `/api`. Protected routes require `Authorization: Bearer <supabase access token>`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Service banner: status, feed state, markets listed, endpoint index |
| `GET` | `/health` | No | Health check, including market feed state |
| `GET` | `/api/markets` | No | Listed markets with last price, 24h change, volume, high and low |
| `GET` | `/api/markets/:symbol/klines` | No | Candles. `interval` in `1m,5m,15m,1h,4h,1d,1w`, `limit` 10 to 500 |
| `GET` | `/api/me` | Yes | Profile and wallet. Provisions the account on first call |
| `GET` | `/api/wallet` | Yes | Cash balance and starting cash |
| `GET` | `/api/portfolio` | Yes | Holdings, equity, unrealised P&L, short exposure and capacity, margin ratio, at-risk flag |
| `POST` | `/api/orders` | Yes | Place a market order: `{ symbol, side: BUY \| SELL, quantity }`. Honours `Idempotency-Key` |
| `GET` | `/api/orders` | Yes | Order history. `limit` up to 200, optional `symbol` |
| `GET` | `/api/transactions` | Yes | Transaction history with realised P&L and cash movement |
| `WS` | `/ws` | No | `{ type: "snapshot" }` on connect, then `{ type: "tick", ... }` per update |

Errors share one shape, `{ "error": { "message": "...", "details": [...] } }`, returned with 400,
401, 404, 429, 502 or 503 as appropriate.

## Testing

```bash
cd backend
npm test                  # 55 unit tests
npm run test:integration  # 9 integration tests, needs a disposable Postgres
```

Both suites run on every push and pull request through GitHub Actions.

**Unit tests** check the arithmetic against exact decimal strings rather than approximate equality,
because a rounding error here would compound silently across an account's lifetime.

* `tradingMath.test.js` covers decimal behaviour, including that a buy and sell round trip returns to
  `100000.00` exactly.
* `orderRules.test.js` covers cash and margin refusals, and quantity validation.
* `shorting.test.js` covers the full position lifecycle (open, add, partially cover, close, flip in
  both directions), equity and short notional, the 1x ceiling, and the liquidation threshold.
* `tokenBucket.test.js` covers burst capacity, refill rate, retry-after reporting and idle sweeping.

**Integration tests** prove the guarantees unit tests cannot, since they are properties of Postgres
rather than of any function in this repository: that two simultaneous buys cannot spend the same
balance, that a flood of concurrent buys stops exactly at the balance, that a refused order leaves no
holding behind, that the same idempotency key sent twice concurrently fills once, and that
`FOR UPDATE` blocks a second writer while an unlocked read does not.

They use `TEST_DATABASE_URL` when it is set, which is how CI supplies a service container, and
otherwise start a throwaway embedded Postgres, so they also run on a machine with no Docker. The
harness refuses to run against a non-local database unless `ALLOW_REMOTE_TEST_DB` is set.

## Project structure

```
backend/
  prisma/
    schema.prisma            users, wallets, portfolios, orders, transactions
    migrations/
  src/
    config/env.js            fails loudly at boot on missing configuration
    lib/
      prisma.js              PrismaClient with the pg driver adapter
      tokenBucket.js         rate limiting primitive
    middleware/              authenticate, validate, rateLimit, errorHandler
    routes/index.js          all endpoints with per-route validators
    services/
      providers/             binance.js, bybit.js (provider-specific mapping)
      marketData.service.js  discovery, socket, in-memory price cache
      order.service.js       trading engine: one locked transaction per fill
      tradingMath.js         pure decimal arithmetic for fills, equity, margin
      liquidation.service.js the 15 second margin sweep
      portfolio.service.js   derived portfolio values and margin ratio
    websocket/gateway.js     fan-out to browsers, with heartbeat
    app.js, server.js
  test/integration/          concurrency and locking, against a real Postgres

frontend/
  src/
    components/
      landing/               hero, market wall, ticker tape, charts, FAQ, CTA
      app/                   AppShell, Sidebar, RequireAuth, Panel, QueryState, Pagination
      auth/                  AuthDialog, AuthLink
      ui/                    shadcn/ui primitives
    pages/
      app/                   Dashboard, Markets, Trade, Transactions, Profile, Settings
      auth/                  Login, Signup
    hooks/useOrbitPrices.js  live ticks over Orbit's WebSocket, with backoff reconnect
    lib/api.js               single API client, token read per call so refreshes are picked up
    context/AuthProvider.jsx
```

Signing in renders as a card over the current page. `/login` and `/signup` remain real routes, so the
card survives a refresh, closes on the back button, and gives confirmation emails somewhere to land.

## Deployment

| Piece | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | `vercel.json`: Vite build with SPA rewrites |
| Backend | Render | `/health` check, `migrate deploy` on start, restart on failure |
| Database | Supabase | Pooled URL at runtime, direct URL for migrations |

CORS accepts the configured client, any preview URL on the same Vercel project, and origin-less
requests such as curl and health checks. A refused origin has its CORS headers withheld and is
logged, rather than throwing a 500 that reads as a broken API.

Supabase pauses free projects after 7 days without database activity, which takes the whole app down
with it. [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) runs a daily query to
keep that clock from reaching zero. It needs one repository secret, `SUPABASE_DB_URL`, holding the
same value as `DIRECT_URL`. It lives in GitHub Actions rather than in the API on purpose, since the
API only touches the database while it is deployed and running.

## Design documents

Orbit was specified before it was built, and the code cites these by section:

* [`Orbit_PRD_Phase1_v1.md`](Orbit_PRD_Phase1_v1.md): scope, business rules, the short-selling model
* [`Orbit_Technical_Design_Document_v1.md`](Orbit_Technical_Design_Document_v1.md): architecture, flows, security
* [`Orbit_Database_Design_Document_v1.md`](Orbit_Database_Design_Document_v1.md): schema, indexes, transaction flows
* [`Orbit_Frontend_Design_System_v1.md`](Orbit_Frontend_Design_System_v1.md): palette, type scale, spacing

## Roadmap

Shipped: spot paper trading, short selling at 1x, forced liquidation, idempotent orders,
concurrency-safe fills, provider failover.

Planned: watchlists, limit orders, stop losses, price alerts, deeper analytics.

Out of scope for now: leverage above 1x, borrowing fees and funding rates, and partial liquidation
sized to restore an exact minimum margin. Orbit closes whole positions.

## Author

Built by [Ankit Shaw](https://github.com/AnkitShaw-100).
