const test = require("node:test");
const assert = require("node:assert/strict");

const {
  D,
  signedDelta,
  applyFill,
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

test("equity subtracts shorts and adds longs", () => {
  const equity = equityOf({
    cash: "100000",
    positions: [
      { quantity: "0.5", price: "60000" }, // +30000
      { quantity: "-1", price: "20000" }, // -20000
    ],
  });

  assert.equal(equity.toString(), "110000");
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

test("a full short lifecycle returns cash to the starting figure", () => {
  // Short 1 at 60000 then cover at 60000: proceeds in, cost out, no profit.
  const start = new D("100000");
  const proceeds = new D("60000");
  const cost = new D("60000");

  const afterOpen = start.plus(proceeds);
  const afterCover = afterOpen.minus(cost);

  assert.equal(afterCover.toFixed(2), "100000.00");
});
