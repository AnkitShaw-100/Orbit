-- Makes a retried order safe to send twice.
--
-- Nullable, because clients that do not send a key keep working unchanged --
-- and Postgres treats every NULL in a unique index as distinct, so those rows
-- do not collide with each other.
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;

-- Scoped to the user: two people may pick the same key without colliding.
CREATE UNIQUE INDEX "orders_user_id_idempotency_key_key"
  ON "orders"("user_id", "idempotency_key");
