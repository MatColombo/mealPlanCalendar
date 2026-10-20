/**
 * Calendar-only dates. UTC is used for arithmetic, never to interpret a user's
 * local midnight. This avoids changing a day when clocks move for DST.
 */
const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @param {string} iso @returns {Date} */
function calendarDate(iso) {
  const match = typeof iso === 'string' ? ISO_DATE.exec(iso) : null;
  if (!match) throw new RangeError('Expected a calendar date in YYYY-MM-DD format.');

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(0);
  // setUTCFullYear also handles years 0000–0099 without Date.UTC's 1900 offset.
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new RangeError('Invalid calendar date.');
  }
  return date;
}

/** Today's civil date in the browser/device's local timezone. @returns {string} */
export function todayISO() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

/** @param {string} iso @param {number} n Whole calendar days. @returns {string} */
export function addDays(iso, n) {
  if (!Number.isSafeInteger(n)) throw new TypeError('The day offset must be a safe integer.');
  const date = calendarDate(iso);
  date.setUTCDate(date.getUTCDate() + n);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 0 || year > 9999) {
    throw new RangeError('The result is outside the YYYY-MM-DD date range.');
  }
  return date.toISOString().slice(0, 10);
}

/** Signed number of calendar days from one civil date to another. */
export function daysBetween(from, to) {
  return (calendarDate(to).getTime() - calendarDate(from).getTime()) / DAY_MS;
}
