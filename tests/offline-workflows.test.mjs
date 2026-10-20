import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { readDietDocument } from '../src/data/diet.js';
import { prepareImport, previewImport, reconcileShopping, undoLastImport } from '../src/data/imports.js';
import { findEntry, getDayEntries, setEntryDate, setEntryServings, setEntryTime } from '../src/data/session.js';
import { resolveNavigation, resolveRoute } from '../src/data/navigation.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { exportCalendarDiet, exportSourceDiet } from '../src/data/export.js';
import { addManualItem, getShoppingList, setManualItemChecked, setShoppingItemChecked, setShoppingMode, setShoppingRange } from '../src/shopping/list.js';
import { createShoppingText } from '../src/ui/shopping-output.js';
import { createIndexedDBRepository, readStoredBackup } from '../src/persistence/indexeddb.js';
import { loadCompatibleState } from '../src/persistence/migrations.js';
import { commitCandidate } from '../src/persistence/commit.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';

/** Browser network entry points fail even if a caller tries to hide an error. */
function offline(t) {
  const attempts = [];
  const replace = (key, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  };
  function denied() {
    attempts.push('network');
    throw new Error('Network is unavailable in this offline workflow.');
  }
  for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) replace(key, denied);
  replace('navigator', { onLine: false, sendBeacon: denied });
  return attempts;
}

// Technical input only. These tests verify software state and arithmetic,
// never the suitability, balance or nutritional correctness of a meal plan.
function document() {
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'offline-fixture',
    title: 'Offline fixture', language: 'en', createdAt: NOW, baseServings: 1,
    suggestedStartDate: '2026-10-21', extension: { keep: ['source'] },
    days: ['2026-10-21', '2026-10-22', '2026-10-24'].map((date, index) => ({
      date,
      meals: [{
        mealId: `record-${index}`, title: `Synthetic record ${index + 1}`, type: 'other', time: '12:00',
        ingredients: [{ ingredientId: 'shared', name: 'Synthetic item', quantity: index + 2, unit: 'g', basis: 'raw' }],
        instructions: ['Supplied instructions'],
      }],
    })),
  };
}

function importOffline(state) {
  const parsed = readDietDocument(JSON.stringify(document()));
  const preview = previewImport(state, parsed, '2026-10-24');
  assert.equal(preview.endDate, '2026-10-27');
  return prepareImport(state, parsed, {
    startDate: '2026-10-24', dateConfirmed: true, fileName: 'offline.diet', now: NOW,
  });
}

test('import, calendar, shopping, exports, backup and reopening work with every browser network entry point disabled', async t => {
  const attempts = offline(t);
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'offline-continuity' });
  t.after(() => repository.close());
  let visible = await loadCompatibleState(repository) ?? createAppState({ now: NOW });
  const imported = importOffline(visible);
  visible = await commitCandidate(repository, imported.state);
  const movedId = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  let candidate = setEntryTime(setEntryServings(visible, movedId, 3), movedId, '09:15');
  candidate = reconcileShopping(setEntryDate(candidate, movedId, '2026-10-26', { now: LATER }), { now: LATER });
  candidate = setShoppingRange(candidate, { startDate: '2026-10-25', endDate: '2026-10-27' }, { now: LATER });
  candidate = setShoppingMode(candidate, 'advanced', { now: LATER });
  candidate = setShoppingItemChecked(candidate, getShoppingList(candidate).rows[0].key, true, { now: LATER });
  candidate = addManualItem(candidate, { name: 'Containers', quantity: 2, unit: 'unit' }, { itemId: 'offline-manual', now: LATER });
  candidate = setManualItemChecked(candidate, 'offline-manual', true, { now: LATER });
  candidate.ui = resolveNavigation(candidate.ui, { view: 'calendar', date: '2026-10-26', today: '2026-10-19' }).ui;
  candidate.settings.uiLanguage = 'en';
  candidate.settings.reducedMotion = true;
  visible = await commitCandidate(repository, candidate);
  const beforeClose = cloneStateSnapshot(visible);
  const listBefore = getShoppingList(visible);
  assert.equal(listBefore.mealCount, 3);
  assert.equal(listBefore.rows[0].quantity, 13);
  assert.equal(listBefore.checkedCount, 2);
  assert.match(createShoppingText(listBefore, 'en'), /\[x\] Synthetic item/);
  assert.deepEqual(exportSourceDiet(visible, imported.sourceId), document());
  const calendarExport = exportCalendarDiet(visible, { sourceId: imported.sourceId, now: LATER });
  assert.equal(calendarExport.days.find(day => day.date === '2026-10-26').meals[0].time, '09:15');
  const backupText = JSON.stringify(createBackup(visible, { now: LATER }));
  assert.deepEqual(readBackup(backupText), visible);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'offline-continuity' });
  visible = await loadCompatibleState(repository);
  assert.deepEqual(visible, beforeClose);
  assert.deepEqual(getShoppingList(visible), listBefore);
  assert.equal(findEntry(visible, movedId).date, '2026-10-26');
  assert.equal(resolveRoute(visible.ui, { today: '2026-10-20' }).hash, '#calendar/2026-10-26');
  assert.deepEqual((await readStoredBackup({ indexedDB, name: 'offline-continuity', now: LATER })).state, visible);

  const restoredRepository = createIndexedDBRepository({ indexedDB, name: 'offline-restored' });
  t.after(() => restoredRepository.close());
  await loadCompatibleState(restoredRepository);
  let restored = await commitCandidate(restoredRepository, readBackup(backupText), { checkpoint: true });
  assert.deepEqual(await loadCompatibleState(restoredRepository), visible);
  restored = await commitCandidate(restoredRepository, undoLastImport(restored, { now: LATER }));
  assert.equal(findEntry(restored, movedId), null);
  assert.equal(getShoppingList(restored).manualItems[0].checked, true);
  assert.deepEqual(attempts, []);
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

test('offline transaction abort preserves visible/current/recovery data and the next opening reads the committed archive', async t => {
  const attempts = offline(t);
  const { indexedDB, control } = abortableFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'offline-abort' });
  t.after(() => repository.close());
  let visible = await loadCompatibleState(repository) ?? createAppState({ now: NOW });
  visible = await commitCandidate(repository, importOffline(visible).state);
  const recoveryBefore = cloneStateSnapshot(visible);
  visible = await commitCandidate(repository,
    addManualItem(visible, { name: 'Labels', quantity: 4, unit: 'unit' }, { itemId: 'labels', now: LATER }),
    { checkpoint: true });
  const before = visible;
  const candidate = setShoppingMode(visible, 'two', { now: LATER });
  control.abortNextWrite = true;
  await assert.rejects((async () => {
    visible = await commitCandidate(repository, candidate, { checkpoint: true });
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(control.putSucceeded, true);
  assert.equal(visible, before);
  assert.deepEqual(await loadCompatibleState(repository), before);
  assert.deepEqual(await repository.loadRecovery(), recoveryBefore);
  assert.deepEqual((await readStoredBackup({ indexedDB, name: 'offline-abort', now: LATER })).state, before);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'offline-abort' });
  visible = await loadCompatibleState(repository);
  assert.deepEqual(visible, before);
  assert.equal(getShoppingList(visible).mode, 'one');
  assert.equal(getShoppingList(visible).manualItems[0].quantity, 4);
  assert.deepEqual(readBackup(JSON.stringify(createBackup(visible, { now: LATER }))), before);
  assert.deepEqual(attempts, []);
});
