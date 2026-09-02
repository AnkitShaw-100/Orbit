const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");

const { startDatabase, loadEngine, seedAccount } = require("./harness");

/**
 * Proof that the lock itself does what the order engine depends on.
 *
 * The application-level tests next door place real orders and hope the two
 * transactions overlap. That is worth having, but it is not proof: with only a
 * couple of requests Node may well finish one transaction before the other
 * begins, and the test then passes whether or not the lock is there — as it
 * does, verifiably, when `lockAccount` is commented out.
 *
 * So the mechanism is tested directly, on two connections held open by hand,
 * where the interleaving is dictated rather than hoped for. This fails the
 * moment `FOR UPDATE` is dropped, which is the only thing that makes it worth
 * running.
 */

let db;
let prisma;
let userId;

test.before(async () => {
  db = await startDatabase();
  ({ prisma } = loadEngine({ price: 100 }));
  userId = await seedAccount(prisma, { balance: "10000" });
});

test.after(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

/** A connection of our own, outside Prisma's pool, with a transaction open. */
async function openTransaction() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  return client;
}

/** Resolves to true if `promise` is still pending after `ms`. */
function stillPending(promise, ms) {
  const marker = Symbol("pending");
  return Promise.race([
    promise.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(marker), ms)),
  ]).then((result) => result === marker);
}

test("FOR UPDATE blocks a second transaction until the first commits", async () => {
  const first = await openTransaction();
  const second = await openTransaction();

  try {
    // The first transaction takes the wallet row.
    await first.query("SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE", [userId]);

    // The second asks for the same row and must wait — this is the whole
    // guarantee. Nothing is awaited yet; the query is left in flight.
    const blocked = second.query("SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE", [
      userId,
    ]);

    assert.equal(
      await stillPending(blocked, 400),
      true,
      "the second transaction must not get the row while the first holds it",
    );

    // Releasing the first lets the second through.
    await first.query("COMMIT");

    const rows = await blocked;
    assert.equal(rows.rowCount, 1, "and it proceeds once the lock is released");
  } finally {
    await second.query("ROLLBACK").catch(() => {});
    await first.end();
    await second.end();
  }
});

test("without FOR UPDATE the same read does not block at all", async () => {
  // The contrast that gives the test above its meaning: a plain SELECT under
  // READ COMMITTED sails straight past a held row lock and returns the old
  // value. That is exactly the read that caused the lost update.
  const first = await openTransaction();
  const second = await openTransaction();

  try {
    await first.query("SELECT id FROM wallets WHERE user_id = $1 FOR UPDATE", [userId]);

    const unblocked = second.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);

    assert.equal(
      await stillPending(unblocked, 400),
      false,
      "an unlocked read is never held up — which is why it is unsafe here",
    );

    const { rows } = await unblocked;
    assert.equal(Number(rows[0].balance), 10000, "and it reads the pre-transaction value");
  } finally {
    await first.query("ROLLBACK").catch(() => {});
    await second.query("ROLLBACK").catch(() => {});
    await first.end();
    await second.end();
  }
});

test("a write behind a held lock waits for the holder", async () => {
  // The lost update in miniature: two transactions that both read, then both
  // write. Postgres serialises the writes, so the second silently overwrites
  // the first — 14000 spent, a balance that says 3000. The row lock exists to
  // stop the second one reading stale in the first place.
  const first = await openTransaction();
  const second = await openTransaction();

  try {
    const before = await first.query("SELECT balance FROM wallets WHERE user_id = $1", [userId]);
    const alsoBefore = await second.query("SELECT balance FROM wallets WHERE user_id = $1", [
      userId,
    ]);

    assert.equal(
      Number(before.rows[0].balance),
      Number(alsoBefore.rows[0].balance),
      "both transactions read the same starting balance — the setup for the bug",
    );

    await first.query("UPDATE wallets SET balance = balance - 7000 WHERE user_id = $1", [userId]);

    const secondWrite = second.query(
      "UPDATE wallets SET balance = $2 WHERE user_id = $1",
      [userId, "3000"],
    );

    assert.equal(
      await stillPending(secondWrite, 400),
      true,
      "the write blocks, but only after the damage was decided",
    );

    await first.query("ROLLBACK");
    await secondWrite;
  } finally {
    await second.query("ROLLBACK").catch(() => {});
    await first.end();
    await second.end();
  }
});
