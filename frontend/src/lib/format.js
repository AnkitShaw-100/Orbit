const COMPACT_PRICE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SMALL_PRICE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Sub-dollar coins need more decimals to say anything useful. */
export function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return value >= 1 ? COMPACT_PRICE.format(value) : SMALL_PRICE.format(value);
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

/** 24h volumes run into the billions; compact keeps the column readable. */
export function formatVolume(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return COMPACT.format(value);
}

export function formatUsd(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${COMPACT_PRICE.format(value)}`;
}
