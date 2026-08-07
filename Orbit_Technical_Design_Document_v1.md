# Orbit --- Technical Design Document (TDD)

> Version: 1.0 (Phase 1 MVP)

# 1. Purpose

This document defines the technical architecture, system components,
data flow, APIs, deployment strategy, and engineering decisions for
Orbit.

# 2. Architecture

    React (Vite)
          |
     REST API + JWT
          |
    Express.js
          |
    -------------------------
    | WebSocket Service     |
    | Trading Engine        |
    | Market Data Service   |
    -------------------------
          |
     Prisma ORM
          |
    Supabase (PostgreSQL)

    Market Data
    Binance REST + WebSocket

# 3. Frontend

-   React + Vite
-   React Router
-   Tailwind CSS
-   shadcn/ui
-   TanStack Query
-   Axios
-   TradingView Lightweight Charts
-   Framer Motion

Suggested folders:

    src/
      components/
      pages/
      hooks/
      services/
      contexts/
      layouts/
      lib/
      utils/

# 4. Backend

Modules

-   Auth
-   Users
-   Wallet
-   Portfolio
-   Orders
-   Transactions
-   Market Data
-   WebSocket Gateway

Suggested structure

    server/
      src/
        controllers/
        routes/
        services/
        middleware/
        prisma/
        websocket/
        utils/

# 5. Authentication

-   JWT Access Token
-   Refresh Token
-   bcrypt password hashing
-   Route protection middleware

# 6. Market Data

REST: - Symbol list - Historical candles

WebSocket: - Live ticker - Live trades - Live candles

Server maintains ONE upstream Binance connection and broadcasts updates
to connected clients.

# 7. Trading Engine

Buy Flow

1.  Validate token
2.  Fetch latest cached price
3.  Verify wallet balance
4.  Begin DB transaction
5.  Create order
6.  Update wallet
7.  Update portfolio average price
8.  Create transaction log
9.  Commit transaction

Sell Flow

1.  Validate ownership
2.  Calculate realized P&L
3.  Update holdings
4.  Credit wallet
5.  Store transaction
6.  Commit

# 8. Database Access

ORM: Prisma

Database: Supabase PostgreSQL

Core tables

-   users
-   wallets
-   portfolios
-   orders
-   transactions

# 9. State Management

Server State - TanStack Query

Local UI - React Context

# 10. Error Handling

HTTP status codes

400 Validation

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

500 Internal Error

# 11. Security

-   Helmet
-   CORS
-   Rate Limiting
-   Input Validation
-   Parameterized Queries
-   Environment Variables

# 12. Deployment

Frontend - Vercel

Backend - Render

Database - Supabase

# 13. Environment Variables

Frontend

-   VITE_API_URL

Backend

-   DATABASE_URL
-   JWT_SECRET
-   REFRESH_SECRET
-   BINANCE_WS_URL
-   BINANCE_REST_URL

# 14. Logging

-   Request logging
-   Error logging
-   Trading events
-   Authentication events

# 15. Future Improvements

-   Redis cache
-   Queue workers
-   Horizontal scaling
-   Microservices
-   Notifications
-   AI services
