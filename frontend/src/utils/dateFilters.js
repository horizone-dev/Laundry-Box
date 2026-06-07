/**
 * dateFilters.js
 * ─────────────────────────────────────────────────────────────
 * Shared helpers for date filtering across all pages.
 * All helpers use LOCAL time so filters work correctly in any timezone.
 */

/**
 * Returns today's date string in YYYY-MM-DD local time (not UTC).
 */
export function localTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Formats a Date object to a local YYYY-MM-DD HH:MM string.
 * Use this when inserting into account_transactions.date column.
 */
export function toLocalDateTimeStr(date = new Date()) {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')} ` +
    `${String(date.getHours()).padStart(2, '0')}:` +
    `${String(date.getMinutes()).padStart(2, '0')}`
  );
}

/**
 * Returns a { from: Date, to: Date } bound for the given dateRange string.
 * Returns null for "All" or "All Time".
 * Returns false for "Custom" when customStart/customEnd are missing.
 *
 * @param {string} dateRange  - "Today" | "This Week" | "This Month" | "This Year" | "Custom" | "All" | "All Time"
 * @param {string} customStart - YYYY-MM-DD string (required when dateRange === "Custom")
 * @param {string} customEnd   - YYYY-MM-DD string (required when dateRange === "Custom")
 */
export function getLocalDateBounds(dateRange, customStart = '', customEnd = '') {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (dateRange === 'Today') {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { from: today, to: end };
  }

  if (dateRange === 'This Week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay()); // Sunday start
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (dateRange === 'This Month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (dateRange === 'This Year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  if (dateRange === 'Custom') {
    if (!customStart || !customEnd) return false; // signal: missing custom range
    const [sy, sm, sd] = customStart.split('-').map(Number);
    const [ey, em, ed] = customEnd.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  return null; // "All" or "All Time" — no bounds
}

/**
 * Returns true if the given ISO date string (e.g. orders.createdAt) falls within bounds.
 * bounds is the return value of getLocalDateBounds().
 */
export function isWithinBounds(isoDateStr, bounds) {
  if (!bounds || bounds === false) return bounds !== false; // null = show all, false = show none
  const d = new Date(isoDateStr);
  return d >= bounds.from && d <= bounds.to;
}

/**
 * Safely parses a stored date string into a local midnight Date object.
 *
 * Handles two formats:
 *  - ISO 8601:  "2026-06-06T22:47:00.000Z"  (old UTC rows, pre-migration)
 *               → parsed through JS Date (applies device timezone) → local date
 *  - Local str: "2026-06-07 10:55"           (new local-time rows, post-migration)
 *               → parsed directly as local date, no shift applied
 *
 * Returns a Date at midnight of the LOCAL calendar date, or null on failure.
 */
export function parseLocalDateStr(dateStr) {
  if (!dateStr) return null;

  // ISO format: contains 'T' or ends with 'Z'
  if (dateStr.includes('T') || dateStr.endsWith('Z')) {
    const d = new Date(dateStr); // JS applies device timezone offset automatically
    if (isNaN(d)) return null;
    // Normalise to local midnight so date comparisons work correctly
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  // Local format: "YYYY-MM-DD HH:MM[:SS]" — parse date part only, no offset
  const datePart = dateStr.split(' ')[0]; // "YYYY-MM-DD"
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
  return new Date(y, m, day, 0, 0, 0, 0);
}

/**
 * Returns true if a date string (ISO or local "YYYY-MM-DD HH:MM") falls within bounds.
 * bounds is the return value of getLocalDateBounds().
 */
export function localStrIsWithinBounds(dateStr, bounds) {
  if (!bounds || bounds === false) return bounds !== false;
  const d = parseLocalDateStr(dateStr);
  if (!d) return false;
  return d >= bounds.from && d <= bounds.to;
}
