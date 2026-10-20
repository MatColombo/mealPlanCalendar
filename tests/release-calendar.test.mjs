import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../src/data/state.js';
import { readDietDocument } from '../src/data/diet.js';
import { previewImport, prepareImport, undoLastImport } from '../src/data/imports.js';
import { findEntry, getDayEntries, setEntryDate, setEntryServings, setEntryTime } from '../src/data/session.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { exportCalendarDiet } from '../src/data/export.js';

const NOW = '2026-01-01T12:00:00.000Z';
const LATER = '2026-01-01T13:00:00.000Z';
const SOURCE_DATES = ['2026-01-05', '2026-01-06', '2026-01-08'];
const TIMES = ['23:45', '02:30', '00:15'];

// Calendar-only records, deliberately without ingredients or nutrition.
// Existing suites cover ordinary confirmation, transactions and editing;
// these cases add real timezone transitions and integrated date boundaries.
function fixture(planId, dates = SOURCE_DATES) {
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: 'Registrazioni sintetiche del calendario', language: 'it',
    createdAt: NOW, suggestedStartDate: dates[0], baseServings: 1,
    extension: { purpose: 'technical calendar fixture' },
    days: dates.map((date, index) => ({
      date,
      meals: [{
        mealId: `${planId}-${index}`, title: `Registrazione ${index + 1}`,
        type: 'other', time: TIMES[index], ingredients: [],
      }],
    })),
  };
}

function importAt(state, document, startDate, options = {}) {
  return prepareImport(state, document, { startDate, dateConfirmed: true, now: NOW, ...options });
}

// Each callback is synchronous, so the temporary timezone cannot span an
// asynchronous test or leak into another case, including in the serial
// shared-process suite. Restore the caller's environment on failure.
function inRome(callback) {
  const previous = process.env.TZ;
  process.env.TZ = 'Europe/Rome';
  try {
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Rome');
    callback();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

for (const transition of [
  { name: 'spring', assigned: ['2026-03-28', '2026-03-29', '2026-03-31'], offsets: [-60, -120], hours: 23 },
  { name: 'autumn', assigned: ['2026-10-24', '2026-10-25', '2026-10-27'], offsets: [-120, -60], hours: 25 },
]) {
  test(`Europe/Rome ${transition.name}: imports and edits retain civil dates and clock text across a ${transition.hours}-hour day`, () => inRome(() => {
    const noonBefore = new Date(transition.assigned[0] + 'T12:00:00');
    const noonAfter = new Date(transition.assigned[1] + 'T12:00:00');
    // Prove this case really runs under the intended DST transition, rather
    // than merely naming a transition date while the runner remains in UTC.
    assert.deepEqual([noonBefore.getTimezoneOffset(), noonAfter.getTimezoneOffset()], transition.offsets);
    assert.equal((noonAfter - noonBefore) / 3_600_000, transition.hours);

    const document = readDietDocument(JSON.stringify(fixture(`rome-${transition.name}`)));
    const initial = createAppState({ now: NOW });
    const preview = previewImport(initial, document, transition.assigned[0]);
    assert.deepEqual(preview.dayMappings.map(day => [day.sourceDate, day.assignedDate]),
      SOURCE_DATES.map((date, index) => [date, transition.assigned[index]]));
    assert.equal(preview.endDate, transition.assigned[2]);
    const imported = importAt(initial, document, transition.assigned[0]);
    assert.deepEqual(Object.keys(imported.state.calendar).sort(), transition.assigned);
    assert.deepEqual(transition.assigned.map(date => getDayEntries(imported.state, date)[0].time), TIMES);
    // 02:30 remains a civil-time string even when skipped or repeated by the
    // local clock; the app does not turn planned meal times into timestamps.
    const original = getDayEntries(imported.state, transition.assigned[1])[0];
    let edited = setEntryTime(setEntryServings(imported.state, original.entry.entryId, 2), original.entry.entryId, '02:15');
    const expectedEntry = { ...original.entry, cookingServings: 2, timeOverride: '02:15' };
    edited = setEntryDate(edited, original.entry.entryId, transition.assigned[0], { now: LATER });
    assert.deepEqual(getDayEntries(edited, transition.assigned[0]).map(row => row.time), ['02:15', '23:45']);
    edited = setEntryDate(edited, original.entry.entryId, transition.assigned[2], { now: LATER });
    assert.deepEqual(getDayEntries(edited, transition.assigned[2]).map(row => row.time), ['00:15', '02:15']);
    assert.deepEqual(getDayEntries(edited, transition.assigned[1]), []);
    assert.deepEqual(findEntry(edited, original.entry.entryId).entry, expectedEntry);
    assert.deepEqual(edited.sourcePlans[imported.sourceId].document, document);
    assert.deepEqual(edited.shopping.range, { startDate: transition.assigned[0], endDate: transition.assigned[2] });

    const restored = readBackup(JSON.stringify(createBackup(edited, { now: LATER })));
    const moved = findEntry(restored, original.entry.entryId);
    assert.equal(moved.date, transition.assigned[2]);
    assert.equal(moved.time, '02:15');
    assert.equal(moved.cookingServings, 2);
    const exported = exportCalendarDiet(restored, { sourceId: imported.sourceId, now: LATER });
    const exportedMeal = exported.days.find(day => day.date === transition.assigned[2]).meals
      .find(meal => meal.title === original.meal.title);
    assert.equal(exportedMeal.time, '02:15');
    assert.equal(document.days[1].meals[0].time, '02:30');
  }));
}

test('year and leap-month boundary imports replace only their mapped dates and undo restores the exact prior days', () => {
  for (const boundary of [
    { name: 'year', source: ['2026-02-27', '2026-03-01', '2026-03-02'],
      assigned: ['2026-12-30', '2027-01-01', '2027-01-02'], gap: '2026-12-31' },
    { name: 'leap-month-backward', source: ['2026-06-29', '2026-07-01', '2026-07-02'],
      assigned: ['2024-02-27', '2024-02-29', '2024-03-01'], gap: '2024-02-28' },
  ]) {
    const existing = fixture(`prior-${boundary.name}`, [boundary.assigned[0], boundary.gap, boundary.assigned[2]]);
    const prior = importAt(createAppState({ now: NOW }), existing, boundary.assigned[0]);
    const oldId = getDayEntries(prior.state, boundary.assigned[0])[0].entry.entryId;
    const gapId = getDayEntries(prior.state, boundary.gap)[0].entry.entryId;
    const current = setEntryTime(setEntryServings(prior.state, oldId, 3), oldId, '06:45');
    current.calendar[boundary.assigned[1]] = {
      date: boundary.assigned[1], meals: [], extension: { preserve: 'intentionally empty date' },
    };
    const before = structuredClone(current);
    const incoming = readDietDocument(JSON.stringify(fixture(`incoming-${boundary.name}`, boundary.source)));
    const preview = previewImport(current, incoming, boundary.assigned[0]);
    assert.deepEqual(preview.dayMappings.map(day => day.assignedDate), boundary.assigned, boundary.name);
    assert.deepEqual(preview.overlaps, [boundary.assigned[0], boundary.assigned[2]], boundary.name);
    assert.equal(preview.startDate, boundary.assigned[0]);
    assert.equal(preview.endDate, boundary.assigned[2]);
    assert.equal(preview.dayCount, 3);
    assert.throws(() => importAt(current, incoming, boundary.assigned[0]), {
      code: 'SESSION_IMPORT_OVERLAP', overlaps: preview.overlaps,
    });
    assert.deepEqual(current, before);

    const replacement = importAt(current, incoming, boundary.assigned[0], { overwrite: true, now: LATER });
    assert.deepEqual(replacement.state.calendar[boundary.gap], before.calendar[boundary.gap]);
    assert.deepEqual(replacement.state.imports.at(-1).overwrittenDates, preview.overlaps);
    for (const date of boundary.assigned) {
      assert.equal(replacement.state.calendar[date].meals.length, 1);
      assert.equal(replacement.state.calendar[date].meals[0].sourceId, replacement.sourceId);
    }
    // A populated day inside the overall date interval but absent from the
    // imported mapping must retain even edits made after the replacement.
    const editedGap = setEntryTime(setEntryServings(replacement.state, gapId, 4), gapId, '21:10');
    const undone = undoLastImport(editedGap, { now: LATER });
    for (const date of boundary.assigned) assert.deepEqual(undone.calendar[date], before.calendar[date]);
    assert.deepEqual(undone.calendar[boundary.gap], editedGap.calendar[boundary.gap]);
    assert.deepEqual(undone.sourcePlans[prior.sourceId].document, existing);
    assert.equal(undone.imports.at(-1).status, 'undone');
    assert.equal(undone.lastImportUndo, null);
    assert.deepEqual(current, before);
  }
});
