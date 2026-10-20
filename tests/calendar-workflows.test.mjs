import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { prepareImport, previewUndoImport, reconcileShopping, undoLastImport } from '../src/data/imports.js';
import { findEntry, getDayEntries, getShoppingItems, setEntryDate, setEntryServings, setEntryTime } from '../src/data/session.js';
import { resolveNavigation, resolveRoute } from '../src/data/navigation.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';
import { createIndexedDBRepository } from '../src/persistence/indexeddb.js';
import { commitCandidate } from '../src/persistence/commit.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';
const TODAY = '2026-10-19';

// Synthetic records for calendar references, storage and quantity arithmetic.
// No nutrition, recipe balance, food frequency or dietary targets are asserted.
function fixture(planId = 'calendar-source') {
  const dates = ['2026-10-21', '2026-10-23', '2026-10-24'];
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: `Documento ${planId}`, language: 'it', createdAt: NOW,
    suggestedStartDate: dates[0], baseServings: 1,
    extension: { retained: true },
    days: dates.map((date, index) => ({
      date,
      meals: [{
        mealId: `${planId}-record-${index}`, title: `Voce ${index + 1}`,
        type: 'other', time: ['08:00', '12:00', '18:00'][index],
        ingredients: [{
          ingredientId: `${planId}-shared-item`, name: 'Voce sintetica',
          quantity: index + 2, unit: 'g', basis: 'raw', category: 'other',
        }],
        extension: { retained: index },
      }],
    })),
  };
}

function imported(state, document, startDate) {
  return prepareImport(state, document, {
    startDate, dateConfirmed: true, fileName: `${document.planId}.diet`, now: NOW,
  });
}

test('moving into a populated day persists both meals, original references, overrides and selected date across reopening', async () => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'calendar-reopen' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  const document = fixture();
  const result = imported(visible, document, '2026-10-24');
  visible = await commitCandidate(repository, result.state);
  const first = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  const alreadyThere = getDayEntries(visible, '2026-10-26')[0].entry.entryId;
  let edited = setEntryTime(setEntryServings(visible, first, 3), first, '09:15');
  edited.calendar['2026-10-24'].extension = { keepOrigin: true };
  edited.calendar['2026-10-26'].extension = { keepDestination: true };
  visible = await commitCandidate(repository, edited);
  const oldState = cloneStateSnapshot(visible);
  const originalEntry = structuredClone(findEntry(visible, first).entry);
  const candidate = setEntryDate(visible, first, '2026-10-26', { now: LATER });
  candidate.ui = resolveNavigation(candidate.ui, { view: 'calendar', date: '2026-10-26', today: TODAY }).ui;
  visible = await commitCandidate(repository, candidate);
  assert.deepEqual(oldState.calendar['2026-10-24'].meals[0], originalEntry);
  assert.deepEqual(visible.calendar['2026-10-24'], {
    date: '2026-10-24', meals: [], extension: { keepOrigin: true },
  });
  assert.deepEqual(visible.calendar['2026-10-26'].meals.map(entry => entry.entryId), [first, alreadyThere]);
  assert.deepEqual(visible.calendar['2026-10-26'].extension, { keepDestination: true });
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'calendar-reopen' });
  visible = validateAppState(await repository.load());
  const moved = findEntry(visible, first);
  assert.equal(moved.date, '2026-10-26');
  assert.equal(moved.time, '09:15');
  assert.equal(moved.cookingServings, 3);
  assert.deepEqual(moved.entry, originalEntry);
  assert.deepEqual(moved.meal.ingredients, document.days[0].meals[0].ingredients);
  assert.deepEqual(visible.sourcePlans[result.sourceId].document, document);
  assert.ok(Object.isFrozen(visible.sourcePlans[result.sourceId].document));
  assert.equal(resolveRoute(visible.ui, { today: TODAY }).hash, '#calendar/2026-10-26');
  repository.close();
});

test('moving into a selected shopping range recalculates quantities and reopens its check without changing the range', async () => {
  const indexedDB = new IDBFactory();
  const repository = createIndexedDBRepository({ indexedDB, name: 'calendar-shopping' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = await commitCandidate(repository, imported(visible, fixture(), '2026-10-24').state);
  const entryId = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  let candidate = setEntryServings(visible, entryId, 2);
  candidate.shopping.mode = 'advanced';
  candidate.shopping.range = { startDate: '2026-10-26', endDate: '2026-10-26' };
  const previous = getShoppingItems(candidate)[0];
  candidate.shopping.checked[previous.key] = {
    checked: true, quantity: previous.quantity, unit: previous.unit, updatedAt: NOW,
  };
  visible = await commitCandidate(repository, candidate);
  const rangeBefore = structuredClone(visible.shopping.range);
  assert.equal(previous.quantity, 3);
  visible = await commitCandidate(repository, reconcileShopping(setEntryDate(visible, entryId, '2026-10-26'), { now: LATER }));
  assert.deepEqual(visible.shopping.range, rangeBefore);
  assert.equal(getShoppingItems(visible)[0].quantity, 7);
  assert.equal(visible.shopping.checked[previous.key].checked, false);
  assert.equal(findEntry(visible, entryId).meal.ingredients[0].quantity, 2);

  // Moving the same occurrence outside that range removes only its demand.
  visible = await commitCandidate(repository, reconcileShopping(setEntryDate(visible, entryId, '2026-10-25'), { now: LATER }));
  assert.deepEqual(visible.shopping.range, rangeBefore);
  assert.equal(getShoppingItems(visible)[0].quantity, 3);
  assert.deepEqual(await repository.load(), visible);
  repository.close();
});

function abortableFactory() {
  const native = new IDBFactory();
  const control = { abortNextWrite: false, putSucceeded: false };
  return {
    control,
    indexedDB: {
      open(...args) {
        const request = native.open(...args);
        request.addEventListener('success', () => {
          const database = request.result;
          const transaction = database.transaction.bind(database);
          database.transaction = (...parameters) => {
            const tx = transaction(...parameters);
            if (parameters[1] === 'readwrite' && control.abortNextWrite) {
              const objectStore = tx.objectStore.bind(tx);
              tx.objectStore = (...storeArgs) => {
                const store = objectStore(...storeArgs);
                const put = store.put.bind(store);
                store.put = (value, key) => {
                  const result = put(value, key);
                  result.addEventListener('success', () => {
                    if (key === 'current') {
                      control.putSucceeded = true;
                      control.abortNextWrite = false;
                      tx.abort();
                    }
                  });
                  return result;
                };
                return store;
              };
            }
            return tx;
          };
        });
        return request;
      },
    },
  };
}

test('an aborted move leaves the old position visible and durable even after its put request succeeds', async () => {
  const { indexedDB, control } = abortableFactory();
  const repository = createIndexedDBRepository({ indexedDB, name: 'calendar-failure' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = await commitCandidate(repository, imported(visible, fixture(), '2026-10-24').state);
  const entryId = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  const before = visible;
  const candidate = setEntryDate(visible, entryId, '2026-12-01', { now: LATER });
  candidate.ui = resolveNavigation(candidate.ui, { view: 'calendar', date: '2026-12-01', today: TODAY }).ui;
  control.abortNextWrite = true;
  await assert.rejects((async () => {
    visible = await commitCandidate(repository, candidate);
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(control.putSucceeded, true);
  assert.equal(visible, before);
  assert.equal(findEntry(visible, entryId).date, '2026-10-24');
  assert.equal(Object.hasOwn(visible.calendar, '2026-12-01'), false);
  assert.deepEqual(await repository.load(), before);
  repository.close();
});

test('backup, reopen and import undo remove a moved imported meal while retaining unrelated destination meals', async () => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'calendar-undo' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = await commitCandidate(repository, imported(visible, fixture('unrelated'), '2026-12-01').state);
  const destinationBefore = structuredClone(visible.calendar['2026-12-01']);
  visible = await commitCandidate(repository, imported(visible, fixture('latest'), '2026-10-24').state);
  const importId = visible.lastImportUndo.importId;
  const entryId = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  visible = await commitCandidate(repository, setEntryDate(visible, entryId, '2026-12-01', { now: LATER }));
  const undo = previewUndoImport(visible);
  assert.deepEqual(undo.dates, ['2026-10-24', '2026-10-26', '2026-10-27']);
  assert.deepEqual(undo.additionalDates, ['2026-12-01']);
  assert.ok(undo.entryIds.includes(entryId));
  const backup = createBackup(visible, { now: LATER });
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'calendar-restored-backup' });
  await repository.load();
  visible = await commitCandidate(repository, readBackup(JSON.stringify(backup)), { checkpoint: true });
  repository.close();
  repository = createIndexedDBRepository({ indexedDB, name: 'calendar-restored-backup' });
  visible = validateAppState(await repository.load());
  assert.deepEqual(previewUndoImport(visible), undo);
  visible = await commitCandidate(repository, undoLastImport(visible, { now: LATER }));
  assert.equal(findEntry(visible, entryId), null);
  assert.deepEqual(visible.calendar['2026-12-01'], destinationBefore);
  for (const date of undo.dates) assert.equal(Object.hasOwn(visible.calendar, date), false);
  assert.equal(visible.imports.find(record => record.importId === importId).status, 'undone');
  assert.equal(visible.lastImportUndo, null);
  assert.deepEqual(await repository.load(), visible);
  repository.close();
});
