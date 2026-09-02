const test = require("node:test");
const assert = require("node:assert/strict");

const { startDatabase, loadEngine, seedAccount } = require("./harness");

/**
 * The guarantees that cannot be unit-tested.
 *
 * Whether two simultaneous orders can spend the same balance is a property of
 * `SELECT ... FOR UPDATE` under READ COMMITTED, not of any function in this
 * repository — so it is proved here, against a real Postgres, with genuinely
 * concurrent connections. A stub would only ever prove that the stub blocks.
 *
 * Every price is fixed at 100 so the arithmetic stays legible: an order for a
 * quantity of 70 costs 7000.
 */

const PRICE = 100;

let db;
let orders;
let prisma;

test.before(async () => {
  db = await startDatabase();
  ({ orders, prisma } = loadEngine({ price: PRICE }));
});

test.after(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

/** Fires every order at once and reports which survived. */
async function raceOrders(userId, placements) {
  const settled = await Promise.allSettled(
    placements.map((placement) => orders.placeOrder({ userId, ...placement })),
  );

  return {
    filled: settled.filter((r) => r.status === "fulfilled").map((r) => r.value),
    refused: settled.filter((r) => r.status === "rejected").map((r) => r.reason),
  };
}

const balanceOf = async (userId) =>
  Number((await prisma.wallet.findUnique({ where: { userId } })).balance);

test("two simultaneous buys cannot both spend the same balance", async () => {
  // The case from the brief: 10000 in cash, two 7000 orders at the same
  // instant. Without the row lock both read 10000, both decide they can
  // afford it, and the second UPDATE overwrites the first — 14000 spent
  // against a balance that still reads 3000.
  const userId = await seedAccount(prisma, { balance: "10000" });

  const { filled, refused } = await raceOrders(userId, [
    { symbol: "BTCUSDT", side: "BUY", quantity: "70" },
    { symbol: "BTCUSDT", side: "BUY", quantity: "70" },
  ]);

  assert.equal(filled.length, 1, "exactly one order may fill");
  assert.equal(refused.length, 1, "the other must be refused");
  assert.match(refused[0].message, /Insufficient balance/);

  assert.equal(await balanceOf(userId), 3000, "the balance reflects one fill, not two");

  const rows = await prisma.order.findMany({ where: { userId } });
  assert.equal(rows.length, 1, "a refused order writes no row");
});

test("a refused order leaves no holding behind", async () => {
  const userId = await seedAccount(prisma, { balance: "1000" });

  await assert.rejects(
    orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "70" }),
    /Insufficient balance\. You need 7000\.00 but only 1000\.00 is available\./,
  );

  assert.equal(await balanceOf(userId), 1000);
  assert.equal(await prisma.portfolio.count({ where: { userId } }), 0);
  assert.equal(await prisma.order.count({ where: { userId } }), 0);
});

test("a flood of concurrent buys stops exactly at the balance", async () => {
  // Ten orders of 1500 fired together against 10000. Six fit; the rest must
  // be refused, and the balance must land on exactly 1000 — no drift from
  // interleaved reads.
  const userId = await seedAccount(prisma, { balance: "10000" });

  const { filled, refused } = await raceOrders(
    userId,
    Array.from({ length: 10 }, () => ({
      symbol: "ETHUSDT",
      side: "BUY",
      quantity: "15",
    })),
  );

  assert.equal(filled.length, 6, "6 x 1500 = 9000 fits inside 10000");
  assert.equal(refused.length, 4);
  assert.equal(await balanceOf(userId), 1000);

  const position = await prisma.portfolio.findFirst({ where: { userId, symbol: "ETHUSDT" } });
  assert.equal(Number(position.quantity), 90, "six fills of 15");
});

test("the same idempotency key sent twice concurrently fills once", async () => {
  // A double-click: two requests in flight together carrying one key. The
  // first fills; the second blocks on the account lock, finds the committed
  // order once it gets in, and returns that instead of placing a second.
  const userId = await seedAccount(prisma, { balance: "10000" });
  const idempotencyKey = crypto.randomUUID();

  const { filled, refused } = await raceOrders(userId, [
    { symbol: "BTCUSDT", side: "BUY", quantity: "10", idempotencyKey },
    { symbol: "BTCUSDT", side: "BUY", quantity: "10", idempotencyKey },
  ]);

  assert.equal(refused.length, 0, "a replay is not an error");
  assert.equal(filled.length, 2, "both requests get an answer");
  assert.equal(filled[0].order.id, filled[1].order.id, "and it is the same order");
  assert.ok(
    filled.some((result) => result.replayed),
    "one of them is marked as a replay",
  );

  assert.equal(await prisma.order.count({ where: { userId } }), 1, "one order row");
  assert.equal(await balanceOf(userId), 9000, "charged once, not twice");
});

test("different keys are different orders", async () => {
  // The other half of the guarantee: idempotency must not collapse two orders
  // the user genuinely meant to place.
  const userId = await seedAccount(prisma, { balance: "10000" });

  await orders.placeOrder({
    userId, symbol: "BTCUSDT", side: "BUY", quantity: "10",
    idempotencyKey: crypto.randomUUID(),
  });
  await orders.placeOrder({
    userId, symbol: "BTCUSDT", side: "BUY", quantity: "10",
    idempotencyKey: crypto.randomUUID(),
  });

  assert.equal(await prisma.order.count({ where: { userId } }), 2);
  assert.equal(await balanceOf(userId), 8000);
});

test("concurrent orders keep the wallet and the holding consistent", async () => {
  // The invariant the transaction exists for: whatever interleaving happens,
  // cash spent and quantity held must still agree at the end.
  const userId = await seedAccount(prisma, { balance: "10000" });

  const { filled } = await raceOrders(
    userId,
    Array.from({ length: 8 }, () => ({
      symbol: "SOLUSDT",
      side: "BUY",
      quantity: "5", // 500 each
    })),
  );

  const balance = await balanceOf(userId);
  const position = await prisma.portfolio.findFirst({ where: { userId, symbol: "SOLUSDT" } });

  assert.equal(10000 - balance, filled.length * 500, "cash spent matches fills");
  assert.equal(Number(position.quantity), filled.length * 5, "quantity matches fills");
});
