const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const env = require("../config/env");
const market = require("./marketData.service");
const { equityOf, positionEquity, shortNotionalOf, MAINTENANCE } = require("./tradingMath");

const D = Prisma.Decimal;

/**
 * Portfolio value and unrealised P&L are computed here, never stored — the
 * Database Design Document (section 9) is explicit that prices don't go in the
 * database. Every figure below is derived from the live price cache at the
 * moment of the request.
 */
async function getPortfolio(userId) {
  const [wallet, positions] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.portfolio.findMany({ where: { userId }, orderBy: { symbol: "asc" } }),
  ]);

  const prices = market.snapshot();
  const cash = new D(wallet?.balance ?? 0);

  const holdings = positions.map((position) => {
    // Fall back to entry price when a symbol is briefly missing from the cache,
    // so a reconnect shows a flat position rather than a wiped portfolio.
    const price = new D(prices[position.symbol]?.price ?? position.averagePrice);
    const quantity = new D(position.quantity);
    const cost = quantity.mul(position.averagePrice);
    const value = quantity.mul(price);

    // Signed quantity makes this correct for both directions: a short holds a
    // negative quantity, so a falling price yields a positive P&L.
    const pnl = value.minus(cost);
    const isShort = quantity.isNegative();

    return {
      symbol: position.symbol,
      side: isShort ? "SHORT" : "LONG",
      quantity: quantity.toString(),
      averagePrice: new D(position.averagePrice).toFixed(8),
      marketPrice: price.toFixed(8),
      cost: cost.toFixed(2),
      value: value.toFixed(2),
      // Exposure is what margin is measured against, so shorts report it.
      notional: value.abs().toFixed(2),
      unrealizedPnl: pnl.toFixed(2),
      unrealizedPnlPct: cost.isZero() ? "0.00" : pnl.div(cost.abs()).mul(100).toFixed(2),
      updatedAt: position.updatedAt,
    };
  });

  const marked = positions.map((position) => ({
    quantity: position.quantity,
    averagePrice: position.averagePrice,
    price: prices[position.symbol]?.price ?? position.averagePrice,
  }));

  // What the positions add to the account. A long counts at market; a short
  // counts only for its P&L, because its sale proceeds were never credited to
  // cash. Split out so totalValue is visibly cash plus this and nothing else.
  const positionsValue = marked.reduce(
    (sum, position) => sum.plus(positionEquity(position)),
    new D(0),
  );
  const longValue = holdings
    .filter((row) => row.side === "LONG")
    .reduce((sum, row) => sum.plus(row.value), new D(0));
  const unrealized = holdings.reduce((sum, row) => sum.plus(row.unrealizedPnl), new D(0));
  const totalValue = equityOf({ cash, positions: marked });
  const shortNotional = shortNotionalOf(marked);
  const baseline = new D(env.startingCash);

  // How close the account is to a forced close: 1.0 is at the limit, higher is
  // safer. Null when nothing is shorted, since there is nothing to maintain.
  const marginRatio = shortNotional.isZero()
    ? null
    : totalValue.div(shortNotional.mul(MAINTENANCE));

  return {
    // Money free to spend. Nothing here is reserved or borrowed: a short never
    // added to it, so what it says is what an order can use.
    cash: cash.toFixed(2),
    positionsValue: positionsValue.toFixed(2),
    // The long book at market, reported apart from the shorts' P&L so the two
    // can be shown as the different things they are.
    longValue: longValue.toFixed(2),
    totalValue: totalValue.toFixed(2),
    unrealizedPnl: unrealized.toFixed(2),
    // Orbit's one fixed reference point: everyone starts at exactly $100,000.
    startingCash: baseline.toFixed(2),
    totalReturnPct: totalValue.minus(baseline).div(baseline).mul(100).toFixed(2),
    shortNotional: shortNotional.toFixed(2),
    // Headroom left before another short is refused.
    shortCapacity: totalValue.minus(shortNotional).toFixed(2),
    marginRatio: marginRatio ? marginRatio.toFixed(2) : null,
    atRisk: marginRatio ? marginRatio.lt(1.5) : false,
    holdings,
  };
}

async function getWallet(userId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return {
    balance: new D(wallet?.balance ?? 0).toFixed(2),
    startingCash: new D(env.startingCash).toFixed(2),
  };
}

module.exports = { getPortfolio, getWallet };
