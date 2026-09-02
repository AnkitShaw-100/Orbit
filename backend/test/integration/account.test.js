const test = require("node:test");
const assert = require("node:assert/strict");

const { startDatabase, loadEngine, seedAccount } = require("./harness");

/**
 * Resetting an account, against a real database.
 *
 * A reset is only correct if it leaves nothing behind: a stray position or an
 * order row would show up on the dashboard of an account that is supposed to be
 * brand new, and the balance would no longer explain the holdings. Prisma's
 * cascades and the deletion order are properties of the schema, so proving them
 * means running the statements rather than reasoning about them.
 *
 * Every price is fixed at 100, so an order for a quantity of 5 costs 500.
 */

const PRICE = 100;

let db;
let orders;
let account;
let prisma;

test.before(async () => {
  db = await startDatabase();
  ({ orders, prisma } = loadEngine({ price: PRICE }));
  // Required after loadEngine, so it picks up the stubbed market feed through
  // its own dependency on order.service.
  account = require("../../src/services/account.service");
});

test.after(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

const countsFor = async (userId) => ({
  positions: await prisma.portfolio.count({ where: { userId } }),
  orders: await prisma.order.count({ where: { userId } }),
  transactions: await prisma.transaction.count({ where: { userId } }),
});

test("a reset returns the balance to exactly the starting cash", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });

  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "5" });

  const spent = await prisma.wallet.findUnique({ where: { userId } });
  assert.equal(spent.balance.toFixed(2), "99500.00", "the trade should have cost 500");

  const result = await account.resetAccount(userId);

  assert.equal(result.balance, "100000.00");

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  assert.equal(wallet.balance.toFixed(2), "100000.00");
});

test("a reset leaves no positions, orders or transactions behind", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });

  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "3" });
  await orders.placeOrder({ userId, symbol: "ETHUSDT", side: "SELL", quantity: "2" });
  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "SELL", quantity: "1" });

  const before = await countsFor(userId);
  assert.equal(before.orders, 3);
  assert.ok(before.positions > 0);
  assert.ok(before.transactions > 0);

  await account.resetAccount(userId);

  assert.deepEqual(await countsFor(userId), { positions: 0, orders: 0, transactions: 0 });
});

test("a reset touches only the account it was asked about", async () => {
  const mine = await seedAccount(prisma, { balance: "100000" });
  const theirs = await seedAccount(prisma, { balance: "100000" });

  await orders.placeOrder({ userId: mine, symbol: "BTCUSDT", side: "BUY", quantity: "4" });
  await orders.placeOrder({ userId: theirs, symbol: "BTCUSDT", side: "BUY", quantity: "4" });

  await account.resetAccount(mine);

  const untouched = await prisma.wallet.findUnique({ where: { userId: theirs } });
  assert.equal(untouched.balance.toFixed(2), "99600.00");
  assert.deepEqual(await countsFor(theirs), { positions: 1, orders: 1, transactions: 1 });
});

test("the same account can be traded again immediately after a reset", async () => {
  // A reset that left the wallet locked, or the row deleted rather than
  // updated, would only show up on the next order.
  const userId = await seedAccount(prisma, { balance: "100000" });

  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "2" });
  await account.resetAccount(userId);
  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "2" });

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  assert.equal(wallet.balance.toFixed(2), "99800.00");
});

test("deleting an account removes every row it owned", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });
  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "2" });

  // The service refuses without a service role key, since it could not finish
  // the job — so this covers the database half directly. The Supabase call is
  // exercised separately, against Supabase.
  await prisma.user.delete({ where: { id: userId } });

  assert.equal(await prisma.wallet.count({ where: { userId } }), 0);
  assert.deepEqual(await countsFor(userId), { positions: 0, orders: 0, transactions: 0 });
});

test("deleting refuses when no service role key is configured", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });

  await assert.rejects(() => account.deleteAccount(userId), (error) => {
    assert.equal(error.status, 503);
    return true;
  });

  // The refusal has to come before anything is deleted, or a misconfigured
  // deployment would wipe the data and then report that it could not.
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  assert.equal(wallet.balance.toFixed(2), "100000.00");
});
