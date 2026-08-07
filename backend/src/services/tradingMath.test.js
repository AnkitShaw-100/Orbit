const test = require("node:test");
const assert = require("node:assert/strict");

const { D, orderTotal, assertQuantity } = require("./tradingMath");

/**
 * The arithmetic every balance on the platform depends on. A rounding error
 * here compounds silently over an account's life, so these assert exact
 * decimal strings rather than approximate equality.
 *
 * Position lifecycle and margin live in shorting.test.js.
 */

test("orderTotal multiplies without floating point drift", () => {
  // 0.1 * 3 is 0.30000000000000004 in binary floating point.
  assert.equal(orderTotal("0.1", "3").toString(), "0.3");
  assert.equal(orderTotal("64634.01", "0.05").toString(), "3231.7005");
});

test("a round trip returns the exact starting cash", () => {
  const price = "64634.01";
  const quantity = "0.1";
  const start = new D("100000.00");

  const afterBuy = start.minus(orderTotal(price, quantity));
  const afterSell = afterBuy.plus(orderTotal(price, quantity));

  // The property that matters: buy then sell at the same price lands on the
  // starting figure to the cent, not 99999.99999997.
  assert.equal(afterSell.toFixed(2), "100000.00");
  assert.ok(afterSell.equals(start));
});

test("assertQuantity rejects zero, negatives and nonsense", () => {
  assert.throws(() => assertQuantity("0"), /greater than zero/);
  assert.throws(() => assertQuantity("-1"), /greater than zero/);
  assert.throws(() => assertQuantity("abc"), /number greater than zero/);
  assert.throws(() => assertQuantity(undefined), /greater than zero/);
  assert.equal(assertQuantity("0.5").toString(), "0.5");
});
