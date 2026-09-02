const test = require("node:test");
const assert = require("node:assert/strict");

const {
  D,
  signedDelta,
  applyFill,
  cashDelta,
  isFlat,
  equityOf,
  shortNotionalOf,
  assertMargin,
  needsLiquidation,
} = require("./tradingMath");

/**
 * Shorting inverts the sign of everything, which is exactly the kind of change
 * that produces plausible-looking but wrong numbers. Each case below is a
 * position lifecycle stated in full.
 */

test("signedDelta makes sells negative", () => {
  assert.equal(signedDelta("BUY", "0.5").toString(), "0.5");
  assert.equal(signedDelta("SELL", "0.5").toString(), "-0.5");
});

test("selling with nothing held opens a short", () => {
  const result = applyFill({
    heldQuantity: 0,
    heldAverage: 0,
    delta: signedDelta("SELL", "0.5"),
    price: "60000",
  });

  assert.equal(result.quantity.toString(), "-0.5");
  assert.equal(result.averagePrice.toString(), "60000");
  assert.equal(result.realizedPnl.toString(), "0");
});

test("a short profits when price falls", () => {
  // Short 0.5 at 60000, buy back at 50000 -> 10000 x 0.5 = 5000 profit.
  const result = applyFill({
    heldQuantity: "-0.5",
    heldAverage: "60000",
    delta: signedDelta("BUY", "0.5"),
    price: "50000",
  });

  assert.equal(result.quantity.toString(), "0");
  assert.equal(result.realizedPnl.toString(), "5000");
});

test("a short loses when price rises", () => {
  const result = applyFill({
    heldQuantity: "-0.5",
    heldAverage: "60000",
    delta: signedDelta("BUY", "0.5"),
    price: "64000",
  });

  assert.equal(result.realizedPnl.toString(), "-2000");
});

test("adding to a short averages the entry", () => {
  // Short 1 at 60000, short 1 more at 70000 -> average entry 65000.
  const result = applyFill({
    heldQuantity: "-1",
    heldAverage: "60000",
    delta: signedDelta("SELL", "1"),
    price: "70000",
  });

  assert.equal(result.quantity.toString(), "-2");
  assert.equal(result.averagePrice.toString(), "65000");
  assert.equal(result.realizedPnl.toString(), "0");
});

test("partially covering a short leaves the entry untouched", () => {
  const result = applyFill({
    heldQuantity: "-2",
    heldAverage: "65000",
    delta: signedDelta("BUY", "0.5"),
    price: "60000",
  });

  assert.equal(result.quantity.toString(), "-1.5");
  // Only the covered half books profit; the rest keeps its original entry.
  assert.equal(result.averagePrice.toString(), "65000");
  assert.equal(result.realizedPnl.toString(), "2500");
});

test("selling through a long flips it into a short", () => {
  // Hold 1 at 50000, sell 3 at 60000: closes the long for 10000 profit and
  // opens a 2-unit short at 60000.
  const result = applyFill({
    heldQuantity: "1",
    heldAverage: "50000",
    delta: signedDelta("SELL", "3"),
    price: "60000",
  });

  assert.equal(result.quantity.toString(), "-2");
  assert.equal(result.averagePrice.toString(), "60000");
  assert.equal(result.realizedPnl.toString(), "10000");
});

test("buying through a short flips it into a long", () => {
  const result = applyFill({
    heldQuantity: "-1",
    heldAverage: "60000",
    delta: signedDelta("BUY", "3"),
    price: "50000",
  });

  assert.equal(result.quantity.toString(), "2");
  assert.equal(result.averagePrice.toString(), "50000");
  assert.equal(result.realizedPnl.toString(), "10000");
});

test("a long still behaves exactly as before", () => {
  const opened = applyFill({
    heldQuantity: 0,
    heldAverage: 0,
    delta: signedDelta("BUY", "0.1"),
    price: "60000",
  });
  assert.equal(opened.quantity.toString(), "0.1");

  const closed = applyFill({
    heldQuantity: "0.1",
    heldAverage: "60000",
    delta: signedDelta("SELL", "0.1"),
    price: "64000",
  });
  assert.equal(closed.realizedPnl.toString(), "400");
  assert.equal(isFlat(closed.quantity), true);
});

test("equity counts longs at market and shorts at their P&L", () => {
  const equity = equityOf({
    cash: "100000",
    positions: [
      // Bought with cash, so worth what the market pays.
      { quantity: "0.5", averagePrice: "40000", price: "60000" }, // +30000
      // Shorted at 25000, now 20000 — the proceeds were never credited, so all
      // this contributes is the 5000 it has made.
      { quantity: "-1", averagePrice: "25000", price: "20000" }, // +5000
    ],
  });

  assert.equal(equity.toString(), "135000");
});

test("an untouched short is worth nothing to equity", () => {
  // Shorting must not move the account's worth on its own.
  const equity = equityOf({
    cash: "100000",
    positions: [{ quantity: "-1", averagePrice: "10000", price: "10000" }],
  });

  assert.equal(equity.toString(), "100000");
});

test("shortNotional counts only shorts, at market", () => {
  const notional = shortNotionalOf([
    { quantity: "0.5", price: "60000" },
    { quantity: "-1", price: "20000" },
    { quantity: "-2", price: "1000" },
  ]);

  assert.equal(notional.toString(), "22000");
});

test("margin allows 1x and refuses beyond it", () => {
  assert.doesNotThrow(() =>
    assertMargin({ cash: "100000", equity: "100000", shortNotional: "100000" }),
  );

  assert.throws(
    () => assertMargin({ cash: "100000", equity: "100000", shortNotional: "100000.01" }),
    /no leverage/,
  );
});

test("margin refuses cash going negative", () => {
  assert.throws(
    () => assertMargin({ cash: "-250", equity: "50000", shortNotional: "0" }),
    /250.00 more than you have in cash/,
  );
});

test("liquidation triggers below a quarter of exposure", () => {
  // 100000 of shorts needs 25000 of equity to survive.
  assert.equal(needsLiquidation({ equity: "25000", shortNotional: "100000" }), false);
  assert.equal(needsLiquidation({ equity: "24999", shortNotional: "100000" }), true);

  // No shorts, nothing to liquidate, however low equity goes.
  assert.equal(needsLiquidation({ equity: "1", shortNotional: "0" }), false);
});

/* ------------------------------------------------------------------- cash */

/** One fill against a position, returning the resulting balance. */
function fill({ cash, heldQuantity, heldAverage, side, quantity, price }) {
  const delta = signedDelta(side, quantity);
  const result = applyFill({ heldQuantity, heldAverage, delta, price });
  const balance = new D(cash).plus(
    cashDelta({ heldQuantity, delta, price, realizedPnl: result.realizedPnl }),
  );
  return { ...result, balance };
}

test("opening a short leaves the balance where it was", () => {
  // The proceeds are owed back, not earned, so they are not spendable cash.
  const after = fill({
    cash: "100000",
    heldQuantity: 0,
    heldAverage: 0,
    side: "SELL",
    quantity: "1",
    price: "10000",
  });

  assert.equal(after.balance.toFixed(2), "100000.00");
  assert.equal(after.quantity.toString(), "-1");
});

test("covering a short applies only its profit or loss", () => {
  const won = fill({
    cash: "100000",
    heldQuantity: "-1",
    heldAverage: "10000",
    side: "BUY",
    quantity: "1",
    price: "8000",
  });
  assert.equal(won.balance.toFixed(2), "102000.00");

  const lost = fill({
    cash: "100000",
    heldQuantity: "-1",
    heldAverage: "10000",
    side: "BUY",
    quantity: "1",
    price: "12000",
  });
  assert.equal(lost.balance.toFixed(2), "98000.00");
});

test("a short round trip at the same price is a no-op on cash", () => {
  const opened = fill({
    cash: "100000",
    heldQuantity: 0,
    heldAverage: 0,
    side: "SELL",
    quantity: "1",
    price: "60000",
  });
  const covered = fill({
    cash: opened.balance,
    heldQuantity: opened.quantity,
    heldAverage: opened.averagePrice,
    side: "BUY",
    quantity: "1",
    price: "60000",
  });

  assert.equal(covered.balance.toFixed(2), "100000.00");
});

test("a partial cover books only the closed portion", () => {
  const after = fill({
    cash: "100000",
    heldQuantity: "-2",
    heldAverage: "65000",
    side: "BUY",
    quantity: "0.5",
    price: "60000",
  });

  assert.equal(after.balance.toFixed(2), "102500.00");
});

test("longs still pay out and cost in full", () => {
  const bought = fill({
    cash: "100000",
    heldQuantity: 0,
    heldAverage: 0,
    side: "BUY",
    quantity: "1",
    price: "60000",
  });
  assert.equal(bought.balance.toFixed(2), "40000.00");

  const sold = fill({
    cash: bought.balance,
    heldQuantity: bought.quantity,
    heldAverage: bought.averagePrice,
    side: "SELL",
    quantity: "1",
    price: "64000",
  });
  assert.equal(sold.balance.toFixed(2), "104000.00");
});

test("flipping a long into a short pays for the long only", () => {
  // Hold 1 at 50000, sell 3 at 60000: 60000 comes back for the holding, and
  // the 2-unit short that opens brings in nothing.
  const after = fill({
    cash: "10000",
    heldQuantity: "1",
    heldAverage: "50000",
    side: "SELL",
    quantity: "3",
    price: "60000",
  });

  assert.equal(after.quantity.toString(), "-2");
  assert.equal(after.balance.toFixed(2), "70000.00");
});

test("flipping a short into a long books the cover and buys the rest", () => {
  // Short 1 at 60000, buy 3 at 50000: 10000 profit on the cover, then 2 units
  // bought at 50000.
  const after = fill({
    cash: "150000",
    heldQuantity: "-1",
    heldAverage: "60000",
    side: "BUY",
    quantity: "3",
    price: "50000",
  });

  assert.equal(after.quantity.toString(), "2");
  assert.equal(after.balance.toFixed(2), "60000.00");
});
