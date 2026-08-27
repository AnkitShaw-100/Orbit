import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, HistogramSeries, createChart } from "lightweight-charts";

/**
 * How many decimals a market needs to say anything useful.
 *
 * A price scale that rounds PYTH to "0.05" is worse than no scale at all — the
 * whole day's range disappears into one tick. Derived from the price rather
 * than hardcoded, because Orbit lists whatever Binance ranks highest and that
 * spans BTC at five figures to meme coins at six decimal places.
 */
function precisionFor(price) {
  if (price == null || Number.isNaN(price)) return 2;
  if (price >= 1) return 2;
  if (price >= 0.01) return 4;
  if (price >= 0.0001) return 6;
  return 8;
}

/** The CSS tokens the chart borrows, read at paint time so themes apply. */
function palette() {
  const tokens = getComputedStyle(document.documentElement);
  return {
    gain: tokens.getPropertyValue("--color-gain").trim() || "#2DD4BF",
    loss: tokens.getPropertyValue("--color-loss").trim() || "#EF5350",
  };
}

/**
 * Candlestick chart with a volume histogram beneath it.
 *
 * Volume shares the price pane rather than taking its own, pinned to the lower
 * fifth — the arrangement every trading terminal uses, because volume is read
 * against the candle directly above it.
 *
 * Colours come from the CSS tokens rather than repeated hex values, so the
 * chart follows --color-gain / --color-loss like every other price in the UI.
 *
 * `position` is optional: pass `{ entry, quantity }` for a held position and
 * the chart draws the entry line every terminal draws, with the live P&L in a
 * tag beside it. Quantity is signed, so a short works out of the box — price
 * falling below entry is a gain.
 */
export default function CandleChart({ data, theme = "light", livePrice, position }) {
  const containerRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);
  const chartRef = useRef(null);
  const entryLineRef = useRef(null);

  // Where the entry line lands in the pane, and how much room the price axis
  // takes — the tag is positioned against both so it sits on the line without
  // covering the scale.
  const [marker, setMarker] = useState(null);

  const entry = position?.entry ?? null;
  const quantity = position?.quantity ?? 0;

  const pnl = entry != null && livePrice != null && quantity ? (livePrice - entry) * quantity : null;
  const pnlPct = pnl != null ? (pnl / (entry * Math.abs(quantity))) * 100 : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dark = theme === "dark";
    const line = dark ? "rgba(255,255,255," : "rgba(10,10,10,";
    const { gain, loss } = palette();

    const chart = createChart(container, {
      layout: {
        background: { color: "transparent" },
        textColor: `${line}${dark ? "0.4" : "0.45"})`,
        fontFamily: "'Inter Variable', sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: `${line}${dark ? "0.04" : "0.04"})` },
        horzLines: { color: `${line}0.06)` },
      },
      rightPriceScale: {
        borderVisible: false,
        // Room at the bottom for the volume bars to sit without overlapping
        // the price action.
        scaleMargins: { top: 0.08, bottom: 0.24 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: `${line}0.35)`,
          width: 1,
          style: 3,
          labelBackgroundColor: dark ? "#232327" : "#0A0A0A",
        },
        horzLine: {
          color: `${line}0.35)`,
          width: 1,
          style: 3,
          labelBackgroundColor: dark ? "#232327" : "#0A0A0A",
        },
      },
      autoSize: true,
    });

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: gain,
      downColor: loss,
      borderUpColor: gain,
      borderDownColor: loss,
      wickUpColor: gain,
      wickDownColor: loss,
      // The moving marker on the price axis — without it there's no visual
      // anchor for "where the market is right now".
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
    });

    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    // Its own scale, squeezed into the bottom fifth of the pane.
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;

    // autoSize widens the canvas when the container settles, but the bar
    // spacing chosen by an earlier fitContent survives that — which leaves the
    // series bunched to the left with dead space beside it. Re-fit on resize.
    const observer = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      candleRef.current = null;
      volumeRef.current = null;
      chartRef.current = null;
      entryLineRef.current = null;
      chart.remove();
    };
  }, [theme]);

  useEffect(() => {
    if (!candleRef.current || !data?.length) return;

    const { gain, loss } = palette();

    // Set before the data, so the first paint of the axis already carries
    // enough decimals for this market rather than rounding it to nothing.
    const precision = precisionFor(data.at(-1)?.close);
    candleRef.current.applyOptions({
      priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
    });

    candleRef.current.setData(data);

    if (volumeRef.current && data[0]?.volume != null) {
      volumeRef.current.setData(
        data.map((bar) => ({
          time: bar.time,
          value: bar.volume,
          // Tint each bar by whether that candle closed up, so volume reads
          // as buying or selling pressure at a glance.
          color: `${bar.close >= bar.open ? gain : loss}44`,
        })),
      );
    }

    // After the browser has laid the container out, so the fit uses the real
    // width rather than whatever it was mid-render.
    const frame = requestAnimationFrame(() => chartRef.current?.timeScale().fitContent());
    return () => cancelAnimationFrame(frame);
  }, [data]);

  /**
   * The entry line: where this position was opened, drawn across the chart the
   * way every terminal draws it, so the candles can be read against your cost
   * rather than against nothing.
   *
   * The line itself carries no title — lightweight-charts renders that as a
   * hard-edged block in the line's own colour, which reads as a warning rather
   * than a readout. The tag below is HTML, so it can be styled like the rest
   * of the interface.
   */
  useEffect(() => {
    const series = candleRef.current;
    if (!series || entry == null) return;

    const tokens = getComputedStyle(document.documentElement);
    const neutral = tokens.getPropertyValue("--color-brand").trim() || "#F5A524";

    const priceLine = series.createPriceLine({
      // Neutral until a tick says which way the position is running: the line
      // marks where you got in, which is true before any P&L is known.
      price: entry,
      color: `${neutral}99`,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: "",
    });

    entryLineRef.current = priceLine;

    return () => {
      // The series owns the line, so it only needs removing while the series
      // still exists — on unmount the whole chart goes with it.
      if (candleRef.current) candleRef.current.removePriceLine(priceLine);
      entryLineRef.current = null;
    };
  }, [entry, theme]);

  /** Recolour the line as the position moves between profit and loss. */
  useEffect(() => {
    const priceLine = entryLineRef.current;
    if (!priceLine || pnl == null) return;

    const { gain, loss } = palette();
    // Held at partial opacity: this is a reference, not the price action, and
    // a full-strength rule across the pane competes with the candles.
    priceLine.applyOptions({ color: `${pnl >= 0 ? gain : loss}99` });
  }, [pnl]);

  /**
   * Pin the tag to the line.
   *
   * Recomputed on every tick because the price scale rescales as the market
   * moves, which shifts where a fixed price sits in the pane. Deferred to a
   * frame so the measurement reads a laid-out canvas.
   */
  useEffect(() => {
    const series = candleRef.current;
    const chart = chartRef.current;
    if (!series || !chart || entry == null) return;

    const frame = requestAnimationFrame(() => {
      const y = series.priceToCoordinate(entry);
      setMarker(y == null ? null : { y, axis: chart.priceScale("right").width() });
    });

    return () => cancelAnimationFrame(frame);
  }, [entry, livePrice, data, theme]);

  /**
   * Klines are a snapshot; the market keeps moving. Every tick from the live
   * feed rewrites the newest candle — close follows the price, high and low
   * stretch to contain it — so the rightmost bar grows in real time the way it
   * does on a real terminal, instead of freezing at whatever the last REST
   * response happened to say.
   */
  useEffect(() => {
    const series = candleRef.current;
    const last = data?.at(-1);
    if (!series || !last || livePrice == null) return;

    series.update({
      time: last.time,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    });
  }, [livePrice, data]);

  const up = pnl != null && pnl >= 0;
  const decimals = precisionFor(entry);
  const entryLabel = entry?.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {marker && pnl != null && (
        <div
          // Sits on the line and stops just short of the price axis, the way a
          // position tag does on a real terminal.
          className="pointer-events-none absolute z-10 -translate-y-1/2"
          style={{ top: marker.y, right: marker.axis + 6 }}
        >
          <div
            className={`flex items-center gap-2 rounded-md border py-1 pr-2 pl-1.5 text-[11px] whitespace-nowrap backdrop-blur-sm ${
              up
                ? "border-gain/40 bg-gain/15 text-gain"
                : "border-loss/40 bg-loss/15 text-loss"
            }`}
          >
            <span
              className={`rounded-sm px-1.5 py-px text-[9px] font-bold tracking-wide ${
                up ? "bg-gain/25" : "bg-loss/25"
              }`}
            >
              {quantity < 0 ? "SHORT" : "LONG"}
            </span>
            <span className="tabular text-foreground/70">{entryLabel}</span>
            <span className="tabular font-semibold">
              {up ? "+" : "−"}$
              {Math.abs(pnl).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="tabular opacity-80">
              {up ? "+" : "−"}
              {Math.abs(pnlPct).toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
