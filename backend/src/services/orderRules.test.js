const test = require("node:test");
const assert = require("node:assert/strict");

const {
  D,
  signedDelta,
  applyFill,
  cashDelta,
  isFlat,
  assertSufficientCash,
  assertMargin,
  equityOf,
  shortNotionalOf,
} = require("./tradingMath");

/**
 * The BUY and SELL cases stated as account lifecycles rather than as single
 * calls — a fill is only correct in the context of the position it lands on,
 * and every bug worth catching here is a bug about that pairing.
 *
 * The engine itself is tested through these pure functions because placeOrder
 * needs a live Postgres; what it adds on top is the transaction and the row
 * lock, neither of which has arithmetic to get wrong.
 */

/** One fill applied to an account, returning the account after it. */
function fill(account, { side, quantity, price }) {
  const delta = signedDelta(side, quantity);
  const held = account.positions[account.symbol] ?? { quantity: 0, averagePrice: 0 };

  const result = applyFill({
    heldQuantity: held.quantity,
    heldAverage: held.averagePrice,
    delta,
    price,
  });

  const movement = cashDelta({
    heldQuantity: held.quantity,
    delta,
    price,
    realizedPnl: result.realizedPnl,
  });

  // The order the engine checks in: refuse before anything is written.
  assertSufficientCash({ balance: account.cash, delta: movement });

  const positions = { ...account.positions };
  if (isFlat(result.quantity)) delete positions[account.symbol];
  else positions[account.symbol] = { quantity: result.quantity, averagePrice: result.averagePrice };

  return {
    ...account,
    cash: new D(account.cash).plus(movement),
    positions,
    realizedPnl: result.realizedPnl,
  };
}

/** An account with 10000 in cash and 50 shares at 100, as in the brief. */
const seeded = () => ({
  symbol: "AAPL",
  cash: new D("10000"),
  positions: { AAPL: { quantity: new D("50"), averagePrice: new D("100") } },
});

const flat = (cash = "10000") => ({ symbol: "AAPL", cash: new D(cash), positions: {} });

/* ------------------------------------------------------------------- buy */

test("BUY with sufficient balance fills and moves cash and holdings", () => {
  const after = fill(flat(), { side: "BUY", quantity: "20", price: "100" });

  assert.equal(after.cash.toFixed(2), "8000.00");
  assert.equal(after.positions.AAPL.quantity.toString(), "20");
  assert.equal(after.positions.AAPL.averagePrice.toString(), "100");
});

test("BUY with insufficient balance is refused, naming both figures", () => {
  const account = flat("1000");

  assert.throws(
    () => fill(account, { side: "BUY", quantity: "20", price: "100" }),
    /Insufficient balance\. You need 2000\.00 but only 1000\.00 is available\./,
  );

  // Nothing moved: the throw happens before a single write.
  assert.equal(account.cash.toFixed(2), "1000.00");
  assert.deepEqual(account.positions, {});
});

test("a refused BUY leaves an existing holding untouched", () => {
  const account = seeded();
  account.cash = new D("50");

  assert.throws(() => fill(account, { side: "BUY", quantity: "10", price: "100" }));
  assert.equal(account.positions.AAPL.quantity.toString(), "50");
  assert.equal(account.cash.toFixed(2), "50.00");
});

test("BUY spending the balance to the last cent is allowed", () => {
  const after = fill(flat("2000"), { side: "BUY", quantity: "20", price: "100" });
  assert.equal(after.cash.toFixed(2), "0.00");
});

/* ------------------------------------------------------------------ sell */

test("SELL with sufficient holdings pays out and reduces the position", () => {
  const after = fill(seeded(), { side: "SELL", quantity: "20", price: "120" });

  assert.equal(after.cash.toFixed(2), "12400.00");
  assert.equal(after.positions.AAPL.quantity.toString(), "30");
  // The entry survives a partial sale; only the sold portion books profit.
  assert.equal(after.positions.AAPL.averagePrice.toString(), "100");
  assert.equal(after.realizedPnl.toString(), "400");
});

test("SELL of the whole holding closes the position", () => {
  const after = fill(seeded(), { side: "SELL", quantity: "50", price: "120" });

  assert.equal(after.cash.toFixed(2), "16000.00");
  assert.equal(after.positions.AAPL, undefined);
});

/* --------------------------------------------------------- the sequences */

test("SELL then BUY is two independent trades", () => {
  // The brief's example: 10000 cash, 50 AAPL. Sell all 50, then buy 20 back.
  const sold = fill(seeded(), { side: "SELL", quantity: "50", price: "120" });

  assert.equal(sold.cash.toFixed(2), "16000.00");
  assert.equal(sold.positions.AAPL, undefined);

  const bought = fill(sold, { side: "BUY", quantity: "20", price: "110" });

  // A brand new long at the new price — nothing about it references the sale.
  assert.equal(bought.positions.AAPL.quantity.toString(), "20");
  assert.equal(bought.positions.AAPL.averagePrice.toString(), "110");
  assert.equal(bought.cash.toFixed(2), "13800.00");
  assert.equal(bought.realizedPnl.toString(), "0");
});

test("BUY then SELL returns the cash it spent, plus the move", () => {
  const bought = fill(flat(), { side: "BUY", quantity: "20", price: "100" });
  const sold = fill(bought, { side: "SELL", quantity: "20", price: "150" });

  assert.equal(sold.cash.toFixed(2), "11000.00");
  assert.equal(sold.positions.AAPL, undefined);
  assert.equal(sold.realizedPnl.toString(), "1000");
});

test("buying the same symbol twice averages the entry rather than replacing it", () => {
  const first = fill(flat("30000"), { side: "BUY", quantity: "10", price: "100" });
  const second = fill(first, { side: "BUY", quantity: "10", price: "200" });

  assert.equal(second.positions.AAPL.quantity.toString(), "20");
  assert.equal(second.positions.AAPL.averagePrice.toString(), "150");
  assert.equal(second.cash.toFixed(2), "27000.00");
});

/* ------------------------------------------------- balance is the ceiling */

test("two orders cannot both spend the same balance", () => {
  // What the wallet's row lock enforces: the second order is priced against
  // the balance the first one left, not the one it started from.
  const start = flat("10000");
  const first = fill(start, { side: "BUY", quantity: "70", price: "100" });

  assert.equal(first.cash.toFixed(2), "3000.00");

  assert.throws(
    () => fill(first, { side: "BUY", quantity: "70", price: "100" }),
    /You need 7000\.00 but only 3000\.00 is available/,
  );
});

test("cash never goes negative, whatever the fill", () => {
  // The invariant behind the message, checked after the fill rather than before.
  assert.throws(
    () => assertMargin({ cash: "-0.01", equity: "50000", shortNotional: "0" }),
    /more than you have in cash/,
  );

  assert.doesNotThrow(() =>
    assertMargin({ cash: "0", equity: "50000", shortNotional: "0" }),
  );
});

test("a long-only account is never at risk of liquidation", () => {
  // No shorts means no exposure to maintain, so margin has nothing to say.
  const positions = [{ quantity: "20", averagePrice: "100", price: "1" }];

  assert.equal(shortNotionalOf(positions).toString(), "0");
  assert.doesNotThrow(() =>
    assertMargin({
      cash: "0",
      equity: equityOf({ cash: "0", positions }),
      shortNotional: shortNotionalOf(positions),
    }),
  );
});

/* ------------------------------------------------------- forced liquidation */

/**
 * The clamp placeOrder applies to a forced close, stated here as the arithmetic
 * it comes down to: a liquidation is sized from a snapshot the sweep took
 * before it held the account lock, so the locked read has to be able to shrink
 * it — or refuse it outright.
 */
function clampToShort(requested, heldQuantity) {
  const held = new D(heldQuantity);
  const fill = D.min(new D(requested), held.abs());
  if (!held.isNegative() || isFlat(fill)) return null;
  return fill;
}

test("a liquidation never buys back more than is actually short", () => {
  // The sweep saw 2 short; by the time the lock was taken only 0.5 remained.
  assert.equal(clampToShort("2", "-0.5").toString(), "0.5");
});

test("a liquidation is skipped when the short is already covered", () => {
  // The user closed it themselves between the sweep's read and this fill.
  assert.equal(clampToShort("2", "0"), null);
});

test("a liquidation never touches a long", () => {
  // Buying against a long would add to it — and liquidation skips the cash
  // check, so it could overdraw the account outright.
  assert.equal(clampToShort("2", "5"), null);
});

test("an unclamped liquidation would have opened a long", () => {
  // What the clamp prevents: the stale size landing on a flat position.
  const stale = applyFill({
    heldQuantity: 0,
    heldAverage: 0,
    delta: signedDelta("BUY", "2"),
    price: "60000",
  });

  assert.equal(stale.quantity.toString(), "2");
  // And it would have cost 120000 with no cash check in the way.
  assert.equal(
    cashDelta({
      heldQuantity: 0,
      delta: signedDelta("BUY", "2"),
      price: "60000",
      realizedPnl: stale.realizedPnl,
    }).toString(),
    "-120000",
  );
});

/* --------------------------------------------------------------- the ledger */

test("summing the recorded cash movements reproduces the balance", () => {
  // What cashDelta and balanceAfter on each transaction are for: the balance is
  // auditable from history rather than trusted as a mutable column.
  const fills = [
    { side: "BUY", quantity: "20", price: "100" },
    { side: "SELL", quantity: "20", price: "150" },
    { side: "SELL", quantity: "1", price: "5000" }, // opens a short: no movement
    { side: "BUY", quantity: "1", price: "4000" }, // covers it: books 1000
  ];

  let account = flat("10000");
  const ledger = [];

  for (const order of fills) {
    const before = account.cash;
    account = fill(account, order);
    ledger.push({
      cashDelta: account.cash.minus(before),
      balanceAfter: account.cash,
    });
  }

  const replayed = ledger.reduce((sum, row) => sum.plus(row.cashDelta), new D("10000"));

  assert.equal(replayed.toFixed(2), account.cash.toFixed(2));
  assert.equal(replayed.toFixed(2), "12000.00");
  // Each row also stands alone, so a divergence is found without a full replay.
  assert.equal(ledger.at(-1).balanceAfter.toFixed(2), "12000.00");
  // The short leg moved nothing on open and 1000 on close.
  assert.equal(ledger[2].cashDelta.toFixed(2), "0.00");
  assert.equal(ledger[3].cashDelta.toFixed(2), "1000.00");
});
