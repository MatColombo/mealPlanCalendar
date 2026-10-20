import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { setEntryServings, setEntryTime, getDayEntries, getShoppingItems } from '../src/data/session.js';
import { canonicalJson, previewImport, prepareImport, undoLastImport } from '../src/data/imports.js';
import { exportCalendarDiet, exportSourceDiet } from '../src/data/export.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';
const AFTER = '2026-10-19T19:00:00.000Z';

// Synthetic technical records only: no recipes, nutritional thresholds,
// nutritional correctness, menu balance or food-frequency expectations.
function fixture({ planId = 'synthetic-import', quantity = 10, dates = ['2026-10-21', '2026-10-23', '2026-10-24'] } = {}) {
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: 'Documento sintetico', language: 'it', createdAt: NOW,
    suggestedStartDate: dates[0], baseServings: 1,
    extension: { nested: ['preserve', { every: 'field' }] },
    days: dates.map((date, index) => ({
      date, dayExtension: { order: index },
      meals: [{
        mealId: `synthetic-${index}`, type: 'custom-type', title: `Voce ${index}`,
        time: '12:30',
        ingredients: [{ ingredientId: 'item-a', name: 'Voce A', quantity, unit: 'g', basis: 'raw', custom: true }],
        instructions: ['Istruzione sintetica'],
        preparation: { batchId: 'batch-a', role: index === 0 ? 'cook' : 'leftover', preparedServings: 3, extra: 'preserved' },
        extension: { untouched: true },
      }],
    })),
  };
}

function importTo(state, document, startDate = '2026-10-24', options = {}) {
  return prepareImport(state, document, { startDate, dateConfirmed: true, now: NOW, ...options });
}

function initial(document = fixture(), startDate = '2026-10-24') {
  return importTo(createAppState({ now: NOW }), document, startDate);
}

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]));
  }
  return value;
}

test('imports require manual date confirmation and map civil-day gaps atomically across DST', () => {
  const state = createAppState({ now: NOW });
  const before = structuredClone(state);
  const document = fixture();
  assert.throws(() => prepareImport(state, document, { startDate: document.suggestedStartDate }),
    { code: 'IMPORT_DATE_CONFIRMATION_REQUIRED' });
  const result = importTo(state, document);
  assert.deepEqual(Object.keys(result.state.calendar), ['2026-10-24', '2026-10-26', '2026-10-27']);
  assert.deepEqual(result.preview.dayMappings.map(row => row.assignedDate), ['2026-10-24', '2026-10-26', '2026-10-27']);
  assert.deepEqual(result.state.shopping.range, { startDate: '2026-10-24', endDate: '2026-10-27' });
  assert.deepEqual(Object.values(result.state.lastImportUndo.beforeDays), [null, null, null]);
  assert.deepEqual(result.state.sourcePlans[result.sourceId].document, document);
  assert.ok(Object.isFrozen(result.state.sourcePlans[result.sourceId].document));
  assert.ok(getDayEntries(result.state, '2026-10-24').every(row => row.time === '12:30' && row.cookingServings === 1));
  assert.deepEqual(state, before);
});

test('canonical identical imports ignore filename/key order and preserve occurrence edits as a no-op', () => {
  const document = fixture();
  const first = initial(document);
  const entryId = getDayEntries(first.state, '2026-10-24')[0].entry.entryId;
  const edited = setEntryTime(setEntryServings(first.state, entryId, 3), entryId, '13:15');
  const reordered = JSON.parse(JSON.stringify(reverseObjectKeys(document), null, 4));
  assert.equal(canonicalJson(document), canonicalJson(reordered));
  const preview = previewImport(edited, reordered, '2026-10-24');
  assert.equal(preview.noOp, true);
  assert.equal(preview.duplicate, true);
  assert.deepEqual(preview.existingAssignmentDates, ['2026-10-24', '2026-10-26', '2026-10-27']);
  const repeated = importTo(edited, reordered, '2026-10-24', { fileName: 'renamed.diet' });
  assert.equal(repeated.noOp, true);
  assert.equal(repeated.state, edited);
  assert.equal(repeated.sourceId, first.sourceId);
  assert.equal(repeated.state.imports.length, 1);
  assert.equal(getDayEntries(repeated.state, '2026-10-24')[0].cookingServings, 3);
  assert.equal(getDayEntries(repeated.state, '2026-10-24')[0].time, '13:15');
  assert.deepEqual(repeated.state.lastImportUndo, edited.lastImportUndo);
  assert.throws(() => prepareImport(edited, reordered, { startDate: '2026-10-24' }),
    { code: 'IMPORT_DATE_CONFIRMATION_REQUIRED' });
});

test('explicit repeated assignment reuses its immutable source and receives independent occurrence IDs', () => {
  const document = fixture();
  const first = initial(document);
  assert.throws(() => importTo(first.state, document, '2026-11-01'),
    { code: 'IMPORT_DUPLICATE_CONFIRMATION_REQUIRED' });
  const repeated = importTo(first.state, document, '2026-11-01', { duplicateConfirmed: true, fileName: 'copy.diet' });
  assert.equal(repeated.sourceId, first.sourceId);
  assert.equal(Object.keys(repeated.state.sourcePlans).length, 1);
  assert.equal(repeated.state.imports.length, 2);
  assert.equal(repeated.state.imports[1].duplicate, true);
  assert.equal(repeated.state.imports[1].fileName, 'copy.diet');
  const ids = Object.values(repeated.state.calendar).flatMap(day => day.meals.map(entry => entry.entryId));
  assert.equal(new Set(ids).size, 6);
  assert.equal(repeated.state.lastImportUndo.importId, repeated.state.imports[1].importId);
  assert.deepEqual(repeated.state.sourcePlans[first.sourceId].document, document);
});

test('changed JSON with the same planId is a distinct revision and whole occupied days need confirmation', () => {
  const first = initial();
  const document = fixture();
  document.extension.nested.push('new revision');
  const preview = previewImport(first.state, document, '2026-10-24');
  assert.equal(preview.revision, true);
  assert.equal(preview.duplicate, false);
  assert.deepEqual(preview.samePlanSourceIds, [first.sourceId]);
  assert.deepEqual(preview.overlaps, ['2026-10-24', '2026-10-26', '2026-10-27']);
  const before = structuredClone(first.state);
  assert.throws(() => importTo(first.state, document), { code: 'SESSION_IMPORT_OVERLAP' });
  assert.deepEqual(first.state, before);
  const replaced = importTo(first.state, document, '2026-10-24', { overwrite: true });
  assert.notEqual(replaced.sourceId, first.sourceId);
  assert.equal(Object.keys(replaced.state.sourcePlans).length, 2);
  assert.deepEqual(replaced.state.sourcePlans[first.sourceId].document, before.sourcePlans[first.sourceId].document);
  assert.equal(replaced.state.calendar['2026-10-24'].meals[0].sourceId, replaced.sourceId);
});

test('empty days do not produce meal overlap warnings but their metadata is restored by undo', () => {
  const state = createAppState({ now: NOW });
  state.calendar['2026-10-24'] = { date: '2026-10-24', meals: [], extension: { keep: 'empty day' } };
  const before = structuredClone(state.calendar);
  const imported = importTo(state, fixture());
  assert.deepEqual(imported.preview.overlaps, []);
  const undone = undoLastImport(imported.state, { now: LATER });
  assert.deepEqual(undone.calendar, before);
  assert.deepEqual(undone.shopping.range, state.shopping.range);
  assert.equal(undone.imports.at(-1).status, 'undone');
  assert.equal(undone.imports.at(-1).undoneAt, LATER);
  assert.equal(undone.lastImportUndo, null);
  assert.equal(Object.keys(undone.sourcePlans).length, 1);
  assert.throws(() => undoLastImport(undone), { code: 'IMPORT_NOTHING_TO_UNDO' });
});

function checkedReplacement() {
  const document = fixture({ dates: ['2026-10-21'] });
  const first = initial(document);
  const state = cloneStateSnapshot(first.state);
  const row = getShoppingItems(state)[0];
  state.shopping.checked[row.key] = { checked: true, quantity: row.quantity, unit: row.unit, updatedAt: NOW };
  state.calendar['2026-12-01'] = { date: '2026-12-01', meals: [], extension: 'prior' };
  const replaced = importTo(state, fixture({ planId: 'replacement', quantity: 20, dates: ['2026-10-21'] }),
    '2026-10-24', { overwrite: true, now: LATER });
  return { state, replaced, key: row.key };
}

test('undo restores affected days and automatic check changes while retaining unrelated edits', () => {
  const { state, replaced, key } = checkedReplacement();
  assert.equal(replaced.state.shopping.checked[key].checked, false);
  const changed = cloneStateSnapshot(replaced.state);
  changed.settings.uiLanguage = 'en';
  changed.shopping.manualItems.push({ itemId: 'manual-1', name: 'Personal item', checked: false });
  changed.calendar['2026-12-01'].extension = 'later edit';
  changed.calendar['2026-10-24'].meals[0].timeOverride = '16:15';
  changed.calendar['2026-10-24'].meals[0].cookingServings = 4;
  const undone = undoLastImport(changed, { now: AFTER });
  assert.deepEqual(undone.calendar['2026-10-24'], state.calendar['2026-10-24']);
  assert.equal(undone.calendar['2026-12-01'].extension, 'later edit');
  assert.equal(undone.settings.uiLanguage, 'en');
  assert.equal(undone.shopping.manualItems[0].name, 'Personal item');
  assert.deepEqual(undone.shopping.checked[key], state.shopping.checked[key]);
  assert.equal(Object.keys(undone.sourcePlans).length, 2);
  assert.equal(changed.imports.at(-1).status, 'applied');
});

test('undo leaves later explicit checkbox and range changes in place', () => {
  const { replaced, key } = checkedReplacement();
  const changed = cloneStateSnapshot(replaced.state);
  changed.shopping.checked[key] = { checked: true, quantity: 99, unit: 'g', updatedAt: AFTER, extension: 'later' };
  changed.shopping.range = { startDate: '2026-10-24', endDate: '2026-12-01' };
  changed.shopping.mode = 'two';
  const before = structuredClone(changed.shopping);
  const undone = undoLastImport(changed, { now: AFTER });
  assert.deepEqual(undone.shopping, before);
});

test('backup preserves complete version-1 state including undo, unknown fields, checks and source isolation', async () => {
  const { replaced, key } = checkedReplacement();
  const state = cloneStateSnapshot(replaced.state);
  state.extension = { preserve: ['all', 'state', 'metadata'] };
  state.shopping.manualItems.push({ itemId: 'manual-1', name: 'Extra', quantity: 2, unit: 'box', checked: true, custom: { keep: true } });
  const backup = createBackup(state, { now: AFTER });
  const restored = readBackup(JSON.stringify(backup));
  assert.deepEqual(restored, state);
  assert.notEqual(restored, state);
  assert.ok(Object.isFrozen(restored.sourcePlans[replaced.sourceId].document));
  restored.shopping.checked[key].checked = true;
  assert.equal(state.shopping.checked[key].checked, false);
  assert.equal(undoLastImport(readBackup(JSON.stringify(backup)), { now: AFTER }).lastImportUndo, null);
  const legacy = readBackup(await readFile(new URL('../examples/example-backup.json', import.meta.url), 'utf8'));
  assert.equal(Object.hasOwn(legacy, 'lastImportUndo'), false);
  assert.equal(Object.hasOwn(legacy.imports[0], 'status'), false);
});

test('malformed references, history, shopping and undo are rejected before any current state replacement', () => {
  const { replaced, key } = checkedReplacement();
  const state = replaced.state;
  const before = structuredClone(state);
  const mutations = [
    next => { next.calendar['2026-10-24'].date = '2026-10-25'; },
    next => { next.calendar['2026-10-24'].meals[0].mealId = 'missing'; },
    next => { next.calendar['2026-10-24'].meals[0].sourceId = 'missing'; },
    next => { next.imports[0].sourceId = 'missing'; },
    next => { next.imports.push(structuredClone(next.imports[0])); },
    next => { next.imports[0].dayMappings[0].assignedDate = '2026-10-25'; },
    next => { next.imports[0].dayMappings[0].sourceDate = '2026-10-22'; },
    next => { next.shopping.checked[key] = null; },
    next => { next.shopping.manualItems.push(null); },
    next => { next.shopping.manualItems.push({ itemId: 'a', name: 'A', checked: false }, { itemId: 'a', name: 'B', checked: false }); },
    next => { next.lastImportUndo.importId = 'missing'; },
    next => { next.lastImportUndo.beforeDays['2026-10-24'].meals[0].mealId = 'missing'; },
    next => { next.lastImportUndo.beforeDays['2026-10-25'] = null; },
    next => { next.lastImportUndo.shopping.checked[key].after = { checked: false }; },
    next => { next.settings.reducedMotion = 'false'; },
    next => { next.ui.selectedDate = '2026-02-30'; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(state);
    mutate(candidate);
    assert.throws(() => readBackup(JSON.stringify(createBackup(candidate, { now: AFTER }))), { code: 'BACKUP_INVALID_STATE' });
    assert.deepEqual(state, before);
  }
  assert.throws(() => validateAppState({ ...state, schemaVersion: 2 }), { code: 'STATE_UNSUPPORTED_VERSION' });
  assert.throws(() => readBackup('{'), { code: 'BACKUP_INVALID_JSON' });
});

test('calendar export materializes occurrences and effective times without scaling source quantities', () => {
  const document = fixture();
  const first = initial(document);
  const repeated = importTo(first.state, document, '2026-11-01', { duplicateConfirmed: true });
  const entryId = getDayEntries(repeated.state, '2026-11-01')[0].entry.entryId;
  const state = setEntryTime(setEntryServings(repeated.state, entryId, 5), entryId, '19:45');
  const before = structuredClone(state);
  const exported = exportCalendarDiet(state, { sourceId: first.sourceId, now: LATER });
  assert.notEqual(exported.planId, document.planId);
  assert.equal(exported.baseServings, 1);
  assert.equal(exported.language, 'it');
  assert.equal(exported.createdAt, LATER);
  assert.equal(exported.suggestedStartDate, '2026-10-24');
  assert.deepEqual(exported.days.map(day => day.date), ['2026-10-24', '2026-10-26', '2026-10-27', '2026-11-01', '2026-11-03', '2026-11-04']);
  const meals = exported.days.flatMap(day => day.meals);
  assert.equal(new Set(meals.map(meal => meal.mealId)).size, 6);
  assert.equal(meals[3].time, '19:45');
  assert.deepEqual(meals[3].ingredients, document.days[0].meals[0].ingredients);
  assert.deepEqual(meals[3].extension, document.days[0].meals[0].extension);
  assert.deepEqual(exported.extension, document.extension);
  assert.equal(meals[0].preparation.batchId, meals[1].preparation.batchId);
  assert.notEqual(meals[0].preparation.batchId, meals[3].preparation.batchId);
  assert.equal(meals[3].preparation.preparedServings, 3);
  assert.deepEqual(state, before);
  const single = exportCalendarDiet(state, { sourceId: first.sourceId, startDate: '2026-11-01', endDate: '2026-11-01', now: LATER });
  assert.equal(single.days.length, 1);
  assert.equal(single.suggestedStartDate, '2026-11-01');
  assert.equal(single.days[0].meals[0].time, '19:45');
  const reimported = initial(single, single.suggestedStartDate);
  assert.equal(getDayEntries(reimported.state, '2026-11-01')[0].cookingServings, 1);
  assert.equal(getDayEntries(reimported.state, '2026-11-01')[0].time, '19:45');
});

test('original exports preserve every JSON field while empty calendar selections fail explicitly', () => {
  const document = fixture();
  const first = initial(document);
  const original = exportSourceDiet(first.state, first.sourceId);
  assert.deepEqual(original, document);
  original.extension.nested.push('external');
  assert.deepEqual(first.state.sourcePlans[first.sourceId].document, document);
  assert.throws(() => exportCalendarDiet(first.state, { sourceId: first.sourceId, startDate: '2026-12-01', endDate: '2026-12-02' }),
    { code: 'EXPORT_EMPTY_SELECTION' });
  assert.throws(() => exportCalendarDiet(first.state, { sourceId: 'missing' }), { code: 'EXPORT_SOURCE_NOT_FOUND' });
  assert.throws(() => exportCalendarDiet(first.state, { sourceId: first.sourceId, startDate: '2026-10-27', endDate: '2026-10-24' }),
    { code: 'SESSION_INVALID_RANGE' });
  const archived = undoLastImport(first.state, { now: LATER });
  assert.throws(() => exportCalendarDiet(archived, { sourceId: first.sourceId }), { code: 'EXPORT_EMPTY_SELECTION' });
  assert.deepEqual(exportSourceDiet(archived, first.sourceId), document);
});

test('undo refuses identity conflicts without discarding later calendar changes', () => {
  const { state, replaced } = checkedReplacement();
  const changed = cloneStateSnapshot(replaced.state);
  // An entry moved out of the affected dates by a future calendar editor.
  changed.calendar['2026-12-02'] = { date: '2026-12-02', meals: structuredClone(state.calendar['2026-10-24'].meals) };
  const before = structuredClone(changed);
  assert.throws(() => undoLastImport(changed, { now: AFTER }), { code: 'IMPORT_UNDO_CONFLICT' });
  assert.deepEqual(changed, before);
});
