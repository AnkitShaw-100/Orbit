/**
 * The Orbit mark: a ring and its centre.
 *
 * The ring is stroked rather than drawn as a CSS border, which is the whole
 * point of it being a component — the header used to draw it with a 1px border
 * at 40% gold while the favicon stroked it solid at more than twice that
 * weight, so the two never looked like the same logo. One drawing, one weight,
 * everywhere.
 *
 * Geometry is duplicated verbatim in public/favicon.svg — a static file cannot
 * import this — so any change here needs the same change there.
 */
export default function OrbitMark({ className = "size-7", title }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
    </svg>
  );
}
