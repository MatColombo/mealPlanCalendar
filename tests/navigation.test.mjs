import test from 'node:test';
import assert from 'node:assert/strict';
import { getSelectedCalendarDate, resolveNavigation, resolveRoute } from '../src/data/navigation.js';

const TODAY = '2026-10-19';
const TOMORROW = '2026-10-20';
const SELECTED = '2026-11-03';

test('reopening without a usable hash resumes saved view and calendar selection without mutation', () => {
  const saved = { view: 'calendar', selectedDate: SELECTED, extension: { retained: true } };
  const original = structuredClone(saved);
  for (const hash of ['', '#', '#unknown', '#calendar/2026-11-05/extra']) {
    const resolved = resolveRoute(saved, { hash, today: TODAY });
    assert.deepEqual(resolved, { ui: saved, hash: `#calendar/${SELECTED}` });
    assert.notEqual(resolved.ui, saved);
  }
  assert.deepEqual(saved, original);
  assert.equal(resolveRoute({ view: 'unknown', selectedDate: null }, { today: TODAY }).hash, '#today');
});

test('a recognized hash wins, while incomplete or invalid calendar dates use the persisted selection', () => {
  const saved = { view: 'shopping', selectedDate: SELECTED };
  assert.deepEqual(resolveRoute(saved, { hash: '#calendar/2026-12-01', today: TODAY }), {
    ui: { view: 'calendar', selectedDate: '2026-12-01' }, hash: '#calendar/2026-12-01',
  });
  for (const hash of ['#calendar', '#calendar/', '#calendar/2026-02-30', '#calendar/not-a-date']) {
    assert.deepEqual(resolveRoute(saved, { hash, today: TODAY }), {
      ui: { view: 'calendar', selectedDate: SELECTED }, hash: `#calendar/${SELECTED}`,
    });
  }
  assert.deepEqual(resolveRoute(saved, { hash: '#settings', today: TODAY }), {
    ui: { view: 'settings', selectedDate: SELECTED }, hash: '#settings',
  });
});

test('visiting Today or another view keeps the last Calendar selection for the return trip', () => {
  const selected = resolveNavigation({ view: 'today', selectedDate: null }, {
    view: 'calendar', date: SELECTED, today: TODAY,
  }).ui;
  const today = resolveNavigation(selected, { view: 'today', date: TODAY, today: TODAY });
  assert.deepEqual(today, { ui: { view: 'today', selectedDate: SELECTED }, hash: '#today' });
  const shopping = resolveNavigation(today.ui, { view: 'shopping', today: TODAY });
  const returned = resolveNavigation(shopping.ui, { view: 'calendar', today: TODAY });
  assert.deepEqual(returned, { ui: { view: 'calendar', selectedDate: SELECTED }, hash: `#calendar/${SELECTED}` });
  assert.equal(getSelectedCalendarDate(today.ui, TODAY), SELECTED);
});

test('an unvisited Calendar keeps null until first entry and then uses the current local day', () => {
  const initial = { view: 'today', selectedDate: null };
  const today = resolveNavigation(initial, { view: 'today', today: TODAY }).ui;
  const settings = resolveNavigation(today, { view: 'settings', today: TODAY }).ui;
  assert.equal(settings.selectedDate, null);
  assert.equal(getSelectedCalendarDate(settings, TODAY), TODAY);
  assert.equal(getSelectedCalendarDate(settings, TOMORROW), TOMORROW);
  assert.equal(settings.selectedDate, null);
  const firstVisit = resolveRoute(settings, { hash: '#calendar', today: TOMORROW });
  assert.deepEqual(firstVisit, { ui: { view: 'calendar', selectedDate: TOMORROW }, hash: `#calendar/${TOMORROW}` });
});

test('back/forward routes and a local-day rollover keep explicit calendar dates stable', () => {
  const previous = { view: 'calendar', selectedDate: SELECTED };
  const back = resolveRoute(previous, { hash: '#today', today: TODAY });
  const nextDay = resolveRoute(back.ui, { hash: '#today', today: TOMORROW });
  assert.equal(nextDay.ui.selectedDate, SELECTED);
  assert.equal(nextDay.hash, '#today');
  const forward = resolveRoute(nextDay.ui, { hash: '#calendar/2026-10-25', today: TOMORROW });
  assert.equal(forward.ui.selectedDate, '2026-10-25');
  assert.deepEqual(previous, { view: 'calendar', selectedDate: SELECTED });
  assert.throws(() => resolveNavigation(previous, { today: '2026-02-30' }), { code: 'SESSION_INVALID_DATE' });
  assert.equal(getSelectedCalendarDate({ selectedDate: 'invalid' }, TOMORROW), TOMORROW);
});
