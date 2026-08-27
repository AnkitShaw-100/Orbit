/** Rows per page, shared by every paged list so they all scroll alike. */
export const PAGE_SIZE = 12;

/** Most page buttons rendered at once, so a long list cannot grow a rail. */
const PAGE_WINDOW = 7;

/**
 * The page numbers to render, windowed around the current page.
 *
 * Orbit lists a hundred markets and a paper trader can close hundreds of
 * positions; listing every page would grow a rail of buttons wider than the
 * table it belongs to.
 */
export function pageNumbers(current, count) {
  if (count <= PAGE_WINDOW) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  const half = Math.floor(PAGE_WINDOW / 2);
  const start = Math.min(Math.max(current - half, 1), count - PAGE_WINDOW + 1);
  return Array.from({ length: PAGE_WINDOW }, (_, index) => start + index);
}

/**
 * How many pages a list needs, and which one to actually show.
 *
 * Clamped, because a list can shrink under a stored page number — filter a
 * hundred rows down to five while on page 4 and there is no page 4 any more.
 */
export function pageOf(page, total, size = PAGE_SIZE) {
  const count = Math.max(1, Math.ceil(total / size));
  return { count, current: Math.min(page, count) };
}
