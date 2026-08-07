/** Tiny inline trend line for the markets table — shape only, no axes. */
function buildPoints(seed, width, height) {
  let state = seed * 9301 + 49297;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };

  const steps = 22;
  return Array.from({ length: steps }, (_, index) => {
    const x = (index / (steps - 1)) * width;
    const y = height / 2 + Math.sin(index / 2.4 + seed) * (height / 3.4) + (next() - 0.5) * 5;
    return `${x.toFixed(1)},${Math.min(height - 1, Math.max(1, y)).toFixed(1)}`;
  }).join(" ");
}

export default function Sparkline({ seed = 3, width = 96, height = 30 }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline
        points={buildPoints(seed, width, height)}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
