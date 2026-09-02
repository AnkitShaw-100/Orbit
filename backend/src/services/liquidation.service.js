const prisma = require("../lib/prisma");
const market = require("./marketData.service");
const orders = require("./order.service");
const { D, equityOf, shortNotionalOf, needsLiquidation, MAINTENANCE } = require("./tradingMath");

/**
 * Force-closes shorts that have run past what the account can cover.
 *
 * This is the whole point of letting people short on a practice platform: a
 * short's loss is unbounded, and the lesson is that the position closes without
 * asking you. Warning and letting it ride would teach the opposite.
 *
 * Runs on a timer rather than on every price tick — a tick fires many times a
 * second across 100 symbols, and re-reading every account that often would cost
 * far more than it catches.
 */
const INTERVAL_MS = 15000;

let timer = null;
let running = false;

/** Accounts holding at least one short, with their wallet and positions. */
async function accountsWithShorts() {
  const shorts = await prisma.portfolio.findMany({
    where: { quantity: { lt: 0 } },
    select: { userId: true },
    distinct: ["userId"],
  });

  if (shorts.length === 0) return [];

  const userIds = shorts.map((row) => row.userId);
  const [wallets, positions] = await Promise.all([
    prisma.wallet.findMany({ where: { userId: { in: userIds } } }),
    prisma.portfolio.findMany({ where: { userId: { in: userIds } } }),
  ]);

  return wallets.map((wallet) => ({
    userId: wallet.userId,
    cash: wallet.balance,
    positions: positions.filter((position) => position.userId === wallet.userId),
  }));
}

function markAll(positions, prices) {
  return positions.map((position) => ({
    symbol: position.symbol,
    quantity: position.quantity,
    averagePrice: position.averagePrice,
    price: prices[position.symbol]?.price ?? position.averagePrice,
  }));
}

/**
 * Closes every short on an account, largest exposure first, until it is back
 * above maintenance. Closing the biggest position first frees the most margin
 * per order, so an account is rescued in as few forced trades as possible.
 */
async function liquidate(account, prices) {
  const marked = markAll(account.positions, prices)
    .filter((position) => new D(position.quantity).isNegative())
    .sort((a, b) =>
      new D(b.quantity).abs().mul(b.price).comparedTo(new D(a.quantity).abs().mul(a.price)),
    );

  for (const position of marked) {
    try {
      // The size here is from the snapshot above; placeOrder clamps it to what
      // is actually short once it holds the account lock, and skips the fill
      // entirely if the position is already gone.
      const result = await orders.placeOrder({
        userId: account.userId,
        symbol: position.symbol,
        // Covering a short means buying it back.
        side: "BUY",
        quantity: new D(position.quantity).abs().toString(),
        liquidation: true,
      });

      if (result.skipped) {
        // Covered by the user, or by another instance, between the sweep's
        // read and this fill. Nothing to do, and not a failure.
        console.warn(
          `[liquidation] ${position.symbol} already covered for user ${account.userId}`,
        );
      } else {
        console.warn(
          `[liquidation] closed ${position.symbol} short for user ${account.userId}`,
        );
      }
    } catch (error) {
      console.error(`[liquidation] failed on ${position.symbol}:`, error.message);
      continue;
    }

    // Re-check after each close — one may be enough to restore the account.
    const wallet = await prisma.wallet.findUnique({ where: { userId: account.userId } });
    const remaining = await prisma.portfolio.findMany({ where: { userId: account.userId } });
    const remarked = markAll(remaining, market.snapshot());

    if (
      !needsLiquidation({
        equity: equityOf({ cash: wallet.balance, positions: remarked }),
        shortNotional: shortNotionalOf(remarked),
      })
    ) {
      return;
    }
  }
}

async function sweep() {
  // Skip while the feed is down: valuing positions against stale prices could
  // liquidate an account that is actually fine.
  if (running || !market.isConnected) return;
  running = true;

  try {
    const prices = market.snapshot();
    const accounts = await accountsWithShorts();

    for (const account of accounts) {
      const marked = markAll(account.positions, prices);
      const equity = equityOf({ cash: account.cash, positions: marked });
      const shortNotional = shortNotionalOf(marked);

      if (needsLiquidation({ equity, shortNotional })) {
        console.warn(
          `[liquidation] user ${account.userId} at ${equity.toFixed(2)} equity against ` +
            `${shortNotional.toFixed(2)} exposure (maintenance ${MAINTENANCE.mul(100)}%)`,
        );
        await liquidate(account, prices);
      }
    }
  } catch (error) {
    console.error("[liquidation] sweep failed", error);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  timer = setInterval(sweep, INTERVAL_MS);
  timer.unref?.();
  console.log(`[liquidation] watching shorts every ${INTERVAL_MS / 1000}s`);
}

function stop() {
  clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, sweep };
