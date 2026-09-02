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

test("deleting refuses when no service role key is configured", async () => {
  // The harness clears the key, so this is the state a deployment that never
  // set one is in.
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

/**
 * Runs `body` as though a service role key were configured, with `fetch`
 * replaced so no request leaves the machine. The env module is a plain object
 * read at call time, so this is a temporary field rather than a reload.
 */
async function withServiceKey(respond, body) {
  const env = require("../../src/config/env");
  const realFetch = global.fetch;
  const calls = [];

  env.supabaseServiceRoleKey = "test-service-role-key";
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return respond();
  };

  try {
    return await body(calls);
  } finally {
    global.fetch = realFetch;
    env.supabaseServiceRoleKey = null;
  }
}

test("deleting removes every row the account owned, then deletes the login", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });
  await orders.placeOrder({ userId, symbol: "BTCUSDT", side: "BUY", quantity: "2" });

  await withServiceKey(
    () => new Response(null, { status: 200 }),
    async (calls) => {
      await account.deleteAccount(userId);

      assert.equal(calls.length, 1);
      assert.match(calls[0].url, new RegExp(`/auth/v1/admin/users/${userId}$`));
      assert.equal(calls[0].options.method, "DELETE");
      assert.equal(
        calls[0].options.headers.authorization,
        "Bearer test-service-role-key",
      );
    },
  );

  assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
  assert.equal(await prisma.wallet.count({ where: { userId } }), 0);
  assert.deepEqual(await countsFor(userId), { positions: 0, orders: 0, transactions: 0 });
});

test("a login that is already gone counts as deleted", async () => {
  // Supabase answers 404 for a user that no longer exists, which is the state
  // being asked for — a retry after a half-finished delete must not be stuck.
  const userId = await seedAccount(prisma, { balance: "100000" });

  await withServiceKey(
    () => new Response(null, { status: 404 }),
    () => account.deleteAccount(userId),
  );

  assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
});

test("when Supabase refuses, the caller is told the data is already gone", async () => {
  const userId = await seedAccount(prisma, { balance: "100000" });

  await withServiceKey(
    () => new Response("nope", { status: 500 }),
    async () => {
      await assert.rejects(() => account.deleteAccount(userId), (error) => {
        assert.equal(error.status, 502);
        // The message has to admit the halves came apart, since the rows are
        // gone and the login is not. Claiming success would be a lie and
        // claiming failure would imply the data survived.
        assert.match(error.message, /deleted/i);
        return true;
      });
    },
  );

  assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
});
