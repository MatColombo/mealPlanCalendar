import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { prepareImport, reconcileShopping, undoLastImport } from '../src/data/imports.js';
import { getDayEntries, setEntryDate, setEntryServings } from '../src/data/session.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';
import { createIndexedDBRepository } from '../src/persistence/indexeddb.js';
import { commitCandidate } from '../src/persistence/commit.js';
import {
  addManualItem, getShoppingList, reconcileShoppingChecks, removeManualItem,
  setManualItemChecked, setShoppingItemChecked, setShoppingMode, setShoppingRange,
} from '../src/shopping/list.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';
const FIRST = '2026-10-21';

// Synthetic records exercise dates, references, quantity arithmetic and state
// transactions. No recipe, nutrition, balancing or dietary rule is asserted.
function fixture(planId, records, language = 'it') {
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: `Documento ${planId}`, language, createdAt: NOW,
    suggestedStartDate: records[0].date, baseServings: 1,
    extension: { original: planId },
    days: records.map(({ date, quantity, unit = 'g', unitConversion }, index) => ({
      date,
      meals: [{
        mealId: `${planId}-${index}`, title: `Record ${index + 1}`, type: 'other', time: '12:00',
        ingredients: [{
          ingredientId: 'shared-item', name: language === 'it' ? 'Voce sintetica' : 'Synthetic item',
          quantity, unit, basis: 'raw', category: 'other',
          extension: { keep: ['original'] },
          ...(unitConversion === undefined ? {} : { unitConversion }),
        }],
      }],
    })),
  };
}

function imported(state, document, options = {}) {
  return prepareImport(state, document, {
    startDate: document.days[0].date, dateConfirmed: true,
    fileName: `${document.planId}.diet`, now: NOW, ...options,
  }).state;
}

function entryId(state, date = FIRST) {
  return getDayEntries(state, date)[0].entry.entryId;
}

function onlyRow(state) {
  const rows = getShoppingList(state).rows;
  assert.equal(rows.length, 1);
  return rows[0];
}

function checkedState(state) {
  return setShoppingItemChecked(state, onlyRow(state).key, true, { now: NOW });
}

test('an inclusive period aggregates multiple plans and conversion metadata while modes keep calendar people and manual amounts intact', async t => {
  const repository = createIndexedDBRepository({ indexedDB: new IDBFactory(), name: 'shopping-period' });
  t.after(() => repository.close());
  let visible = await repository.load() ?? createAppState({ now: NOW });
  const first = fixture('first-source', [
    { date: FIRST, quantity: 9000 },
    { date: '2026-10-22', quantity: 100 },
    { date: '2026-10-24', quantity: 2, unit: 'unit', unitConversion: { toUnit: 'g', factor: 50 } },
  ]);
  const second = fixture('second-source', [
    { date: '2026-10-23', quantity: 0.2, unit: 'kg' },
    { date: '2026-10-25', quantity: 8000 },
  ], 'en');
  visible = await commitCandidate(repository, imported(imported(visible, first), second));
  let candidate = setShoppingRange(visible, { startDate: '2026-10-22', endDate: '2026-10-24' }, { now: NOW });
  candidate = setEntryServings(candidate, entryId(candidate, '2026-10-22'), 3);
  candidate = setEntryServings(candidate, entryId(candidate, '2026-10-23'), 4);
  candidate = addManualItem(candidate, {
    name: '  Scatole  ', quantity: 7, unit: 'unit', category: 'household', extension: { absolute: true },
  }, { itemId: 'manual-boxes', now: NOW });
  candidate = setManualItemChecked(candidate, 'manual-boxes', true, { now: NOW });
  visible = await commitCandidate(repository, candidate);
  const calendarBefore = structuredClone(visible.calendar);
  const originals = Object.values(visible.sourcePlans).map(source => source.document);
  assert.deepEqual(originals, [first, second]);
  assert.equal(onlyRow(visible).quantity, 400);
  assert.equal(getShoppingList(visible).mealCount, 3);

  for (const [mode, quantity] of [['two', 800], ['advanced', 1200], ['one', 400]]) {
    visible = await commitCandidate(repository, setShoppingMode(visible, mode, { now: LATER }));
    const list = getShoppingList(visible);
    assert.equal(list.rows[0].quantity, quantity);
    assert.equal(list.manualItems[0].quantity, 7);
    assert.equal(list.manualItems[0].checked, true);
    assert.equal(list.generatedCount, 1);
    assert.equal(list.manualCount, 1);
    assert.equal(list.totalCount, 2);
    assert.equal(list.checkedCount, 1);
    assert.equal(list.reopenedCount, 0);
    assert.deepEqual(visible.calendar, calendarBefore);
  }

  // Every view copy is isolated, including ingredient/manual extension fields.
  const before = cloneStateSnapshot(visible);
  const view = getShoppingList(visible);
  view.rows[0].extension.keep.push('view-only');
  view.manualItems[0].extension.absolute = false;
  view.range.endDate = '2026-12-01';
  assert.deepEqual(visible, before);
  assert.deepEqual(Object.values(visible.sourcePlans).map(source => source.document), [first, second]);
  assert.deepEqual(await repository.load(), visible);
});

test('checks reopen on a real demand increase, retain their purchased baseline, and stay open after disappearing or shrinking', () => {
  let state = imported(createAppState({ now: NOW }), fixture('check-lifecycle', [{ date: FIRST, quantity: 10 }]));
  state = checkedState(state);
  const key = onlyRow(state).key;
  state.shopping.checked[key].extension = { receipt: 'retained' };
  state = setShoppingMode(state, 'two', { now: LATER });
  assert.equal(onlyRow(state).checked, false);
  assert.equal(onlyRow(state).reopened, true);
  assert.equal(onlyRow(state).previousQuantity, 10);
  assert.equal(state.shopping.checked[key].quantity, 10);
  assert.equal(state.shopping.checked[key].reopened, true);

  state = setShoppingMode(state, 'one', { now: LATER });
  assert.equal(onlyRow(state).checked, false);
  assert.equal(onlyRow(state).reopened, false);
  assert.equal(state.shopping.checked[key].reopened, true);
  state = setShoppingMode(state, 'two', { now: LATER });
  assert.equal(onlyRow(state).reopened, true);
  state = checkedState(state);
  assert.equal(state.shopping.checked[key].quantity, 20);
  assert.equal(Object.hasOwn(state.shopping.checked[key], 'reopened'), false);
  state = setShoppingMode(state, 'one', { now: LATER });
  assert.equal(onlyRow(state).quantity, 10);
  assert.equal(onlyRow(state).checked, true);
  assert.equal(onlyRow(state).previousQuantity, 20);

  const movedId = entryId(state);
  state = reconcileShopping(setEntryDate(state, movedId, '2026-11-01'), { now: LATER });
  assert.equal(getShoppingList(state).rows.length, 0);
  assert.equal(state.shopping.checked[key].checked, false);
  assert.equal(Object.hasOwn(state.shopping.checked[key], 'reopened'), false);
  state = reconcileShopping(setEntryDate(state, movedId, FIRST), { now: LATER });
  assert.equal(onlyRow(state).checked, false);
  assert.equal(onlyRow(state).reopened, false);
  assert.deepEqual(state.shopping.checked[key].extension, { receipt: 'retained' });

  // An old backup may contain a check for less than today's requirement.
  const legacy = cloneStateSnapshot(state);
  Object.assign(legacy.shopping.checked[key], { checked: true, quantity: 4 });
  const legacyBefore = cloneStateSnapshot(legacy);
  assert.equal(onlyRow(legacy).checked, false);
  assert.equal(onlyRow(legacy).reopened, true);
  assert.deepEqual(legacy, legacyBefore);
  state = reconcileShoppingChecks(legacy, { now: LATER });
  assert.equal(state.shopping.checked[key].checked, false);
  assert.equal(state.shopping.checked[key].reopened, true);
  state = setShoppingItemChecked(state, key, false, { now: LATER });
  assert.equal(Object.hasOwn(state.shopping.checked[key], 'reopened'), false);
  assert.equal(state.shopping.checked[key].quantity, 10);
  assert.deepEqual(state.shopping.checked[key].extension, { receipt: 'retained' });

  // Relative tolerance ignores multiplication noise without swallowing tiny
  // but meaningful increases as the previous fixed 1e-8 threshold could do.
  for (const { quantity, multiplier, reopened } of [
    { quantity: 0.3, multiplier: 1 + Number.EPSILON, reopened: false },
    { quantity: 1e-12, multiplier: 1.000001, reopened: true },
  ]) {
    let sample = imported(createAppState({ now: NOW }), fixture('float-check', [{ date: FIRST, quantity }]));
    sample = checkedState(sample);
    sample = setEntryServings(sample, entryId(sample), multiplier);
    sample = setShoppingMode(sample, 'advanced', { now: LATER });
    assert.equal(onlyRow(sample).reopened, reopened);
    assert.equal(onlyRow(sample).checked, !reopened);
  }
});

test('a new period reopens identical generated totals while an unchanged period, manual checks and meal people retain continuity', () => {
  let state = imported(createAppState({ now: NOW }), fixture('period-continuity', [
    { date: FIRST, quantity: 5 }, { date: '2026-10-28', quantity: 5 },
  ]));
  state = setEntryServings(state, entryId(state), 3);
  state = setShoppingRange(state, { startDate: FIRST, endDate: FIRST }, { now: NOW });
  state = checkedState(state);
  state = addManualItem(state, { name: 'Sacchetti', quantity: 2, unit: 'unit' }, { itemId: 'bags', now: NOW });
  state = setManualItemChecked(state, 'bags', true, { now: NOW });
  const key = onlyRow(state).key;
  state.shopping.checked[key].extension = { note: 'open metadata' };
  state.shopping.range.extension = { keep: true };
  const before = cloneStateSnapshot(state);

  state = setShoppingRange(state, { startDate: FIRST, endDate: FIRST }, { now: LATER });
  assert.equal(onlyRow(state).checked, true);
  assert.equal(getShoppingList(state).checkedCount, 2);
  state = setShoppingRange(state, { startDate: '2026-10-28', endDate: '2026-10-28' }, { now: LATER });
  assert.equal(onlyRow(state).quantity, 5);
  assert.equal(onlyRow(state).checked, false);
  assert.equal(onlyRow(state).reopened, false);
  assert.equal(getShoppingList(state).checkedCount, 1);
  assert.deepEqual(state.shopping.checked[key].extension, { note: 'open metadata' });
  assert.deepEqual(state.shopping.range.extension, { keep: true });
  assert.deepEqual(state.shopping.manualItems, before.shopping.manualItems);
  assert.deepEqual(state.calendar, before.calendar);
  assert.equal(onlyRow(before).checked, true);

  const noPeriod = setShoppingRange(state, { startDate: null, endDate: null }, { now: LATER });
  assert.equal(getShoppingList(noPeriod).mealCount, 0);
  assert.equal(getShoppingList(noPeriod).totalCount, 1);
  assert.equal(getShoppingList(noPeriod).checkedCount, 1);
  assert.throws(() => setShoppingRange(state, { startDate: '2026-10-29', endDate: FIRST }), { code: 'SESSION_INVALID_RANGE' });
  assert.throws(() => addManualItem(state, { name: 'Manca quantità', unit: 'unit' }), { code: 'SHOPPING_INVALID_QUANTITY' });
  assert.throws(() => addManualItem(state, { name: 'Manca unità', quantity: 2, unit: '  ' }), { code: 'SHOPPING_INVALID_ITEM' });
  assert.throws(() => setManualItemChecked(state, 'missing', true), { code: 'SHOPPING_ITEM_NOT_FOUND' });
});

test('reopen, backup restore and import undo retain checklist baselines, manual metadata and later explicit additions', async t => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'shopping-backup-source' });
  t.after(() => repository.close());
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = imported(visible, fixture('before-overwrite', [{ date: FIRST, quantity: 10 }]));
  visible = checkedState(visible);
  const key = onlyRow(visible).key;
  visible.shopping.checked[key].extension = { receipt: { id: 'A-1' } };
  visible = addManualItem(visible, {
    name: 'Contenitori', quantity: 2, unit: 'unit', extension: { keep: ['yes'] },
  }, { itemId: 'containers', now: NOW });
  visible = setManualItemChecked(visible, 'containers', true, { now: NOW });
  // Existing version-1 backups may still contain a manual note without an amount.
  visible.shopping.manualItems.push({ itemId: 'legacy-note', name: 'Nota precedente', checked: false });
  visible = await commitCandidate(repository, visible);
  const prior = cloneStateSnapshot(visible);
  visible = await commitCandidate(repository, imported(visible,
    fixture('overwrite', [{ date: FIRST, quantity: 20 }]), { overwrite: true, now: LATER }));
  assert.equal(onlyRow(visible).reopened, true);
  visible = addManualItem(visible, { name: 'Etichette', quantity: 3, unit: 'unit' }, { itemId: 'labels', now: LATER });
  visible = await commitCandidate(repository, setManualItemChecked(visible, 'labels', true, { now: LATER }));
  const beforeClose = cloneStateSnapshot(visible);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'shopping-backup-source' });
  visible = validateAppState(await repository.load());
  assert.deepEqual(visible, beforeClose);
  const listBeforeBackup = getShoppingList(visible);
  assert.equal(listBeforeBackup.reopenedCount, 1);
  assert.equal(listBeforeBackup.manualCount, 3);
  assert.equal(listBeforeBackup.checkedCount, 2);
  const restored = readBackup(JSON.stringify(createBackup(visible, { now: LATER })));
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'shopping-backup-target' });
  await repository.load();
  await commitCandidate(repository, prior);
  visible = await commitCandidate(repository, restored, { checkpoint: true });
  assert.deepEqual(await repository.loadRecovery(), prior);
  assert.deepEqual(getShoppingList(visible), listBeforeBackup);
  visible = await commitCandidate(repository, undoLastImport(visible, { now: LATER }));
  assert.equal(onlyRow(visible).quantity, 10);
  assert.equal(onlyRow(visible).checked, true);
  assert.equal(onlyRow(visible).reopened, false);
  assert.deepEqual(visible.shopping.checked[key], prior.shopping.checked[key]);
  assert.equal(visible.shopping.manualItems.find(item => item.itemId === 'labels').checked, true);
  assert.deepEqual(visible.shopping.manualItems.find(item => item.itemId === 'containers').extension, { keep: ['yes'] });
  assert.equal(Object.hasOwn(visible.shopping.manualItems.find(item => item.itemId === 'legacy-note'), 'quantity'), false);
  visible = await commitCandidate(repository, removeManualItem(visible, 'labels', { now: LATER }));
  assert.equal(getShoppingList(visible).manualCount, 2);
  assert.deepEqual(await repository.load(), visible);
  assert.deepEqual(await repository.loadRecovery(), prior);
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

test('an aborted shopping transaction preserves the visible checklist, durable state and previous recovery copy after put succeeds', async t => {
  const { indexedDB, control } = abortableFactory();
  const repository = createIndexedDBRepository({ indexedDB, name: 'shopping-rollback' });
  t.after(() => repository.close());
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = imported(visible, fixture('rollback', [{ date: FIRST, quantity: 5 }]));
  visible = checkedState(visible);
  visible = addManualItem(visible, { name: 'Carta', quantity: 2, unit: 'unit' }, { itemId: 'paper', now: NOW });
  visible = await commitCandidate(repository, visible);
  const recoveryBefore = cloneStateSnapshot(visible);
  visible = await commitCandidate(repository, setManualItemChecked(visible, 'paper', true, { now: LATER }), { checkpoint: true });
  const before = visible;
  const listBefore = getShoppingList(visible);
  let candidate = setShoppingMode(visible, 'two', { now: LATER });
  candidate = removeManualItem(candidate, 'paper', { now: LATER });
  assert.equal(onlyRow(candidate).reopened, true);
  assert.equal(getShoppingList(candidate).manualCount, 0);

  control.abortNextWrite = true;
  await assert.rejects((async () => {
    visible = await commitCandidate(repository, candidate, { checkpoint: true });
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(control.putSucceeded, true);
  assert.equal(visible, before);
  assert.deepEqual(getShoppingList(visible), listBefore);
  assert.deepEqual(await repository.load(), before);
  assert.deepEqual(await repository.loadRecovery(), recoveryBefore);

  // A failed transaction must not poison the repository's revision for retry.
  visible = await commitCandidate(repository, candidate);
  assert.equal(onlyRow(visible).reopened, true);
  assert.equal(getShoppingList(visible).manualCount, 0);
  assert.deepEqual(await repository.loadRecovery(), recoveryBefore);
});
