# Orbit --- Product Requirements Document (PRD)

> Version: 1.1 (Phase 1 MVP)
>
> Changed in 1.1: short selling moved into Phase 1 with a 1x margin ceiling and
> forced liquidation. Sections 4, 7 and 8 updated; see section 8a for the rules.

## 1. Introduction

**Project Name:** Orbit

**Project Type:** Real-time Crypto Paper Trading Platform

**Objective:** Build a production-style paper trading platform where
users can trade cryptocurrencies with virtual money using live market
prices.

## 2. Goals

-   Provide realistic paper trading.
-   Stream live crypto prices.
-   Track portfolio performance.
-   Practice trading without financial risk.
-   Demonstrate full-stack engineering skills.

## 3. Target Users

-   Beginners learning trading.
-   Students.
-   Developers building portfolios.
-   Traders testing strategies.

## 4. Phase 1 Scope

### Included

-   User authentication
-   Virtual wallet
-   Dashboard
-   Live market prices
-   Buy/Sell market orders
-   **Short selling, capped at 1x with forced liquidation**
-   Portfolio
-   Transaction history
-   P&L calculations
-   User profile
-   Responsive UI

### Excluded

-   Options trading
-   Futures
-   Leverage above 1x
-   Leaderboards
-   AI insights
-   Social trading

## 5. Tech Stack

### Frontend

-   React (Vite)
-   Tailwind CSS
-   shadcn/ui
-   TanStack Query
-   Framer Motion
-   TradingView Lightweight Charts

### Backend

-   Node.js
-   Express.js
-   WebSocket

### Database

-   Supabase (PostgreSQL)
-   Prisma ORM

### Market Data

-   Binance REST API
-   Binance WebSocket API

## 6. High-Level User Flow

1.  Sign Up
2.  Verify/Login
3.  Receive virtual balance (\$100,000)
4.  View dashboard
5.  Search crypto
6.  Buy/Sell
7.  Portfolio updates
8.  View history

## 7. Core Features

-   Authentication
-   Wallet
-   Live prices
-   Market search
-   Coin details
-   Buy/Sell engine
-   Portfolio management
-   Transaction history
-   Profile
-   Settings

## 8. Business Rules

-   Every new user starts with **\$100,000** virtual cash.
-   Only market orders in Phase 1.
-   Users cannot buy beyond available cash.
-   Selling more than you hold opens a **short**, subject to section 8a.
-   No leverage beyond 1x.

## 8a. Short Selling

Shorting is included because the lesson it teaches --- that a losing position
can be closed without asking you --- is the single most valuable thing a
practice platform can demonstrate, and it cannot be learned safely with real
money.

### Model

-   A position carries a **signed quantity**. Negative means short.
-   Selling short **credits the proceeds to cash** and records the negative
    position. Equity is therefore `cash + positions at market`, and a short
    subtracts as the price rises.
-   Buying and selling are the same operation with opposite signs, so one path
    covers opening, adding, reducing, closing and flipping direction.

### Rules

-   **Cash may never go negative.** Borrowing to buy is leverage by another
    name.
-   **Short exposure may not exceed equity** --- a 1x ceiling. A \$100,000
    account can carry at most \$100,000 of shorts.
-   **Realised P&L inverts for shorts**: profit is booked when the price falls.
-   Adding to a short averages the entry; partially covering leaves the entry
    untouched and books profit only on the covered portion.

### Liquidation

-   Maintenance requirement is **25% of short exposure**.
-   A server-side sweep runs **every 15 seconds** against the live price feed.
-   When equity falls below maintenance, shorts are **force-closed largest
    first**, so the fewest forced trades restore the account.
-   Liquidations are recorded as ordinary fills, so they appear in order and
    transaction history like any other trade.
-   The sweep is **skipped while the market feed is disconnected** --- valuing
    positions against stale prices could liquidate an account that is solvent.

### What is still excluded

-   Leverage above 1x.
-   Borrowing fees or funding rates.
-   Partial liquidation tuned to restore the exact minimum margin; Orbit closes
    whole positions.

## 9. Success Metrics

-   Successful signup/login
-   Live prices update reliably
-   Orders execute correctly
-   Portfolio values remain accurate
-   Responsive UI on desktop/mobile

## 10. Phase Roadmap

### Phase 1

Spot paper trading, including short selling at 1x with forced liquidation.

### Phase 2

Watchlist, limit orders, stop-losses, alerts, analytics.

### Phase 3

Options, futures, leverage above 1x, AI features.

------------------------------------------------------------------------

This is the foundation PRD. Future revisions will expand each section
with detailed page specifications, user stories, acceptance criteria,
edge cases, and API mappings.
