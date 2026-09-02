const prisma = require("../lib/prisma");
const ApiError = require("../utils/ApiError");
const market = require("./marketData.service");
const {
  D,
  orderTotal,
  assertQuantity,
  signedDelta,
  applyFill,
  cashDelta,
  isFlat,
  equityOf,
  shortNotionalOf,
  assertSufficientCash,
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
 * Takes the account's write lock for the rest of the transaction.
 *
 * Without it two orders placed at the same instant both read the same balance,
 * both decide they can afford it, and the second UPDATE overwrites the first —
 * a textbook lost update, and on this table it spends the same money twice.
 * Postgres runs READ COMMITTED by default, where an unlocked read blocks
 * nothing, so the lock has to be taken explicitly.
 *
 * The wallet row is the account's mutex rather than one lock per table: every
 * order goes through here and every order touches the wallet, so holding this
 * one row serialises a user's fills without also serialising unrelated users.
 */
async function lockAccount(tx, userId) {
  const [locked] = await tx.$queryRaw`
    SELECT id FROM wallets WHERE user_id = ${userId}::uuid FOR UPDATE
  `;
  if (!locked) throw ApiError.notFound("No wallet for this account");
}

/** An order already placed under this key, with everything the caller returns. */
function findByKey(client, userId, idempotencyKey) {
  return client.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: { transaction: true },
  });
}

/**
 * Values every position at the current market, substituting a known price for
 * one symbol — the fill price for the order being placed, since that trade
 * hasn't reached the price cache yet.
 */
function markPositions(positions, prices, override = {}) {
  return positions.map((position) => ({
    quantity: position.quantity,
    averagePrice: position.averagePrice,
    price:
      override.symbol === position.symbol
        ? override.price
        : (prices[position.symbol]?.price ?? position.averagePrice),
  }));
}

async function placeOrder({
  userId,
  symbol,
  side,
  quantity,
  liquidation = false,
  idempotencyKey = null,
}) {
  const requested = assertQuantity(quantity);

  // Cheap check outside the transaction so a replay of a long-settled order
  // costs one indexed read rather than a lock. It is not the guarantee — the
  // one inside the lock below is — just the fast path for the common case.
  if (idempotencyKey) {
    const previous = await findByKey(prisma, userId, idempotencyKey);
    if (previous) return replayOf(previous, userId);
  }

  // Server-side price. The client never supplies its own fill price.
  const executionPrice = new D(market.getExecutionPrice(symbol));

  return prisma.$transaction(async (tx) => {
    // Before anything is read, so the balance and positions below cannot move
    // underneath this transaction.
    await lockAccount(tx, userId);

    // Re-checked while holding the lock. Two clicks landing together both miss
    // the fast path above; the second blocks here, and by the time it gets the
    // lock the first has committed and is found.
    if (idempotencyKey) {
      const previous = await findByKey(tx, userId, idempotencyKey);
      if (previous) return replayOf(previous, userId, tx);
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw ApiError.notFound("No wallet for this account");

    const positions = await tx.portfolio.findMany({ where: { userId } });
    const existing = positions.find((position) => position.symbol === symbol);
    const held = new D(existing?.quantity ?? 0);

    /**
     * A liquidation was sized from a snapshot the sweep took before this lock
     * was held, and the short may have shrunk or been covered since — by the
     * user closing it themselves, or by a second server instance sweeping the
     * same account. Buying the stale size would land on a flat position and
     * open a long, and liquidation skips the cash and margin checks that would
     * otherwise refuse it, so it could overdraw the account outright.
     *
     * The locked read is the authority. Never buy back more than is short.
     */
    const fillQuantity = liquidation ? D.min(requested, held.abs()) : requested;

    if (liquidation && (!held.isNegative() || isFlat(fillQuantity))) {
      return {
        order: null,
        transaction: null,
        balance: new D(wallet.balance),
        liquidation,
        skipped: true,
      };
    }

    const delta = signedDelta(side, fillQuantity);
    const total = orderTotal(executionPrice, fillQuantity);

    const result = applyFill({
      heldQuantity: held,
      heldAverage: existing?.averagePrice ?? 0,
      delta,
      price: executionPrice,
    });

    // Buying spends cash and selling a holding returns it, but opening a short
    // does neither: its proceeds are not the trader's to spend, so the balance
    // does not move until the short is bought back and books its P&L.
    const movement = cashDelta({
      heldQuantity: held,
      delta,
      price: executionPrice,
      realizedPnl: result.realizedPnl,
    });

    // Refused before a single row is written, and named in full: what the order
    // needs and what the account actually has. A liquidation is exempt for the
    // same reason it is exempt from margin — it is the fix, not the breach.
    if (!liquidation) {
      assertSufficientCash({ balance: wallet.balance, delta: movement });
    }

    const nextBalance = new D(wallet.balance).plus(movement);

    // Margin is judged on the account after the fill lands, not before.
    const after = positions
      .filter((position) => position.symbol !== symbol)
      .concat(
        isFlat(result.quantity)
          ? []
          : [{ symbol, quantity: result.quantity, averagePrice: result.averagePrice }],
      );

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
        quantity: fillQuantity,
        executionPrice,
        total,
        status: "FILLED",
        idempotencyKey,
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
        // The cash side of the same fill, so a balance can be audited from its
        // own row instead of replayed from the whole order history.
        cashDelta: movement,
        balanceAfter: nextBalance,
      },
    });

    return { order, transaction, balance: nextBalance, liquidation };
  });
}

/**
 * The answer a replayed request gets: the original order, unchanged, alongside
 * the balance as it stands now. Flagged so the caller can tell a replay from a
 * fresh fill rather than reporting the same trade to the user twice.
 */
async function replayOf(previous, userId, client = prisma) {
  const wallet = await client.wallet.findUnique({ where: { userId } });
  const { transaction, ...order } = previous;

  return {
    order,
    transaction,
    balance: new D(wallet?.balance ?? 0),
    liquidation: false,
    replayed: true,
  };
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

// `lockAccount` is exported so anything else that rewrites an account's money —
// resetting it, for one — takes the same lock the trading engine does. Two
// different locks would serialise nothing.
module.exports = { placeOrder, listOrders, listTransactions, lockAccount };
