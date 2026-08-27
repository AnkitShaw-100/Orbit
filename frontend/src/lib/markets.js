import manifest from "cryptocurrency-icons/manifest.json";

/**
 * Coin metadata for the markets Orbit lists.
 *
 * The list itself comes from the API — the backend ranks Binance's USDT pairs
 * by real traded volume, so the frontend never hardcodes which coins exist.
 * Names and brand colours come from the icon set's own manifest, which spares
 * us maintaining a table of coin names by hand.
 */
const META = new Map(
  manifest.map((entry) => [entry.symbol.toUpperCase(), { name: entry.name, color: entry.color }]),
);

/**
 * "BTCUSDT" -> "BTC". Every Orbit pair is quoted in USDT.
 *
 * Guarded against a missing symbol: these run inside render, and a live tick
 * that arrives without one should cost a dash in a cell, not the whole screen.
 */
export function baseAsset(symbol) {
  if (typeof symbol !== "string") return "";
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

/**
 * Display info for a market. Unknown tickers fall back to the ticker itself
 * rather than an empty name — a new Binance listing should still render.
 */
export function coinMeta(symbol) {
  const ticker = baseAsset(symbol);
  const known = META.get(ticker);
  return {
    symbol,
    ticker,
    name: known?.name ?? ticker,
    color: known?.color ?? null,
  };
}

/** The handful shown on the landing page, in the API's volume order. */
export const LANDING_COUNT = 6;
