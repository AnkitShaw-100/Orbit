import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import CandleChart from "@/components/landing/CandleChart";
import CoinCell, { SideBadge } from "@/components/app/CoinCell";
import PositionActions from "@/components/app/PositionActions";
import MarketSelect from "@/components/app/MarketSelect";
import { Cell, CellRow, Panel } from "@/components/app/Panel";
import { LiveDot } from "@/components/app/Toolbar";
import { Loading } from "@/components/app/QueryState";
import { useMarkets, usePlaceOrder, usePortfolio } from "@/hooks/useOrbit";
import { useOrbitPrices } from "@/hooks/useOrbitPrices";
import { useRetryAfter } from "@/hooks/useRetryAfter";
import { useTheme } from "@/hooks/useTheme";
import { orbit } from "@/lib/api";
import { formatPrice, formatUsd, formatVolume, signedPercent, signedUsd } from "@/lib/format";
import { baseAsset, coinMeta } from "@/lib/markets";
import { markPortfolio } from "@/lib/positions";

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

const QUANTITY = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });

/** Written once so the positions header and its rows cannot drift apart. */
const POSITION_GRID = "lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_13rem]";

export default function Trade() {
  const [params, setParams] = useSearchParams();
  const symbol = params.get("symbol") ?? "BTCUSDT";
  const coin = coinMeta(symbol);

  const markets = useMarkets();
  const listed = markets.data?.markets ?? [];
  const { data: prices, status } = useOrbitPrices();

  const query = usePortfolio();
  const placeOrder = usePlaceOrder();

  // Seconds the order limiter is still refusing for, 0 when it isn't. Every
  // path that places an order reads this, so a refusal disables the ticket and
  // the position buttons together rather than only the one that was clicked.
  const cooldown = useRetryAfter(placeOrder.error);

  /**
   * The portfolio query polls slowly, so between refetches its P&L was frozen
   * beside a chart ticking in real time. Re-marked against the live feed here,
   * once per tick, so every figure on the page moves together.
   */
  const portfolio = useMemo(
    () => ({ ...query, data: markPortfolio(query.data, prices) }),
    [query, prices],
  );
  // The chart paints its own grid and labels, so it needs the resolved theme
  // rather than the preference — "system" is not a palette.
  const { resolved } = useTheme();

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

  // What the order actually does to the balance, mirroring tradingMath's
  // cashDelta: covering a short only books its P&L, and opening one moves
  // nothing. Buying coin outright and selling a holding move the full value.
  const shortQuantity = Math.max(-heldQuantity, 0);
  const covered = side === "BUY" ? Math.min(quantity, shortQuantity) : 0;
  const coverPnl =
    covered && held ? (Number(held.averagePrice) - (price ?? 0)) * covered : 0;
  const cashAfter =
    side === "BUY"
      ? cash + coverPnl - (quantity - covered) * (price ?? 0)
      : cash + Math.min(quantity, longQuantity) * (price ?? 0);

  const currentExposure = shortQuantity * (price ?? 0);

  // The same rules the server enforces, mirrored here so the button explains
  // itself instead of the user discovering the limit by being rejected. Buying
  // is refused when it would overdraw the balance, which now includes a cover
  // that loses more than the account has left.
  const overCash = side === "BUY" && cashAfter < 0;
  const overMargin = newExposure > shortCapacity;
  const blocked =
    overCash || overMargin || spend <= 0 || !price || placeOrder.isPending || cooldown > 0;

  const warning = overCash
    ? `That leaves you ${formatUsd(cashAfter)} — you have ${formatUsd(cash)} in cash`
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

  // The position's worth at this instant, from the live tick rather than the
  // portfolio's last refetch — the same number the chart's entry line carries.
  const entryPrice = heldQuantity ? Number(held.averagePrice) : null;
  const livePnl =
    entryPrice != null && price != null ? (price - entryPrice) * heldQuantity : null;
  const livePnlPct =
    livePnl != null ? (livePnl / (entryPrice * Math.abs(heldQuantity))) * 100 : null;

  /**
   * Under the chart, the way every trading terminal stacks it: the market on
   * top, what you hold in it underneath, the ticket alongside. Above the chart
   * it pushed the candles out of the viewport, which is the one thing this
   * page cannot afford to do.
   */
  const positionsPanel = (
    <Panel title="Open positions" bodyClassName="p-0">
      {portfolio.isPending ? (
        <Loading label="Loading positions" />
      ) : portfolio.data?.holdings.length ? (
        <>
          <div
            className={`hidden gap-4 border-b border-line px-5 py-3 text-xs text-faint sm:px-6 lg:grid ${POSITION_GRID}`}
          >
            <span>Market</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Avg price</span>
            <span className="text-right">Market price</span>
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
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line px-5 py-3 transition-colors last:border-b-0 hover:bg-foreground/2 sm:gap-4 sm:px-6 ${POSITION_GRID}`}
                >
                  <CoinCell
                    symbol={holding.symbol}
                    badge={holding.side === "SHORT" && <SideBadge side="SHORT" />}
                    sub={
                      <span className="tabular lg:hidden">
                        {quantity} @ {formatPrice(Number(holding.averagePrice))}
                      </span>
                    }
                  />

                  <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                    {quantity}
                  </span>
                  <span className="tabular hidden text-right text-sm text-muted-foreground lg:block">
                    {formatPrice(Number(holding.averagePrice))}
                  </span>
                  <span className="tabular hidden text-right text-sm text-foreground lg:block">
                    {formatPrice(Number(holding.marketPrice))}
                  </span>
                  <span
                    className={`tabular text-right text-sm font-medium ${pnl >= 0 ? "text-gain" : "text-loss"}`}
                  >
                    {signedUsd(pnl)}
                  </span>

                  <div className="col-span-2 lg:col-span-1">
                    <PositionActions
                      armed={closing}
                      pending={placeOrder.isPending}
                      cooldown={cooldown}
                      onAdd={() => addTo(holding.symbol, quantity)}
                      onArm={() => setCloseArmed(holding.symbol)}
                      onCancel={() => setCloseArmed(null)}
                      onConfirm={() => closePosition(holding.symbol, quantity)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        // A single line rather than a centred block: this is the last thing on
        // the page, and an empty panel saying nothing does not deserve the
        // height of one that lists positions.
        <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6">
          No open positions yet.{" "}
          <span className="text-faint">
            Anything you buy or short appears here, with its live P&L and a one-click exit.
          </span>
        </p>
      )}
    </Panel>
  );

  return (
    <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        {/* The market band, built like the dashboard's summary: the picker and
            the price you are about to trade at up top, the surrounding facts
            in a banded row underneath. */}
        {/* Deliberately not overflow-hidden: the market picker opens a menu
            out of this band, and clipping the corners would clip that too.
            Nothing inside paints a background, so the rounded corners hold
            without it. */}
        <section className="rounded-2xl border border-line bg-panel">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 p-5 sm:p-6">
            <div className="min-w-0">
              <MarketSelect
                symbols={listed.map((option) => option.symbol)}
                value={coin.symbol}
                prices={prices}
                onChange={(next) => setParams({ symbol: next })}
              />
              <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                Last price
              </p>
              <p
                className={`tabular font-display text-3xl font-bold tracking-[-0.03em] ${
                  isUp ? "text-gain" : "text-loss"
                }`}
              >
                {formatPrice(price)}
              </p>
            </div>

            <div className="flex items-end gap-8">
              <div className="text-right leading-tight">
                <p className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
                  24h change
                </p>
                <p
                  className={`tabular font-display text-xl font-bold tracking-[-0.03em] ${
                    isUp ? "text-gain" : "text-loss"
                  }`}
                >
                  {signedPercent(ticker?.changePct)}
                </p>
              </div>

              <LiveDot status={status} />
            </div>
          </div>

          <div className="border-t border-line">
            <CellRow>
              <Cell label="24h volume" value={formatVolume(ticker?.quoteVolume)}>
                <p className="text-xs text-faint">Traded on Binance</p>
              </Cell>
              <Cell
                label="Your position"
                value={heldQuantity ? QUANTITY.format(Math.abs(heldQuantity)) : "None"}
              >
                <p className="text-xs text-faint">
                  {heldQuantity
                    ? `${heldQuantity < 0 ? "Short" : "Long"} ${coin.ticker} · ${signedUsd(
                        Number(held?.unrealizedPnl ?? 0),
                      )}`
                    : `No ${coin.ticker} held`}
                </p>
              </Cell>
              <Cell label="Available balance" value={formatUsd(cash)}>
                <p className="text-xs text-faint">
                  {currentExposure > 0
                    ? `${formatUsd(currentExposure)} shorted · room ${formatUsd(shortCapacity)}`
                    : `Short room ${formatUsd(shortCapacity)}`}
                </p>
              </Cell>
            </CellRow>
          </div>
        </section>

        <Panel
          title="Chart"
          bodyClassName="h-95 p-3 lg:h-110"
          action={
            <div className="flex items-center gap-4">
              {/* The position, restated where the eye already is: the chart
                  draws the entry line, this says what it is worth. */}
              {livePnl != null && (
                <span className="tabular hidden items-center gap-2 text-xs sm:flex">
                  <span className="text-faint">
                    {heldQuantity < 0 ? "Short" : "Long"} {formatPrice(entryPrice)}
                  </span>
                  <span className={livePnl >= 0 ? "text-gain" : "text-loss"}>
                    {signedUsd(livePnl)} ({signedPercent(livePnlPct)})
                  </span>
                </span>
              )}

              <div role="radiogroup" aria-label="Candle interval" className="flex gap-1">
                {RANGES.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={range === option.label}
                    onClick={() => setRange(option.label)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                      range === option.label
                        ? "bg-brand text-ink"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {candles.length ? (
            <CandleChart
              data={candles}
              theme={resolved}
              livePrice={price}
              position={
                heldQuantity
                  ? { entry: Number(held.averagePrice), quantity: heldQuantity }
                  : null
              }
            />
          ) : candlesFailed ? (
            <div className="grid h-full place-content-center px-5 text-center">
              <p className="text-sm text-foreground">Couldn't load candles for {coin.ticker}</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted-foreground">
                Check the Orbit API is running, then switch timeframe to retry.
              </p>
            </div>
          ) : (
            <Loading label="Loading candles" />
          )}
        </Panel>

        {positionsPanel}
      </div>

      <div className="space-y-4">
        <Panel title="Place order">
          <div
            role="radiogroup"
            aria-label="Order side"
            className="grid grid-cols-2 gap-1 rounded-full border border-line p-1"
          >
            {["BUY", "SELL"].map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={side === option}
                onClick={() => {
                  setSide(option);
                  setReceipt(null);
                }}
                className={`rounded-full py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  side === option
                    ? option === "BUY"
                      ? "bg-gain text-on-gain"
                      : "bg-loss text-on-loss"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "BUY" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>

          {/* What the order is and what it will do to the position, together —
              they are one thought, and two separate paragraphs read as two. */}
          <div className="mt-4 rounded-xl border border-line bg-panel-2 px-3.5 py-3 text-[11px] leading-relaxed">
            <p className="text-muted-foreground">
              Market order — fills immediately at{" "}
              <span className="tabular text-foreground">{formatPrice(price)}</span>.
            </p>
            <p className="mt-1 text-foreground">{intent}</p>
            {newExposure > 0 && (
              <p className="mt-1 text-faint">
                Short proceeds aren't added to your balance — you keep{" "}
                {formatUsd(cash)} either way, and the profit or loss lands when
                you buy it back.
              </p>
            )}
          </div>

          <label className="mt-4 block">
            <span className="font-mono text-[11px] tracking-[0.14em] text-faint uppercase">
              {side === "BUY" ? "Spend (USDT)" : "Sell value (USDT)"}
            </span>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-faint">
                $
              </span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="tabular w-full rounded-xl border border-line bg-panel-2 py-3 pr-3.5 pl-7 font-display text-lg font-bold tracking-[-0.02em] text-foreground transition-colors focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              />
            </div>
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
                className="rounded-full border border-line py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {pct}%
              </button>
            ))}
          </div>

          <dl className="mt-4 divide-y divide-line border-y border-line text-[11px]">
            {[
              ["Quantity", `${quantity ? quantity.toFixed(6) : "0.000000"} ${coin.ticker}`],
              ["Order value", formatUsd(spend)],
              // Only the part of the order that touches cash. Opening a short
              // brings nothing in — the proceeds are owed back, not earned —
              // so the balance sits still until the short is bought back.
              ["Cash after", formatUsd(cashAfter)],
              ...(newExposure > 0
                ? [["Short proceeds", "Not credited — held against the position"]]
                : []),
              ...(heldQuantity < 0 && side === "BUY"
                ? [["Books P&L on cover", signedUsd(coverPnl)]]
                : []),
              ["Short exposure after", formatUsd(currentExposure + newExposure)],
              ["Short room", formatUsd(shortCapacity)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Margin health, shown only once something is actually shorted. */}
          {portfolio.data?.marginRatio && (
            <div
              className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[11px] ${
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

          {(warning || placeOrder.isError) && (
            <p className="mt-3 rounded-xl border border-loss/30 bg-loss/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-loss">
              {warning ??
                (cooldown > 0
                  ? `${placeOrder.error.message} Try again in ${cooldown}s.`
                  : placeOrder.error.message)}
            </p>
          )}

          {receipt && (
            <div className="mt-3 rounded-xl border border-gain/30 bg-gain/10 px-3.5 py-2.5 text-[11px] text-gain">
              <p className="font-medium">
                {receipt.side === "BUY" ? "Bought" : "Sold"} {receipt.quantity}{" "}
                {tickerOf(receipt.symbol)} at {formatPrice(receipt.price)}
              </p>
              {receipt.realizedPnl != null && (
                <p className="tabular mt-0.5 text-muted-foreground">
                  Realised {signedUsd(receipt.realizedPnl)}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={blocked}
            className={`mt-4 w-full rounded-full py-3 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-panel focus-visible:outline-none ${
              blocked
                ? "cursor-not-allowed bg-foreground/10 text-faint"
                : side === "BUY"
                  ? "bg-gain text-on-gain hover:brightness-110"
                  : "bg-loss text-on-loss hover:brightness-110"
            }`}
          >
            {placeOrder.isPending
              ? "Placing…"
              : cooldown > 0
                ? `Wait ${cooldown}s`
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
