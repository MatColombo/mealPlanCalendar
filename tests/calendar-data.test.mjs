import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { prepareImport, previewUndoImport, undoLastImport } from '../src/data/imports.js';
import { getDayEntries, setEntryDate, setEntryTime, setEntryServings } from '../src/data/session.js';
import { exportCalendarDiet } from '../src/data/export.js';
import { assignmentIdFor } from '../src/data/provenance.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';

// Synthetic calendar records; no food choices, recipes or dietary targets.
function fixture() {
  const ingredient = { ingredientId: 'record-a', name: 'Voce A', quantity: 10, unit: 'g', basis: 'raw' };
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'calendar-move-records',
    title: 'Documento sintetico', language: 'it', createdAt: NOW,
    suggestedStartDate: '2026-10-24', baseServings: 1, extension: { keep: ['source'] },
    days: [
      { date: '2026-10-24', meals: [
        { mealId: 'record-cook', type: 'custom', title: 'Record A', time: '12:00',
          ingredients: [ingredient], preparation: { batchId: 'group-a', role: 'cook', preparedServings: 2 },
          extension: { retained: true } },
      ] },
      { date: '2026-10-26', meals: [
        { mealId: 'record-leftover', type: 'custom', title: 'Record B', time: '09:00',
          ingredients: [ingredient], preparation: { batchId: 'group-a', role: 'leftover' } },
        { mealId: 'record-other', type: 'custom', title: 'Record C', time: '19:00',
          ingredients: [{ ingredientId: 'record-b', name: 'Voce B', quantity: 1, unit: 'unit' }] },
      ] },
    ],
  };
}

function assignedCopies() {
  const document = fixture();
  const first = prepareImport(createAppState({ now: NOW }), document, {
    startDate: '2026-10-24', dateConfirmed: true, now: NOW,
  });
  const second = prepareImport(first.state, document, {
    startDate: '2026-11-01', dateConfirmed: true, duplicateConfirmed: true, now: LATER,
  });
  return { document, first, second, state: second.state };
}

function row(state, date, mealId) {
  return getDayEntries(state, date).find(item => item.meal.mealId === mealId);
}

function stripPhase5Fields(input) {
  const state = cloneStateSnapshot(input);
  for (const day of Object.values(state.calendar)) {
    for (const entry of day.meals) delete entry.assignmentId;
  }
  if (state.lastImportUndo) {
    delete state.lastImportUndo.entryIds;
    for (const day of Object.values(state.lastImportUndo.beforeDays)) {
      for (const entry of day?.meals ?? []) delete entry.assignmentId;
    }
  }
  return state;
}

test('a move merges a populated destination in time order and retains occurrence/source/day metadata', () => {
  const { first } = assignedCopies();
  let state = cloneStateSnapshot(first.state);
  const entryId = row(state, '2026-10-24', 'record-cook').entry.entryId;
  state.calendar['2026-10-24'].extension = { keep: 'origin' };
  state.calendar['2026-10-26'].extension = { keep: 'destination' };
  state.calendar['2026-10-24'].meals[0].extension = { keep: 'occurrence' };
  state = setEntryTime(setEntryServings(state, entryId, 3), entryId, '11:20');
  const before = structuredClone(state);
  const originalEntry = structuredClone(row(state, '2026-10-24', 'record-cook').entry);
  const moved = setEntryDate(state, entryId, '2026-10-26', { now: LATER });
  assert.deepEqual(moved.calendar['2026-10-24'], { ...before.calendar['2026-10-24'], meals: [] });
  assert.deepEqual(moved.calendar['2026-10-26'].extension, { keep: 'destination' });
  assert.deepEqual(getDayEntries(moved, '2026-10-26').map(item => item.time), ['09:00', '11:20', '19:00']);
  assert.deepEqual(moved.calendar['2026-10-26'].meals.map(entry => entry.mealId), ['record-leftover', 'record-cook', 'record-other']);
  assert.deepEqual(row(moved, '2026-10-26', 'record-cook').entry, originalEntry);
  assert.deepEqual(moved.sourcePlans, before.sourcePlans);
  assert.ok(Object.isFrozen(moved.sourcePlans[first.sourceId].document));
  assert.deepEqual(moved.shopping.range, before.shopping.range);
  assert.deepEqual(moved.lastImportUndo, before.lastImportUndo);
  assert.equal(moved.meta.updatedAt, LATER);
  assert.deepEqual(state, before);
  assert.deepEqual(setEntryDate(moved, entryId, '2026-10-26', { now: NOW }), moved);
  assert.throws(() => setEntryDate(state, entryId, '2026-02-30'), { code: 'SESSION_INVALID_DATE' });
  assert.throws(() => setEntryDate(state, 'missing-entry', '2026-10-26'), { code: 'SESSION_ENTRY_NOT_FOUND' });
  assert.deepEqual(state, before);
});

test('a moved preparation occurrence keeps its group while repeated plan assignments stay distinct in export', () => {
  const { state, first } = assignedCopies();
  const movedId = row(state, '2026-10-26', 'record-leftover').entry.entryId;
  const moved = setEntryDate(state, movedId, '2026-10-28', { now: LATER });
  const originalAssignment = row(moved, '2026-10-24', 'record-cook').entry.assignmentId;
  assert.equal(row(moved, '2026-10-28', 'record-leftover').entry.assignmentId, originalAssignment);
  assert.notEqual(row(moved, '2026-11-01', 'record-cook').entry.assignmentId, originalAssignment);
  const exported = exportCalendarDiet(moved, { sourceId: first.sourceId, now: LATER });
  const mealAt = (date, title) => exported.days.find(day => day.date === date).meals.find(meal => meal.title === title);
  assert.equal(mealAt('2026-10-24', 'Record A').preparation.batchId,
    mealAt('2026-10-28', 'Record B').preparation.batchId);
  assert.equal(mealAt('2026-11-01', 'Record A').preparation.batchId,
    mealAt('2026-11-03', 'Record B').preparation.batchId);
  assert.notEqual(mealAt('2026-10-24', 'Record A').preparation.batchId,
    mealAt('2026-11-01', 'Record A').preparation.batchId);
  assert.deepEqual(mealAt('2026-10-28', 'Record B').ingredients, fixture().days[1].meals[0].ingredients);
  assert.deepEqual(previewUndoImport(moved).additionalDates, []);
});

test('moving old version-1 entries materializes historical identities and undo removes the imported entries anywhere', () => {
  const { state, second } = assignedCopies();
  const legacy = readBackup(JSON.stringify(createBackup(stripPhase5Fields(state), { now: NOW })));
  assert.equal(Object.hasOwn(legacy.lastImportUndo, 'entryIds'), false);
  const movedId = row(legacy, '2026-11-03', 'record-leftover').entry.entryId;
  const priorDestination = structuredClone(legacy.calendar['2026-10-24']);
  const moved = setEntryDate(legacy, movedId, '2026-10-24', { now: LATER });
  const latestImportId = moved.imports.at(-1).importId;
  assert.equal(row(moved, '2026-10-24', 'record-leftover').entry.assignmentId, latestImportId);
  assert.equal(moved.lastImportUndo.entryIds.length, 3);
  assert.equal(moved.lastImportUndo.importId, second.state.imports.at(-1).importId);
  assert.deepEqual(previewUndoImport(moved).dates, ['2026-11-01', '2026-11-03']);
  assert.deepEqual(previewUndoImport(moved).additionalDates, ['2026-10-24']);
  const restored = readBackup(JSON.stringify(createBackup(moved, { now: LATER })));
  const undone = undoLastImport(restored, { now: LATER });
  assert.deepEqual(undone.calendar['2026-10-24'].meals.map(entry => entry.entryId), priorDestination.meals.map(entry => entry.entryId));
  assert.equal(Object.hasOwn(undone.calendar, '2026-11-01'), false);
  assert.equal(Object.hasOwn(undone.calendar, '2026-11-03'), false);
  assert.equal(Object.values(undone.calendar).flatMap(day => day.meals).some(entry => entry.entryId === movedId), false);
  assert.equal(undone.imports.at(-1).status, 'undone');
  assert.equal(previewUndoImport(undone), null);
  assert.equal(Object.hasOwn(legacy.lastImportUndo, 'entryIds'), false);
  assert.ok(Object.values(legacy.calendar).every(day => day.meals.every(entry => entry.assignmentId === undefined)));
});

test('old states without import history freeze deterministic legacy preparation groups before movement', () => {
  const { state, first } = assignedCopies();
  const legacy = stripPhase5Fields(state);
  legacy.imports = [];
  delete legacy.lastImportUndo;
  const firstRow = row(legacy, '2026-10-24', 'record-cook');
  const earlierGroup = assignmentIdFor(legacy, firstRow.entry, firstRow.date);
  const laterRow = row(legacy, '2026-11-01', 'record-cook');
  assert.notEqual(earlierGroup, assignmentIdFor(legacy, laterRow.entry, laterRow.date));
  const movedId = row(legacy, '2026-10-26', 'record-leftover').entry.entryId;
  const moved = setEntryDate(validateAppState(legacy), movedId, '2026-11-05', { now: LATER });
  assert.equal(row(moved, '2026-11-05', 'record-leftover').entry.assignmentId, earlierGroup);
  const exported = exportCalendarDiet(moved, { sourceId: first.sourceId, now: LATER });
  const groupAt = (date, title) => exported.days.find(day => day.date === date).meals.find(meal => meal.title === title).preparation.batchId;
  assert.equal(groupAt('2026-10-24', 'Record A'), groupAt('2026-11-05', 'Record B'));
  assert.notEqual(groupAt('2026-10-24', 'Record A'), groupAt('2026-11-01', 'Record A'));
});

test('optional provenance and undo ID fields reject malformed or unrelated removal targets', () => {
  const { state } = assignedCopies();
  const olderId = row(state, '2026-10-24', 'record-cook').entry.entryId;
  const mutations = [
    next => { next.calendar['2026-11-01'].meals[0].assignmentId = ''; },
    next => { next.lastImportUndo.entryIds.push(next.lastImportUndo.entryIds[0]); },
    next => { next.lastImportUndo.entryIds.pop(); },
    next => { next.lastImportUndo.entryIds.push(olderId); },
    next => { next.calendar['2026-11-01'].meals[0].assignmentId = next.imports[0].importId; },
  ];
  const before = structuredClone(state);
  for (const mutate of mutations) {
    const invalid = cloneStateSnapshot(state);
    mutate(invalid);
    assert.throws(() => validateAppState(invalid), { code: 'STATE_INVALID_STATE' });
    assert.deepEqual(state, before);
  }
});
