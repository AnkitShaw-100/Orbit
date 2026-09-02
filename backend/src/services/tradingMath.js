const { Prisma } = require("@prisma/client");
const ApiError = require("../utils/ApiError");

const D = Prisma.Decimal;
const ZERO = new D(0);

// Quantities are DECIMAL(24,8); anything below this rounds away to nothing, so
// a remainder smaller than it means the position is closed rather than dust.
const DUST = new D("0.00000001");

/**
 * The arithmetic behind every fill, kept apart from the database work.
 *
 * These are pure functions over Prisma.Decimal so they can be tested exactly —
 * a rounding bug here would quietly corrupt balances over an account's life,
 * and that is not something to discover from a user's screenshot.
 */

/** What an order costs, or returns: price x quantity. */
function orderTotal(price, quantity) {
  return new D(price).mul(new D(quantity));
}

function assertQuantity(quantity) {
  // Decimal throws its own error on unparseable input, which would surface as
  // a 500. A bad quantity is the caller's mistake, so it gets a 400 either way.
  let value;
  try {
    value = new D(quantity);
  } catch {
    throw ApiError.badRequest("Quantity must be a number greater than zero");
  }

  if (!value.isFinite() || value.lte(ZERO)) {
    throw ApiError.badRequest("Quantity must be greater than zero");
  }
  return value;
}

/* --------------------------------------------------------------- shorting */

/** Long positions carry a positive quantity, shorts a negative one. */
function signedDelta(side, quantity) {
  const size = new D(quantity);
  return side === "BUY" ? size : size.negated();
}

/**
 * What a fill does to a position, covering all five cases in one place:
 * opening, adding to it, reducing it, closing it, and flipping from one
 * direction to the other in a single order.
 *
 * Returns the resulting position and the profit realised by whatever portion
 * of the old position this fill closed.
 */
function applyFill({ heldQuantity, heldAverage, delta, price }) {
  const held = new D(heldQuantity ?? 0);
  const change = new D(delta);
  const fillPrice = new D(price);
  const next = held.plus(change);

  // Nothing held — this opens a position in whichever direction the fill went.
  if (held.isZero()) {
    return { quantity: next, averagePrice: fillPrice, realizedPnl: ZERO };
  }

  const sameDirection = held.isPositive() === change.isPositive();

  // Adding to an existing position: average the entry across both legs.
  if (sameDirection) {
    const heldCost = held.abs().mul(new D(heldAverage));
    const addedCost = change.abs().mul(fillPrice);
    return {
      quantity: next,
      averagePrice: heldCost.plus(addedCost).div(held.abs().plus(change.abs())),
      realizedPnl: ZERO,
    };
  }

  // Opposite direction: this closes some or all of the position. A long books
  // (exit - entry); a short books the inverse, because it profits as price falls.
  const closed = D.min(change.abs(), held.abs());
  const perUnit = held.isPositive()
    ? fillPrice.minus(new D(heldAverage))
    : new D(heldAverage).minus(fillPrice);
  const realized = perUnit.mul(closed);

  // Closing more than was held flips the direction; the remainder is a brand
  // new position opened at this fill's price.
  const flipped = !next.isZero() && next.isPositive() !== held.isPositive();

  return {
    quantity: next,
    averagePrice: flipped ? fillPrice : new D(heldAverage),
    realizedPnl: realized,
  };
}

/**
 * What a fill does to the cash balance.
 *
 * Orbit does not credit short-sale proceeds. Shorting $10,000 of BTC leaves the
 * balance exactly where it was — the money is not the trader's to spend, it is
 * owed back to whoever the coin was borrowed from. Only closing the short moves
 * cash, by the profit or loss it booked.
 *
 * That makes the balance mean one thing and one thing only: money available to
 * spend. Crediting the proceeds instead would show $110,000 against a $100,000
 * account and leave margin to explain why $10,000 of it cannot be touched.
 */
function cashDelta({ heldQuantity, delta, price, realizedPnl }) {
  const held = new D(heldQuantity ?? 0);
  const change = new D(delta);
  const fillPrice = new D(price);

  if (change.isPositive()) {
    // Buying. The part that covers a short costs nothing outright — no cash
    // came in when it opened — so only its profit or loss lands. Whatever is
    // left over buys coin, and that is paid for in full.
    const covered = D.min(change, D.max(held.negated(), ZERO));
    const bought = change.minus(covered);
    return new D(realizedPnl).minus(bought.mul(fillPrice));
  }

  // Selling. Coin actually held returns what the market pays for it — cost and
  // profit together. The remainder opens a short, which pays nothing.
  const sold = D.min(change.abs(), D.max(held, ZERO));
  return sold.mul(fillPrice);
}

/** True once the remaining size is too small to be worth a row. */
function isFlat(quantity) {
  return new D(quantity).abs().lt(DUST);
}

/** Mark-to-market value of a position. Shorts are worth a negative amount. */
function positionValue({ quantity, price }) {
  return new D(quantity).mul(new D(price));
}

/**
 * What a position adds to the account, given that shorts were never paid for.
 *
 * A long was bought with cash, so it is worth whatever the market pays for it.
 * A short took no cash in, so the only thing it contributes is the profit or
 * loss it is sitting on — which is what would land if it were closed now.
 */
function positionEquity({ quantity, averagePrice, price }) {
  const size = new D(quantity);
  if (!size.isNegative()) return size.mul(new D(price));
  return size.mul(new D(price).minus(new D(averagePrice ?? price)));
}

/**
 * What the account is actually worth: cash, plus longs at market, plus what the
 * shorts have made or lost. Equity falls as a short moves against you — which
 * is the number margin is measured against.
 */
function equityOf({ cash, positions }) {
  return positions.reduce(
    (total, position) => total.plus(positionEquity(position)),
    new D(cash),
  );
}

/** Combined size of every short, at market. The exposure margin covers. */
function shortNotionalOf(positions) {
  return positions
    .filter((position) => new D(position.quantity).isNegative())
    .reduce((total, position) => total.plus(positionValue(position).abs()), ZERO);
}

// 1x: short exposure may not exceed equity, so the account carries no leverage.
const MAX_LEVERAGE = new D(1);
// Below this the account is force-closed rather than allowed to go negative.
const MAINTENANCE = new D("0.25");

/**
 * Whether the balance can actually pay for what this fill takes out.
 *
 * Checked before the fill is written, against the cash the order needs rather
 * than the balance it would leave behind, so the error can name both figures.
 * assertMargin still refuses a negative balance afterwards — this is the
 * message, that is the invariant.
 */
function assertSufficientCash({ balance, delta }) {
  const change = new D(delta);
  // Only an outflow can overdraw: money coming in never needs covering.
  if (!change.isNegative()) return;

  const required = change.abs();
  const available = new D(balance);

  if (required.gt(available)) {
    throw ApiError.badRequest(
      `Insufficient balance. You need ${required.toFixed(2)} but only ` +
        `${available.toFixed(2)} is available.`,
      { required: required.toFixed(2), available: available.toFixed(2) },
    );
  }
}

/**
 * The rules a fill has to satisfy after it lands.
 *
 * Cash may not go negative — that would be borrowing to buy, which is leverage
 * by another name. And short exposure may not exceed equity.
 */
function assertMargin({ cash, equity, shortNotional }) {
  if (new D(cash).isNegative()) {
    throw ApiError.badRequest(
      `That order costs ${new D(cash).abs().toFixed(2)} more than you have in cash`,
    );
  }

  const allowed = new D(equity).mul(MAX_LEVERAGE);
  if (new D(shortNotional).gt(allowed)) {
    throw ApiError.badRequest(
      `Shorting that much would put ${new D(shortNotional).toFixed(2)} of exposure against ${new D(equity).toFixed(2)} of equity. Orbit allows no leverage.`,
    );
  }
}

/** Equity has fallen far enough that the shorts must be closed. */
function needsLiquidation({ equity, shortNotional }) {
  const exposure = new D(shortNotional);
  if (exposure.lte(ZERO)) return false;
  return new D(equity).lt(exposure.mul(MAINTENANCE));
}

module.exports = {
  D,
  ZERO,
  DUST,
  MAX_LEVERAGE,
  MAINTENANCE,
  orderTotal,
  assertQuantity,
  signedDelta,
  applyFill,
  cashDelta,
  isFlat,
  positionValue,
  positionEquity,
  assertSufficientCash,
  equityOf,
  shortNotionalOf,
  assertMargin,
  needsLiquidation,
};
