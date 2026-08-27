/**
 * Re-mark a portfolio against the live price feed.
 *
 * The API computes every valuation from its own price cache at the moment of
 * the request, and the portfolio query only refetches on a slow poll. That is
 * fine for cash and quantities, which only change when an order fills — but it
 * left the P&L column frozen for up to twenty seconds beside a chart that was
 * ticking in real time.
 *
 * So the browser re-marks the price-derived figures itself, from the same
 * socket the chart uses. Nothing here invents data: quantities, average prices
 * and cash still come from the server, and the next refetch overwrites all of
 * this. Only the arithmetic is repeated locally, and it is the same
 * arithmetic — see backend/src/services/portfolio.service.js and tradingMath.
 */

// Below this ratio the server force-closes a short. Mirrored from
// tradingMath.js; if it changes there, it has to change here.
const MAINTENANCE = 0.25;

/** One position, valued at the live price. */
function markHolding(holding, price) {
  const quantity = Number(holding.quantity);
  const average = Number(holding.averagePrice);

  // Falls back to the server's own mark when a symbol is briefly missing from
  // the feed, so a reconnect shows a flat position rather than a wiped one.
  const marketPrice = price ?? Number(holding.marketPrice);

  const cost = quantity * average;
  const value = quantity * marketPrice;
  // Signed quantity makes this correct both ways: a short holds a negative
  // quantity, so a falling price yields a positive P&L.
  const pnl = value - cost;

  return {
    ...holding,
    marketPrice: String(marketPrice),
    cost: cost.toFixed(2),
    value: value.toFixed(2),
    notional: Math.abs(value).toFixed(2),
    unrealizedPnl: pnl.toFixed(2),
    unrealizedPnlPct: cost === 0 ? "0.00" : ((pnl / Math.abs(cost)) * 100).toFixed(2),
  };
}

/**
 * The whole portfolio, re-marked. Returns the input untouched when there is
 * nothing to mark, so a caller can pass it straight through.
 */
export function markPortfolio(portfolio, prices) {
  if (!portfolio?.holdings?.length) return portfolio;

  const holdings = portfolio.holdings.map((holding) =>
    markHolding(holding, prices[holding.symbol]?.price),
  );

  const cash = Number(portfolio.cash);
  const startingCash = Number(portfolio.startingCash);

  const positionsValue = holdings.reduce((sum, row) => sum + Number(row.value), 0);
  const unrealized = holdings.reduce((sum, row) => sum + Number(row.unrealizedPnl), 0);
  const totalValue = cash + positionsValue;

  const shortNotional = holdings
    .filter((row) => Number(row.quantity) < 0)
    .reduce((sum, row) => sum + Math.abs(Number(row.value)), 0);

  const marginRatio = shortNotional === 0 ? null : totalValue / (shortNotional * MAINTENANCE);

  return {
    ...portfolio,
    holdings,
    positionsValue: positionsValue.toFixed(2),
    unrealizedPnl: unrealized.toFixed(2),
    totalValue: totalValue.toFixed(2),
    totalReturnPct: (((totalValue - startingCash) / startingCash) * 100).toFixed(2),
    shortNotional: shortNotional.toFixed(2),
    shortCapacity: (totalValue - shortNotional).toFixed(2),
    marginRatio: marginRatio == null ? null : marginRatio.toFixed(2),
    atRisk: marginRatio == null ? false : marginRatio < 1.5,
  };
}
