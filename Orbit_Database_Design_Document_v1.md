# Orbit --- Database Design Document (DBD)

> Version: 1.0 (Phase 1 MVP)

## 1. Database Overview

**Database:** PostgreSQL (Supabase) **ORM:** Prisma

## 2. Design Principles

-   ACID transactions for buy/sell
-   Normalized schema
-   Foreign keys for integrity
-   Indexed lookup columns
-   UUID primary keys
-   Timestamps on all tables

## 3. Entity Relationship Diagram (Text)

``` text
User
 ├── Wallet (1:1)
 ├── Portfolio (1:N)
 ├── Orders (1:N)
 └── Transactions (1:N)

Order
 └── Transaction (1:1 logical)

Portfolio
 └── References User
```

## 4. Tables

### users

  Column          Type
  --------------- -------------
  id              UUID PK
  name            TEXT
  email           TEXT UNIQUE
  password_hash   TEXT
  created_at      TIMESTAMP

### wallets

  Column       Type
  ------------ ---------------
  id           UUID PK
  user_id      UUID FK
  balance      DECIMAL(18,8)
  created_at   TIMESTAMP

Default balance: **100000.00**

### portfolios

  Column          Type
  --------------- ---------------
  id              UUID PK
  user_id         UUID FK
  symbol          TEXT
  quantity        DECIMAL(24,8)
  average_price   DECIMAL(24,8)
  updated_at      TIMESTAMP

### orders

  Column            Type
  ----------------- -----------
  id                UUID PK
  user_id           UUID FK
  symbol            TEXT
  side              BUY/SELL
  quantity          DECIMAL
  execution_price   DECIMAL
  total             DECIMAL
  status            FILLED
  created_at        TIMESTAMP

### transactions

  Column         Type
  -------------- -----------
  id             UUID PK
  order_id       UUID FK
  user_id        UUID FK
  symbol         TEXT
  realized_pnl   DECIMAL
  created_at     TIMESTAMP

## 5. Indexes

-   users(email)
-   portfolios(user_id,symbol)
-   orders(user_id,created_at)
-   transactions(user_id,created_at)

## 6. Buy Transaction Flow

1.  Begin DB transaction
2.  Check wallet balance
3.  Create order
4.  Update wallet
5.  Insert/update portfolio
6.  Create transaction record
7.  Commit

## 7. Sell Transaction Flow

1.  Begin transaction
2.  Validate holdings
3.  Update portfolio
4.  Credit wallet
5.  Store realized P&L
6.  Commit

## 8. Prisma Schema (Initial)

``` prisma
model User {
  id String @id @default(uuid())
  name String
  email String @unique
  passwordHash String
  createdAt DateTime @default(now())
  wallet Wallet?
  portfolios Portfolio[]
  orders Order[]
  transactions Transaction[]
}

model Wallet {
  id String @id @default(uuid())
  userId String @unique
  balance Decimal
  user User @relation(fields:[userId], references:[id])
}

model Portfolio {
  id String @id @default(uuid())
  userId String
  symbol String
  quantity Decimal
  averagePrice Decimal
  user User @relation(fields:[userId], references:[id])
}

model Order {
  id String @id @default(uuid())
  userId String
  symbol String
  side String
  quantity Decimal
  executionPrice Decimal
  total Decimal
  status String
  user User @relation(fields:[userId], references:[id])
}

model Transaction {
  id String @id @default(uuid())
  orderId String
  userId String
  symbol String
  realizedPnl Decimal?
  user User @relation(fields:[userId], references:[id])
}
```

## 9. Notes

-   Current market prices are **not stored** in the database.
-   Live prices come from Binance WebSocket and are cached in memory.
-   Portfolio value and unrealized P&L are calculated dynamically.
