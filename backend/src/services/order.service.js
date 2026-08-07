const prisma = require("../lib/prisma");
const ApiError = require("../utils/ApiError");
const market = require("./marketData.service");
const {
  D,
  orderTotal,
  assertQuantity,
  signedDelta,
  applyFill,
  isFlat,
  equityOf,
  shortNotionalOf,
  assertMargin,
} = require("./tradingMath");

/**
 * Orbit's trading engine.
 *
 * Every fill is one database transaction (DBD sections 6 and 7): read the
 * balance and positions, apply the fill, move the cash, check margin, write the
 * order and its transaction, commit. A partial write would leave a wallet that
 * doesn't match its holdings, so nothing is written outside the transaction.
 *
 * Positions are signed: a negative quantity is a short. Buying and selling are
 * therefore the same operation with opposite signs, and one code path covers
 * opening, adding, reducing, closing and flipping direction.
 *
 * The arithmetic lives in tradingMath.js, where it is tested directly.
 */

/**
 * Values every position at the current market, substituting a known price for
 * one symbol — the fill price for the order being placed, since that trade
 * hasn't reached the price cache yet.
 */
function markPositions(positions, prices, override = {}) {
  return positions.map((position) => ({
    quantity: position.quantity,
    price:
      override.symbol === position.symbol
        ? override.price
        : (prices[position.symbol]?.price ?? position.averagePrice),
  }));
}

async function placeOrder({ userId, symbol, side, quantity, liquidation = false }) {
  const requested = assertQuantity(quantity);
  const delta = signedDelta(side, requested);

  // Server-side price. The client never supplies its own fill price.
  const executionPrice = new D(market.getExecutionPrice(symbol));
  const total = orderTotal(executionPrice, requested);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw ApiError.notFound("No wallet for this account");

    const positions = await tx.portfolio.findMany({ where: { userId } });
    const existing = positions.find((position) => position.symbol === symbol);

    const result = applyFill({
      heldQuantity: existing?.quantity ?? 0,
      heldAverage: existing?.averagePrice ?? 0,
      delta,
      price: executionPrice,
    });

    // Buying spends cash, selling returns it — including a short sale, whose
    // proceeds are credited and then offset by the negative position.
    const nextBalance = side === "BUY"
      ? new D(wallet.balance).minus(total)
      : new D(wallet.balance).plus(total);

    // Margin is judged on the account after the fill lands, not before.
    const after = positions
      .filter((position) => position.symbol !== symbol)
      .concat(isFlat(result.quantity) ? [] : [{ symbol, quantity: result.quantity }]);

    const marked = markPositions(after, market.snapshot(), {
      symbol,
      price: executionPrice,
    });

    // A liquidation is the platform closing a position that already breached
    // margin, so it must not be blocked by the very rule it is resolving.
    if (!liquidation) {
      assertMargin({
        cash: nextBalance,
        equity: equityOf({ cash: nextBalance, positions: marked }),
        shortNotional: shortNotionalOf(marked),
      });
    }

    if (isFlat(result.quantity)) {
      if (existing) await tx.portfolio.delete({ where: { id: existing.id } });
    } else if (existing) {
      await tx.portfolio.update({
        where: { id: existing.id },
        data: { quantity: result.quantity, averagePrice: result.averagePrice },
      });
    } else {
      await tx.portfolio.create({
        data: {
          userId,
          symbol,
          quantity: result.quantity,
          averagePrice: result.averagePrice,
        },
      });
    }

    const order = await tx.order.create({
      data: {
        userId,
        symbol,
        side,
        quantity: requested,
        executionPrice,
        total,
        status: "FILLED",
      },
    });

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: nextBalance } });

    const transaction = await tx.transaction.create({
      data: {
        orderId: order.id,
        userId,
        symbol,
        // Only the portion that closed books a profit; opening books nothing.
        realizedPnl: result.realizedPnl.isZero() ? null : result.realizedPnl,
      },
    });

    return { order, transaction, balance: nextBalance, liquidation };
  });
}

function listOrders(userId, { limit = 50, symbol } = {}) {
  return prisma.order.findMany({
    where: { userId, ...(symbol ? { symbol } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 50, 200),
  });
}

function listTransactions(userId, { limit = 50 } = {}) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 50, 200),
    include: { order: true },
  });
}

module.exports = { placeOrder, listOrders, listTransactions };
