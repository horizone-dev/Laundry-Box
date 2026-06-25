import React from 'react';
import styles from './Pagination.module.css';

/**
 * Smart Pagination Component
 * Shows: First | Prev | ... | [n-2][n-1][n][n+1][n+2] | ... | Next | Last
 * Handles any number of pages gracefully with ellipsis truncation.
 *
 * Props:
 *  - currentPage   {number}   - 1-indexed current page
 *  - totalPages    {number}   - total page count
 *  - onPageChange  {function} - called with new page number
 *  - totalItems    {number}   - total record count
 *  - pageSize      {number}   - records per page
 *  - itemLabel     {string}   - e.g. "orders", "customers" (default: "records")
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  pageSize = 20,
  itemLabel = 'records',
}) {
  if (totalPages <= 1) return null;

  const startItem = Math.min(totalItems, (currentPage - 1) * pageSize + 1);
  const endItem   = Math.min(totalItems, currentPage * pageSize);

  // Build the window of page numbers to show
  const getPageNumbers = () => {
    const delta = 2; // pages on each side of current
    const pages = [];

    // always show first page
    pages.push(1);

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd   = Math.min(totalPages - 1, currentPage + delta);

    if (rangeStart > 2) pages.push('...');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push('...');

    // always show last page
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{' '}
        <strong>{totalItems}</strong> {itemLabel}
      </span>

      <div className={styles.paginationBtns}>
        {/* First */}
        <button
          className={styles.pageBtn}
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          title="First page"
        >
          «
        </button>

        {/* Previous */}
        <button
          className={styles.pageBtn}
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          title="Previous page"
        >
          ‹
        </button>

        {/* Page numbers with ellipsis */}
        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              className={`${styles.pageBtn} ${currentPage === p ? styles.active : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          className={styles.pageBtn}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          title="Next page"
        >
          ›
        </button>

        {/* Last */}
        <button
          className={styles.pageBtn}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
        >
          »
        </button>

        {/* Jump to page input */}
        <JumpToPage currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

function JumpToPage({ currentPage, totalPages, onPageChange }) {
  const [value, setValue] = React.useState('');

  const handleJump = (e) => {
    e.preventDefault();
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
    }
    setValue('');
  };

  return (
    <form className={styles.jumpForm} onSubmit={handleJump}>
      <span className={styles.jumpLabel}>Go to</span>
      <input
        className={styles.jumpInput}
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={String(currentPage)}
      />
      <button type="submit" className={styles.jumpBtn}>Go</button>
    </form>
  );
}
