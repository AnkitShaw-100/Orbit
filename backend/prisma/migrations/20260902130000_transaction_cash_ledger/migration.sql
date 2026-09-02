-- Records what each fill did to the cash balance.
--
-- Nullable rather than defaulted to zero: rows written before this column
-- existed have no recorded movement, and zero would be a wrong number that
-- looks like a real one. NULL says "unknown", which is the truth.
ALTER TABLE "transactions" ADD COLUMN "cash_delta" DECIMAL(24,8);
ALTER TABLE "transactions" ADD COLUMN "balance_after" DECIMAL(24,8);
