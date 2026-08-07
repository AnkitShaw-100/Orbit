import { useState } from "react";
import { coinMeta } from "@/lib/markets";

/**
 * Coin logos, resolved in three steps.
 *
 * 1. The bundled cryptocurrency-icons set — instant, self-hosted, and covers
 *    the majors people look at most, so the common case needs no network.
 * 2. CoinCap's CDN for the long tail. Binance lists faster than any packaged
 *    icon set updates, so newer tokens (PEPE, SUI, TON, ONDO) only exist here.
 * 3. A lettered badge tinted by a hash of the ticker, so anything with no
 *    artwork anywhere still looks deliberate rather than broken.
 */
const LOCAL = import.meta.glob("../../../node_modules/cryptocurrency-icons/svg/color/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const BY_TICKER = Object.fromEntries(
  Object.entries(LOCAL).map(([path, url]) => [
    path.split("/").pop().replace(".svg", "").toUpperCase(),
    url,
  ]),
);

const remoteUrl = (ticker) =>
  `https://assets.coincap.io/assets/icons/${ticker.toLowerCase()}@2x.png`;

/** Stable hue per ticker, so a coin's badge colour never changes between views. */
function hueFor(ticker) {
  let hash = 0;
  for (let index = 0; index < ticker.length; index += 1) {
    hash = (hash * 31 + ticker.charCodeAt(index)) % 360;
  }
  return hash;
}

export default function CoinIcon({ symbol, ticker, className = "size-5" }) {
  const meta = coinMeta(symbol ?? `${ticker}USDT`);
  const local = BY_TICKER[meta.ticker];
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src={local ?? remoteUrl(meta.ticker)}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} rounded-full object-contain`}
      />
    );
  }

  const hue = hueFor(meta.ticker);
  return (
    <span
      aria-hidden="true"
      className={`${className} grid place-items-center rounded-full text-[8px] font-bold uppercase leading-none`}
      style={{
        backgroundColor: meta.color ? `${meta.color}2E` : `hsl(${hue} 60% 50% / 0.22)`,
        color: meta.color ?? `hsl(${hue} 70% 72%)`,
      }}
    >
      {meta.ticker.slice(0, 3)}
    </span>
  );
}
