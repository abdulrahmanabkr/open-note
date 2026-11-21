import { ArrowLeftIcon, ArrowRightIcon } from './Icons';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: Array<number | 'gap'> = [];
  const push = (value: number | 'gap') => pages.push(value);
  const windowStart = Math.max(1, Math.min(page - 1, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);

  if (windowStart > 1) {
    push(1);
    if (windowStart > 2) push('gap');
  }
  for (let index = windowStart; index <= windowEnd; index += 1) push(index);
  if (windowEnd < totalPages) {
    if (windowEnd < totalPages - 1) push('gap');
    push(totalPages);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ArrowLeftIcon size={17} /> Prev
      </button>
      <div className="pagination__pages">
        {pages.map((value, index) =>
          value === 'gap' ? (
            <span key={`gap-${index}`} className="pagination__gap">
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              className={value === page ? 'is-active' : ''}
              aria-current={value === page ? 'page' : undefined}
              onClick={() => onChange(value)}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        Next <ArrowRightIcon size={17} />
      </button>
    </nav>
  );
}
