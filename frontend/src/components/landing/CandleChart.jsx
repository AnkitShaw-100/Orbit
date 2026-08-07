import { useEffect, useRef } from "react";
import { CandlestickSeries, HistogramSeries, createChart } from "lightweight-charts";

/**
 * Candlestick chart with a volume histogram beneath it.
 *
 * Volume shares the price pane rather than taking its own, pinned to the lower
 * fifth — the arrangement every trading terminal uses, because volume is read
 * against the candle directly above it.
 *
 * Colours come from the CSS tokens rather than repeated hex values, so the
 * chart follows --color-gain / --color-loss like every other price in the UI.
 */
export default function CandleChart({ data, theme = "light", livePrice }) {
  const containerRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dark = theme === "dark";
    const line = dark ? "rgba(255,255,255," : "rgba(10,10,10,";

    const tokens = getComputedStyle(document.documentElement);
    const gain = tokens.getPropertyValue("--color-gain").trim() || "#2DD4BF";
    const loss = tokens.getPropertyValue("--color-loss").trim() || "#EF5350";

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
      chart.remove();
    };
  }, [theme]);

  useEffect(() => {
    if (!candleRef.current || !data?.length) return;

    const tokens = getComputedStyle(document.documentElement);
    const gain = tokens.getPropertyValue("--color-gain").trim() || "#2DD4BF";
    const loss = tokens.getPropertyValue("--color-loss").trim() || "#EF5350";

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

  return <div ref={containerRef} className="h-full w-full" />;
}
