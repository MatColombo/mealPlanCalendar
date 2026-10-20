import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { readDietDocument } from '../src/data/diet.js';
import { prepareImport, previewImport, undoLastImport } from '../src/data/imports.js';
import { findEntry, getDayEntries, getShoppingItems, setEntryServings, setEntryTime } from '../src/data/session.js';
import { exportCalendarDiet } from '../src/data/export.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { validateAppState } from '../src/data/validation.js';
import { createIndexedDBRepository } from '../src/persistence/indexeddb.js';
import { commitCandidate } from '../src/persistence/commit.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';
const AFTER = '2026-10-19T19:00:00.000Z';

// Synthetic records exercise persistence, date assignment and quantities.
// They contain no nutritional estimates, targets or dietary assertions.
function documentFixture(planId = 'workflow-a') {
  const dates = ['2026-10-21', '2026-10-23', '2026-10-24'];
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: `Documento ${planId}`, language: 'it', createdAt: NOW,
    suggestedStartDate: dates[0], baseServings: 1,
    extension: { preserve: ['opaque', planId] },
    days: dates.map((date, index) => ({
      date,
      meals: [{
        mealId: `${planId}-record-${index}`, title: `Voce ${index + 1}`,
        time: '08:00', type: 'other',
        ingredients: [{ ingredientId: `${planId}-item`, name: 'Voce sintetica', quantity: index + 1, unit: 'unit', category: 'other' }],
        instructions: ['Istruzione dimostrativa.'],
      }],
    })),
  };
}

function importCandidate(state, document, startDate, options = {}) {
  return prepareImport(state, document, {
    startDate, dateConfirmed: true, fileName: `${document.planId}.diet`, now: NOW, ...options,
  });
}

function personalized(state, entryId) {
  const next = setEntryTime(setEntryServings(state, entryId, 3), entryId, '12:45');
  next.settings = { uiLanguage: 'en', reducedMotion: true, weekStartsOn: 0 };
  next.ui = { view: 'calendar', selectedDate: findEntry(next, entryId).date };
  next.shopping.mode = 'advanced';
  const row = getShoppingItems(next)[0];
  next.shopping.checked[row.key] = {
    checked: true, quantity: row.quantity, unit: row.unit, updatedAt: LATER,
  };
  next.shopping.manualItems.push({
    itemId: 'manual-personal', name: 'Oggetto personale', checked: true,
    quantity: 2, unit: 'box', category: 'other', extension: { retained: true },
  });
  next.meta.updatedAt = LATER;
  return validateAppState(next);
}

test('import, occurrence edits and shopping state survive reopening; repeated input is a no-op and exports effective dates', async () => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'workflow-import' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  const document = readDietDocument(JSON.stringify(documentFixture()));
  const imported = importCandidate(visible, document, '2026-10-24');
  visible = await commitCandidate(repository, imported.state);
  const entryId = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  visible = await commitCandidate(repository, personalized(visible, entryId));
  const beforeReload = cloneStateSnapshot(visible);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'workflow-import' });
  visible = validateAppState(await repository.load());
  assert.deepEqual(visible, beforeReload);
  assert.equal(findEntry(visible, entryId).cookingServings, 3);
  assert.equal(findEntry(visible, entryId).time, '12:45');
  assert.ok(visible.lastImportUndo);
  assert.deepEqual(visible.sourcePlans[imported.sourceId].document, document);

  const reread = readDietDocument(JSON.stringify(document, null, 2));
  const preview = previewImport(visible, reread, '2026-10-24');
  assert.equal(preview.noOp, true);
  assert.equal(preview.duplicate, true);
  const repeated = importCandidate(visible, reread, '2026-10-24', { fileName: 'renamed.diet' });
  assert.equal(repeated.noOp, true);
  assert.equal(repeated.state, visible);
  assert.equal(Object.keys(repeated.state.sourcePlans).length, 1);
  assert.equal(repeated.state.imports.length, 1);
  assert.deepEqual(await repository.load(), beforeReload);

  const exported = exportCalendarDiet(visible, { sourceId: imported.sourceId, now: AFTER });
  assert.deepEqual(exported.days.map(day => day.date), ['2026-10-24', '2026-10-26', '2026-10-27']);
  assert.equal(exported.days[0].meals[0].time, '12:45');
  assert.deepEqual(exported.days[0].meals[0].ingredients, document.days[0].meals[0].ingredients);
  assert.equal(exported.baseServings, 1);
  assert.equal(exported.language, 'it');
  repository.close();
});

test('undo after reopening restores replaced days and retains later unrelated occurrence, settings and shopping edits', async () => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'workflow-undo' });
  let visible = await repository.load() ?? createAppState({ now: NOW });
  visible = await commitCandidate(repository, importCandidate(visible, documentFixture('original'), '2026-10-24').state);
  const originalEntry = getDayEntries(visible, '2026-10-24')[0].entry.entryId;
  visible = await commitCandidate(repository, setEntryTime(setEntryServings(visible, originalEntry, 2), originalEntry, '10:15'));
  visible = await commitCandidate(repository, importCandidate(visible, documentFixture('unrelated'), '2026-12-01').state);
  const oldDays = Object.fromEntries(['2026-10-24', '2026-10-26', '2026-10-27']
    .map(date => [date, structuredClone(visible.calendar[date])]));
  visible = await commitCandidate(repository, importCandidate(visible, documentFixture('replacement'), '2026-10-24', {
    overwrite: true, now: LATER,
  }).state);

  const unrelatedEntry = getDayEntries(visible, '2026-12-01')[0].entry.entryId;
  let edited = cloneStateSnapshot(visible);
  edited.shopping.range = { startDate: '2026-12-01', endDate: '2026-12-04' };
  edited = personalized(edited, unrelatedEntry);
  visible = await commitCandidate(repository, edited);
  const unrelatedAfter = structuredClone(visible.calendar['2026-12-01']);
  const shoppingAfter = structuredClone(visible.shopping);
  const settingsAfter = structuredClone(visible.settings);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'workflow-undo' });
  visible = validateAppState(await repository.load());
  const latestImportId = visible.lastImportUndo.importId;
  visible = await commitCandidate(repository, undoLastImport(visible, { now: AFTER }));
  for (const [date, day] of Object.entries(oldDays)) assert.deepEqual(visible.calendar[date], day);
  assert.deepEqual(visible.calendar['2026-12-01'], unrelatedAfter);
  assert.deepEqual(visible.shopping, shoppingAfter);
  assert.deepEqual(visible.settings, settingsAfter);
  assert.equal(visible.imports.find(record => record.importId === latestImportId).status, 'undone');
  assert.equal(visible.lastImportUndo, null);
  assert.equal(Object.keys(visible.sourcePlans).length, 3);
  assert.deepEqual(await repository.load(), visible);
  repository.close();
});

test('versioned backup restore survives reopening and preserves the complete previous archive as recovery', async () => {
  const indexedDB = new IDBFactory();
  let repository = createIndexedDBRepository({ indexedDB, name: 'workflow-backup' });
  await repository.load();
  const previous = importCandidate(createAppState({ now: NOW }), documentFixture('previous'), '2026-12-01').state;
  let visible = await commitCandidate(repository, previous);
  const incomingImport = importCandidate(createAppState({ now: NOW }), documentFixture('incoming'), '2026-11-01');
  const incoming = personalized(incomingImport.state, getDayEntries(incomingImport.state, '2026-11-01')[0].entry.entryId);
  const backup = createBackup(incoming, { now: AFTER });
  assert.equal(backup.format, 'meal-planner.backup');
  assert.equal(backup.schemaVersion, 1);
  const candidate = readBackup(JSON.stringify(backup));
  visible = await commitCandidate(repository, candidate, { checkpoint: true });
  assert.deepEqual(visible, incoming);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name: 'workflow-backup' });
  visible = validateAppState(await repository.load());
  const recovery = validateAppState(await repository.loadRecovery());
  assert.deepEqual(visible, incoming);
  assert.deepEqual(recovery, previous);
  assert.deepEqual(readBackup(JSON.stringify(createBackup(recovery, { now: AFTER }))), previous);
  assert.ok(Object.isFrozen(visible.sourcePlans[incomingImport.sourceId].document));
  assert.ok(visible.lastImportUndo);
  repository.close();
});

function abortableFactory() {
  const native = new IDBFactory();
  const control = { abortNextWrite: false, currentPutSucceeded: false };
  return {
    control,
    indexedDB: {
      open(...args) {
        const request = native.open(...args);
        request.addEventListener('success', () => {
          const db = request.result;
          const transaction = db.transaction.bind(db);
          db.transaction = (...parameters) => {
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
                      control.currentPutSucceeded = true;
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

test('malformed restore input and abort after successful replacement requests preserve visible, stored and recovery state', async () => {
  const { indexedDB, control } = abortableFactory();
  const repository = createIndexedDBRepository({ indexedDB, name: 'workflow-failures' });
  await repository.load();
  const stateA = importCandidate(createAppState({ now: NOW }), documentFixture('archive-a'), '2026-10-24').state;
  const stateB = importCandidate(createAppState({ now: NOW }), documentFixture('archive-b'), '2026-11-01').state;
  const stateC = importCandidate(createAppState({ now: NOW }), documentFixture('archive-c'), '2026-12-01').state;
  let visible = await commitCandidate(repository, stateA);
  visible = await commitCandidate(repository, stateB, { checkpoint: true });
  const before = visible;

  const malformed = createBackup(stateC, { now: AFTER });
  malformed.state.calendar['2026-12-01'].meals[0].sourceId = 'missing-source';
  await assert.rejects((async () => {
    visible = await commitCandidate(repository, readBackup(JSON.stringify(malformed)), { checkpoint: true });
  })(), { code: 'BACKUP_INVALID_STATE' });
  assert.equal(visible, before);
  assert.deepEqual(await repository.load(), stateB);
  assert.deepEqual(await repository.loadRecovery(), stateA);

  control.abortNextWrite = true;
  const validCandidate = readBackup(JSON.stringify(createBackup(stateC, { now: AFTER })));
  await assert.rejects((async () => {
    visible = await commitCandidate(repository, validCandidate, { checkpoint: true });
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(control.currentPutSucceeded, true);
  assert.equal(visible, before);
  assert.deepEqual(await repository.load(), stateB);
  assert.deepEqual(await repository.loadRecovery(), stateA);
  repository.close();
});
