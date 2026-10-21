import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { applySessionImport, getDayEntries, getDayWorkday, readablePlan, setEntryDate, setEntryServings, setEntryTime } from '../src/data/session.js';
import { prepareImport, previewImport, undoLastImport } from '../src/data/imports.js';
import { exportCalendarDiet, exportSourceDiet } from '../src/data/export.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';

const NOW = '2026-10-21T12:00:00.000Z';
const LATER = '2026-10-21T13:00:00.000Z';
const START = '2026-12-30';
const MAPPED_DATES = ['2026-12-30', '2027-01-01', '2027-01-02'];

// Synthetic calendar records: these checks transport metadata and references.
// They do not judge recipes, supplied nutrition, targets or food frequencies.
function fixture(planId = 'synthetic-workdays') {
  const contexts = [
    { class: 'night-shift', startTime: '22:15', endTime: '06:45', endDayOffset: 1, label: 'Turno A', extension: { keep: true } },
    { class: 'day-off' },
    { class: 'future-workday-class', label: 'Classe futura' },
  ];
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: 'Documento sintetico', language: 'it', createdAt: NOW,
    suggestedStartDate: '2026-01-30', baseServings: 1,
    days: ['2026-01-30', '2026-02-01', '2026-02-02'].map((date, index) => ({
      date, workday: contexts[index],
      meals: [{ mealId: `entry-${index}`, type: 'custom', title: `Voce ${index}`, time: '12:30', ingredients: [] }],
    })),
  };
}

function importTo(state, document = fixture(), options = {}) {
  return prepareImport(state, document, { startDate: START, dateConfirmed: true, now: NOW, ...options });
}

test('import preview and both assignment paths transport isolated day classes across month and year gaps', () => {
  const state = createAppState({ now: NOW });
  const document = fixture();
  const beforeState = structuredClone(state);
  const beforeDocument = structuredClone(document);
  const preview = previewImport(state, document, START);
  assert.deepEqual(preview.dayMappings.map(row => row.assignedDate), MAPPED_DATES);
  assert.deepEqual(preview.dayMappings.map(row => row.workday), document.days.map(day => day.workday));
  preview.dayMappings[0].workday.extension.keep = false;
  assert.deepEqual(document, beforeDocument);

  const imported = importTo(state, document);
  const sessionImported = applySessionImport(state, document, { startDate: START, now: NOW });
  for (const result of [imported, sessionImported]) {
    assert.deepEqual(MAPPED_DATES.map(date => getDayWorkday(result.state, date)), document.days.map(day => day.workday));
    assert.equal(getDayEntries(result.state, START)[0].time, '12:30');
    assert.equal(getDayWorkday(result.state, START).endTime, '06:45');
    assert.equal(getDayWorkday(result.state, START).endDayOffset, 1);
    assert.deepEqual(result.state.sourcePlans[result.sourceId].document, beforeDocument);
    const isolated = getDayWorkday(result.state, START);
    isolated.extension.keep = false;
    assert.equal(result.state.calendar[START].workday.extension.keep, true);
    result.state.calendar[START].workday.label = 'Etichetta della data';
    assert.equal(result.state.sourcePlans[result.sourceId].document.days[0].workday.label, 'Turno A');
  }
  assert.deepEqual(state, beforeState);
  assert.deepEqual(document, beforeDocument);
});

test('meal moves retain each date context and calendar export uses the actual destination context', () => {
  const document = fixture();
  const first = importTo(createAppState({ now: NOW }), document);
  const firstId = getDayEntries(first.state, START)[0].entry.entryId;
  const thirdId = getDayEntries(first.state, '2027-01-02')[0].entry.entryId;
  let moved = setEntryDate(first.state, firstId, '2027-01-01', { now: LATER });
  moved = setEntryTime(setEntryServings(moved, firstId, 3), firstId, '11:45');
  moved = setEntryDate(moved, thirdId, '2027-02-01', { now: LATER });
  assert.equal(getDayEntries(moved, START).length, 0);
  assert.deepEqual(getDayWorkday(moved, START), document.days[0].workday);
  assert.deepEqual(getDayWorkday(moved, '2027-01-01'), document.days[1].workday);
  assert.deepEqual(getDayWorkday(moved, '2027-01-02'), document.days[2].workday);
  assert.equal(getDayWorkday(moved, '2027-02-01'), null);
  assert.deepEqual(getDayEntries(moved, '2027-01-01').map(row => row.time), ['11:45', '12:30']);

  const exported = exportCalendarDiet(moved, { sourceId: first.sourceId, now: LATER });
  assert.deepEqual(exported.days.map(day => day.date), ['2027-01-01', '2027-02-01']);
  assert.deepEqual(exported.days[0].workday, { class: 'day-off' });
  assert.equal(Object.hasOwn(exported.days[1], 'workday'), false);
  assert.equal(exported.days[0].meals[0].time, '11:45');
  assert.equal(exported.baseServings, 1);
  assert.deepEqual(exportSourceDiet(moved, first.sourceId), document);
  validateAppState(moved);
});

test('a classified date without meals requires confirmed replacement and undo restores the whole day', () => {
  const state = createAppState({ now: NOW });
  state.calendar[START] = {
    date: START, meals: [], workday: { class: 'remote-work', startTime: '09:00', endTime: '17:00' },
    extension: 'preserve on undo',
  };
  const before = structuredClone(state);
  assert.deepEqual(previewImport(state, fixture(), START).overlaps, [START]);
  assert.throws(() => importTo(state), { code: 'SESSION_IMPORT_OVERLAP' });
  assert.deepEqual(state, before);
  const replaced = importTo(state, fixture(), { overwrite: true });
  assert.deepEqual(getDayWorkday(replaced.state, START), fixture().days[0].workday);
  assert.deepEqual(replaced.state.lastImportUndo.beforeDays[START], before.calendar[START]);
  assert.deepEqual(undoLastImport(replaced.state, { now: LATER }).calendar, before.calendar);

  const unknown = createAppState({ now: NOW });
  unknown.calendar[START] = { date: START, meals: [], workday: null };
  assert.deepEqual(previewImport(unknown, fixture(), START).overlaps, []);
});

test('backup preserves day context and undo snapshots while moved imported meals retain destination metadata', () => {
  const first = importTo(createAppState({ now: NOW }));
  const current = cloneStateSnapshot(first.state);
  current.calendar['2027-02-01'] = { date: '2027-02-01', meals: [], workday: { class: 'leave', label: 'Ferie' } };
  const before = structuredClone(current.calendar);
  const replacement = fixture('synthetic-replacement');
  replacement.days[0].workday = { class: 'morning-shift', startTime: '05:00', endTime: '13:00' };
  replacement.days[1].workday = null;
  const replaced = importTo(current, replacement, { overwrite: true, now: LATER });
  const firstId = getDayEntries(replaced.state, START)[0].entry.entryId;
  const moved = setEntryDate(replaced.state, firstId, '2027-02-01', { now: LATER });
  const restored = readBackup(JSON.stringify(createBackup(moved, { now: LATER })));
  assert.deepEqual(restored, moved);
  assert.deepEqual(restored.lastImportUndo.beforeDays[START].workday, before[START].workday);
  assert.equal(getDayWorkday(restored, '2027-01-01'), null);
  assert.deepEqual(getDayWorkday(restored, '2027-02-01'), before['2027-02-01'].workday);
  assert.deepEqual(undoLastImport(restored, { now: LATER }).calendar, before);
});

test('older assignments stay unknown and an explicit reimport can apply supplied context without silent duplication', () => {
  const document = fixture();
  const first = importTo(createAppState({ now: NOW }), document);
  const legacy = cloneStateSnapshot(first.state);
  for (const day of Object.values(legacy.calendar)) delete day.workday;
  assert.equal(getDayWorkday(legacy, START), null);
  const restored = readBackup(JSON.stringify(createBackup(legacy, { now: NOW })));
  assert.equal(getDayWorkday(restored, START), null);
  assert.equal(previewImport(restored, document, START).noOp, false);
  assert.throws(() => importTo(restored, document), { code: 'IMPORT_DUPLICATE_CONFIRMATION_REQUIRED' });
  assert.throws(() => importTo(restored, document, { duplicateConfirmed: true }), { code: 'SESSION_IMPORT_OVERLAP' });
  const reapplied = importTo(restored, document, { duplicateConfirmed: true, overwrite: true });
  assert.equal(reapplied.sourceId, first.sourceId);
  assert.equal(Object.keys(reapplied.state.sourcePlans).length, 1);
  assert.deepEqual(getDayWorkday(reapplied.state, START), document.days[0].workday);
  assert.equal(previewImport(reapplied.state, document, START).noOp, true);
  assert.equal(getDayEntries(reapplied.state, START).length, 1);

  const noContext = fixture('legacy-with-text-only');
  for (const day of noContext.days) {
    delete day.workday;
    day.notes = 'night-shift 22:00–06:00';
  }
  const textOnly = importTo(createAppState({ now: NOW }), noContext);
  assert.equal(getDayWorkday(textOnly.state, START), null);
  assert.equal(getDayWorkday(textOnly.state, '2028-01-01'), null);
});

test('unreadable class and clock types fail before changing state, while open class metadata survives', () => {
  const state = createAppState({ now: NOW });
  const before = structuredClone(state);
  for (const workday of [
    'day-shift', [], {}, { class: '' }, { class: 1 },
    { class: 'day-shift', startTime: '24:00' },
    { class: 'day-shift', endTime: 1700 },
    { class: 'day-shift', endDayOffset: '1' },
    { class: 'day-shift', label: {} },
  ]) {
    const document = fixture();
    document.days[0].workday = workday;
    assert.throws(() => importTo(state, document), { code: 'SESSION_INVALID_PLAN' });
    assert.deepEqual(state, before);
  }
  const imported = importTo(state);
  const invalid = cloneStateSnapshot(imported.state);
  invalid.calendar[START].workday = { class: false };
  assert.throws(() => validateAppState(invalid), { code: 'STATE_INVALID_STATE' });
  assert.throws(() => readBackup(JSON.stringify(createBackup(invalid, { now: NOW }))), { code: 'BACKUP_INVALID_STATE' });
  assert.deepEqual(readablePlan(fixture()).days[2].workday, fixture().days[2].workday);
});
