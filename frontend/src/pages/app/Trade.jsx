import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import CandleChart from "@/components/landing/CandleChart";
import MarketSelect from "@/components/app/MarketSelect";
import { Panel } from "@/components/app/Panel";
import { Loading } from "@/components/app/QueryState";
import { useMarkets, usePlaceOrder, usePortfolio } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";
import { orbit } from "@/lib/api";
import { formatPercent, formatPrice, formatUsd, formatVolume } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";

// Labelled by candle interval, the way every trading terminal does it — "1H"
// meaning a one-hour candle, not a one-hour window. Each loads 300 bars, so
// there is always substantial history behind the current price.
const RANGES = [
  { label: "1m", interval: "1m", limit: 300 },
  { label: "5m", interval: "5m", limit: 300 },
  { label: "15m", interval: "15m", limit: 300 },
  { label: "1H", interval: "1h", limit: 300 },
  { label: "4H", interval: "4h", limit: 300 },
  { label: "1D", interval: "1d", limit: 300 },
];

const tickerOf = baseAsset;

export default function Trade() {
  const [params, setParams] = useSearchParams();
  const symbol = params.get("symbol") ?? "BTCUSDT";
  const coin = coinMeta(symbol);

  const markets = useMarkets();
  const listed = markets.data?.markets ?? [];
  const { data: prices, status } = useOrbitPrices();
  const portfolio = usePortfolio();
  const placeOrder = usePlaceOrder();

  const [range, setRange] = useState("15m");
  const [side, setSide] = useState("BUY");
  const [amount, setAmount] = useState("2500");
  const [candles, setCandles] = useState([]);
  const [candlesFailed, setCandlesFailed] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [closeArmed, setCloseArmed] = useState(null);

  const ticker = prices[coin.symbol];
  const price = ticker?.price;
  const isUp = (ticker?.changePct ?? 0) >= 0;

  // Real candles from the Orbit API, which proxies Binance klines.
  //
  // Refetched on a timer as well as on change: live ticks only ever rewrite
  // the newest bar, so without this the series would never learn that Binance
  // has opened a new candle and the chart would slowly fall behind the clock.
  useEffect(() => {
    let cancelled = false;
    const option = RANGES.find((item) => item.label === range) ?? RANGES[2];

    const load = () =>
      orbit
        .klines(coin.symbol, option.interval, option.limit)
        .then((result) => {
          // Cleared here rather than before the request, so switching symbols
          // doesn't flash the previous chart's error away and back.
          if (!cancelled) {
            setCandles(result.candles);
            setCandlesFailed(false);
          }
        })
        .catch(() => {
          // Say so rather than spinning forever — a permanently "loading"
          // chart is indistinguishable from one that was never built.
          if (!cancelled) {
            setCandles([]);
            setCandlesFailed(true);
          }
        });

    load();
    const timer = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [coin.symbol, range]);

  const cash = Number(portfolio.data?.cash ?? 0);
  const shortCapacity = Number(portfolio.data?.shortCapacity ?? 0);
  const held = useMemo(
    () => portfolio.data?.holdings.find((row) => row.symbol === coin.symbol),
    [portfolio.data, coin.symbol],
  );
  // Signed: negative means the position is already short.
  const heldQuantity = Number(held?.quantity ?? 0);
  const longQuantity = Math.max(heldQuantity, 0);

  const spend = Number(amount) || 0;
  const quantity = price ? spend / price : 0;

  // Selling more than you hold no longer fails — it opens a short for the
  // remainder. What the order actually does depends on the position it meets.
  const opensShort = side === "SELL" ? Math.max(quantity - longQuantity, 0) : 0;
  const newExposure = opensShort * (price ?? 0);

  // The same rules the server enforces, mirrored here so the button explains
  // itself instead of the user discovering the limit by being rejected.
  const overCash = side === "BUY" && spend > cash;
  const overMargin = newExposure > shortCapacity;
  const blocked = overCash || overMargin || spend <= 0 || !price || placeOrder.isPending;

  const warning = overCash
    ? `You have ${formatUsd(cash)} in cash`
    : overMargin
      ? `That would open ${formatUsd(newExposure)} of short exposure — you have ${formatUsd(shortCapacity)} of room`
      : null;

  /** Plain description of what this order does to the position. */
  const intent = (() => {
    if (side === "BUY") {
      if (heldQuantity < 0) {
        return quantity >= Math.abs(heldQuantity)
          ? `Covers your ${coin.ticker} short` + (quantity > Math.abs(heldQuantity) ? " and opens a long" : "")
          : `Covers ${quantity.toFixed(6)} of your short`;
      }
      return `Buys ${quantity.toFixed(6)} ${coin.ticker}`;
    }

    if (longQuantity === 0) return `Opens a ${quantity.toFixed(6)} ${coin.ticker} short`;
    if (quantity <= longQuantity) return `Sells ${quantity.toFixed(6)} of your holding`;
    return `Closes your holding and shorts ${opensShort.toFixed(6)} ${coin.ticker}`;
  })();

  /** Records what actually filled, straight from the server's response. */
  const showReceipt = (filledSide) => (result) =>
    setReceipt({
      side: filledSide,
      symbol: result.order.symbol,
      quantity: Number(result.order.quantity),
      price: Number(result.order.executionPrice),
      realizedPnl: result.realizedPnl == null ? null : Number(result.realizedPnl),
    });

  const submit = () => {
    setReceipt(null);
    placeOrder.mutate(
      { symbol: coin.symbol, side, quantity: Number(quantity.toFixed(8)) },
      { onSuccess: showReceipt(side) },
    );
  };

  /**
   * Point the ticket at a position, ready to extend it. Adding to a short
   * means selling more, not buying — buying would cover it.
   */
  const addTo = (target, signedQuantity) => {
    setReceipt(null);
    setCloseArmed(null);
    setSide(signedQuantity < 0 ? "SELL" : "BUY");
    if (target !== coin.symbol) setParams({ symbol: target });
  };

  /**
   * Flatten a position at market. A long is closed by selling, a short by
   * buying it back, so the side depends on which way the position runs.
   */
  const closePosition = (target, signedQuantity) => {
    const exitSide = signedQuantity < 0 ? "BUY" : "SELL";
    setReceipt(null);
    placeOrder.mutate(
      { symbol: target, side: exitSide, quantity: Number(Math.abs(signedQuantity).toFixed(8)) },
      {
        onSuccess: (result) => {
          setCloseArmed(null);
          showReceipt(exitSide)(result);
        },
      },
    );
  };

  return (
    <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-line bg-panel px-5 py-4">
          <MarketSelect
            symbols={listed.map((option) => option.symbol)}
            value={coin.symbol}
            prices={prices}
            onChange={(next) => setParams({ symbol: next })}
          />

          <div>
            <p className="text-[11px] text-faint">Last price</p>
            <p className={`tabular text-sm font-medium ${isUp ? "text-gain" : "text-loss"}`}>
              {formatPrice(price)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-faint">24h change</p>
            <p className={`tabular text-sm font-medium ${isUp ? "text-gain" : "text-loss"}`}>
              {formatPercent(ticker?.changePct)}
            </p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[11px] text-faint">24h volume</p>
            <p className="tabular text-sm font-medium text-foreground">
              {formatVolume(ticker?.quoteVolume)}
            </p>
          </div>

          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-faint">
            <span className={`size-1.5 rounded-full ${status === "live" ? "animate-pulse bg-gain" : "bg-foreground/30"}`} />
            {status === "live" ? "Live" : "Reconnecting"}
          </span>
        </div>

        <div className="rounded-2xl border border-line bg-panel">
          <header className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Chart</h2>
            <div className="flex gap-1">
              {RANGES.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setRange(option.label)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    range === option.label ? "bg-brand text-ink" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </header>
          <div className="h-95 p-3 lg:h-110">
            {candles.length ? (
              <CandleChart data={candles} theme="dark" livePrice={price} />
            ) : candlesFailed ? (
              <div className="grid h-full place-content-center text-center">
                <p className="text-sm text-foreground">Couldn't load candles for {coin.ticker}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Check the Orbit API is running, then switch timeframe to retry.
                </p>
              </div>
            ) : (
              <Loading label="Loading candles" />
            )}
          </div>
        </div>

        <Panel title="Open positions" bodyClassName="p-0">
          {portfolio.isPending ? (
            <Loading label="Loading positions" />
          ) : portfolio.data?.holdings.length ? (
            <>
              <div className="hidden grid-cols-[4rem_1fr_1fr_1fr_1fr_11rem] gap-4 border-b border-line px-5 py-2.5 text-[11px] text-faint sm:grid">
                <span>Asset</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Avg price</span>
                <span className="text-right">Market</span>
                <span className="text-right">P&L</span>
                <span />
              </div>

              <ul>
                {portfolio.data.holdings.map((holding) => {
                  const pnl = Number(holding.unrealizedPnl);
                  const quantity = Number(holding.quantity);
                  const closing = closeArmed === holding.symbol;

                  return (
                    <li
                      key={holding.symbol}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[4rem_1fr_1fr_1fr_1fr_11rem] sm:gap-4"
                    >
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        {tickerOf(holding.symbol)}
                        {holding.side === "SHORT" && (
                          <span className="rounded bg-loss/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-loss">
                            SHORT
                          </span>
                        )}
                      </span>

                      <span className="tabular hidden text-right text-xs text-muted-foreground sm:block">
                        {quantity}
                      </span>
                      <span className="tabular hidden text-right text-xs text-muted-foreground sm:block">
                        {formatPrice(Number(holding.averagePrice))}
                      </span>
                      <span className="tabular hidden text-right text-xs text-foreground sm:block">
                        {formatPrice(Number(holding.marketPrice))}
                      </span>
                      <span
                        className={`tabular text-right text-xs font-medium ${pnl >= 0 ? "text-gain" : "text-loss"}`}
                      >
                        {pnl >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(pnl)).slice(1)}
                      </span>

                      <div className="col-span-2 flex justify-end gap-1.5 sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => addTo(holding.symbol, quantity)}
                          className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-gain/60 hover:text-gain"
                        >
                          Add
                        </button>

                        {/* Closing wipes a position, so it asks once — the same
                            two-step the settings danger zone uses. */}
                        {closing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => closePosition(holding.symbol, quantity)}
                              disabled={placeOrder.isPending}
                              className="rounded-md bg-loss px-2.5 py-1 text-[11px] font-semibold text-foreground disabled:opacity-60"
                            >
                              {placeOrder.isPending ? "Closing…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setCloseArmed(null)}
                              className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted-foreground"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCloseArmed(holding.symbol)}
                            className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-loss/60 hover:text-loss"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No open positions yet.
            </p>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Place order">
          <div className="grid grid-cols-2 gap-2">
            {["BUY", "SELL"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setSide(option);
                  setReceipt(null);
                }}
                className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                  side === option
                    ? option === "BUY"
                      ? "bg-gain text-ink"
                      : "bg-loss text-foreground"
                    : "border border-line text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "BUY" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>

          <p className="mt-4 rounded-lg bg-panel-2 px-3 py-2 text-[11px] text-muted-foreground">
            Market order — fills immediately at {formatPrice(price)}.
          </p>

          <p className="mt-2 text-[11px] text-muted-foreground">{intent}</p>

          <label className="mt-4 block">
            <span className="text-[11px] text-muted-foreground">
              {side === "BUY" ? "Spend (USDT)" : "Sell value (USDT)"}
            </span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="tabular mt-1.5 w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm text-foreground focus:border-foreground/30 focus:outline-none"
            />
          </label>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() =>
                  setAmount(
                    String(
                      side === "BUY"
                        ? Math.floor((cash * pct) / 100)
                        : // Percentage of what you can sell: the holding plus
                          // whatever short exposure margin still allows.
                          Math.floor(((longQuantity * (price ?? 0) + shortCapacity) * pct) / 100),
                    ),
                  )
                }
                className="rounded-md border border-line py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {pct}%
              </button>
            ))}
          </div>

          <dl className="mt-4 space-y-2 text-[11px]">
            {[
              ["Quantity", `${quantity ? quantity.toFixed(6) : "0.000000"} ${coin.ticker}`],
              ["Order value", formatUsd(spend)],
              ["Cash after", formatUsd(side === "BUY" ? cash - spend : cash + spend)],
              ["Short room", formatUsd(shortCapacity)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Margin health, shown only once something is actually shorted. */}
          {portfolio.data?.marginRatio && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${
                portfolio.data.atRisk
                  ? "border-loss/40 bg-loss/10 text-loss"
                  : "border-line bg-panel-2 text-muted-foreground"
              }`}
            >
              <p className="tabular">
                Margin {portfolio.data.marginRatio}× · exposure{" "}
                {formatUsd(Number(portfolio.data.shortNotional))}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {portfolio.data.atRisk
                  ? "Close to a forced liquidation. Cover a short or add nothing further."
                  : "Shorts are closed automatically if this reaches 1×."}
              </p>
            </div>
          )}

          {warning && <p className="mt-3 text-[11px] text-loss">{warning}</p>}
          {placeOrder.isError && (
            <p className="mt-3 text-[11px] text-loss">{placeOrder.error.message}</p>
          )}

          {receipt && (
            <div className="mt-3 rounded-lg border border-gain/30 bg-gain/10 px-3 py-2.5 text-[11px] text-gain">
              <p className="font-medium">
                {receipt.side === "BUY" ? "Bought" : "Sold"} {receipt.quantity}{" "}
                {tickerOf(receipt.symbol)} at {formatPrice(receipt.price)}
              </p>
              {receipt.realizedPnl != null && (
                <p className="tabular mt-0.5 text-muted-foreground">
                  Realised {receipt.realizedPnl >= 0 ? "+" : "−"}
                  {formatUsd(Math.abs(receipt.realizedPnl)).slice(1)}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={blocked}
            className={`mt-4 w-full rounded-lg py-3 text-sm font-semibold transition-colors ${
              blocked
                ? "cursor-not-allowed bg-foreground/10 text-faint"
                : side === "BUY"
                  ? "bg-gain text-ink hover:brightness-110"
                  : "bg-loss text-foreground hover:brightness-110"
            }`}
          >
            {placeOrder.isPending
              ? "Placing…"
              : `${side === "BUY" ? "Buy" : "Sell"} ${coin.ticker}`}
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            Orders execute against your virtual balance at the server's price.
          </p>
        </Panel>
      </div>
    </div>
  );
}
