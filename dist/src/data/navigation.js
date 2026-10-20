/** Pure routes: today's clock and the last selected calendar date are separate. */
import { addDays } from './dates.js';

const VIEWS = new Set(['today', 'calendar', 'shopping', 'import', 'export', 'settings']);

function validDate(value) {
  try { return addDays(value, 0) === value; }
  catch { return false; }
}

function requireToday(today) {
  if (!validDate(today)) {
    throw Object.assign(new RangeError('Supply today as a valid local calendar date.'), { code: 'SESSION_INVALID_DATE' });
  }
}

/** Resolve a calendar display date without recording a selection or reading a clock. */
export function getSelectedCalendarDate(ui, today) {
  requireToday(today);
  return validDate(ui?.selectedDate) ? ui.selectedDate : today;
}

/**
 * Select a view and return its canonical hash plus a new UI object. Only
 * entering Calendar records a selectedDate. Other views retain the previous
 * calendar selection, including null before Calendar has ever been visited.
 * The Today screen renders the supplied local `today`, not selectedDate.
 */
export function resolveNavigation(ui, { view = ui?.view, date = null, today } = {}) {
  requireToday(today);
  const target = VIEWS.has(view) ? view : 'today';
  const previousDate = validDate(ui?.selectedDate) ? ui.selectedDate : null;
  const selectedDate = target === 'calendar'
    ? validDate(date) ? date : previousDate ?? today
    : previousDate;
  const next = { ...ui, view: target, selectedDate };
  return { ui: next, hash: `#${target}${target === 'calendar' ? `/${selectedDate}` : ''}` };
}

/**
 * A recognized URL view wins over the saved view. Empty or unknown routes use
 * the saved UI; Calendar without a readable date uses its saved selection, or
 * today's local date if there is none. Resolve after loading saved state, so
 * an incomplete startup hash cannot replace that selection prematurely.
 */
export function resolveRoute(ui, { hash = '', today } = {}) {
  let view = VIEWS.has(ui?.view) ? ui.view : 'today';
  let date = null;
  if (typeof hash === 'string' && hash.startsWith('#')) {
    const [requestedView, requestedDate, ...extra] = hash.slice(1).split('/');
    if (VIEWS.has(requestedView) && extra.length === 0
      && (requestedView === 'calendar' || requestedDate === undefined)) {
      view = requestedView;
      if (view === 'calendar') date = requestedDate ?? null;
    }
  }
  return resolveNavigation(ui, { view, date, today });
}
