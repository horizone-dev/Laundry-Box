/**
 * dateUtils.js
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for ALL date/time operations.
 * Uses LOCAL time — never UTC — so filters, reports, and
 * account views are always correct regardless of timezone.
 */

/**
 * Returns current local datetime as "YYYY-MM-DD HH:MM" string.
 * Use this wherever you previously used:
 *   new Date().toISOString().replace('T', ' ').slice(0, 16)
 */
export const getLocalDateTime = () => {
  const now = new Date();
  const year  = now.getFullYear();
  const month  = String(now.getMonth() + 1).padStart(2, '0');
  const day    = String(now.getDate()).padStart(2, '0');
  const hours  = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

/**
 * Returns current local date as "YYYY-MM-DD" string.
 * Use this wherever you previously used:
 *   new Date().toISOString().split('T')[0]
 * (for things like file download names, date pickers, etc.)
 */
export const getLocalDateStr = () => {
  const now = new Date();
  return (
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')}`
  );
};

/**
 * Returns a full ISO-8601 timestamp in LOCAL time offset (not UTC).
 * Suitable for updatedAt / createdAt columns that compare against ISO strings.
 * Example output: "2026-06-07T10:55:03+04:00"
 */
export const getLocalISOString = () => {
  const now = new Date();
  const offsetMs   = -now.getTimezoneOffset() * 60000;
  const offsetSign = offsetMs >= 0 ? '+' : '-';
  const absOffset  = Math.abs(now.getTimezoneOffset());
  const offsetH    = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetM    = String(absOffset % 60).padStart(2, '0');
  const local = new Date(now.getTime() + offsetMs);
  return local.toISOString().replace('Z', `${offsetSign}${offsetH}:${offsetM}`);
};
