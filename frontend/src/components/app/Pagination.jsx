import { PAGE_SIZE, pageNumbers } from "@/lib/paging";

const STEP =
  "rounded-full border border-line px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line disabled:hover:text-muted-foreground";

/**
 * The footer every paged list ends with: what you are looking at on the left,
 * the controls on the right. Renders nothing for a single page — a pager that
 * can only say "1 of 1" is furniture.
 */
export default function Pagination({ page, pageCount, total, size = PAGE_SIZE, onChange }) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
      <p className="tabular text-xs text-faint">
        {(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}
      </p>

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className={STEP}>
          Previous
        </button>

        {pageNumbers(page, pageCount).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onChange(number)}
            aria-current={number === page ? "page" : undefined}
            className={`tabular size-8 rounded-full text-xs transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
              number === page
                ? "bg-brand font-semibold text-ink"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {number}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === pageCount}
          className={STEP}
        >
          Next
        </button>
      </div>
    </div>
  );
}
