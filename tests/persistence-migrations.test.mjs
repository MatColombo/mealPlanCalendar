import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { prepareImport } from '../src/data/imports.js';
import { readBackup } from '../src/data/backup.js';
import {
  CURRENT_STATE_VERSION, STATE_MIGRATIONS, createStateMigrationPipeline, loadCompatibleState,
} from '../src/persistence/migrations.js';
import { createIndexedDBRepository, readStoredBackup } from '../src/persistence/indexeddb.js';

const NOW = '2026-10-19T17:00:00.000Z';

function fixture(label = 'current') {
  const state = prepareImport(createAppState({ now: NOW }), {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'migration-fixture',
    title: 'Documento tecnico', language: 'it', createdAt: NOW,
    suggestedStartDate: '2026-10-21', baseServings: 1,
    extension: { retained: ['original'] },
    days: [{ date: '2026-10-21', meals: [{
      mealId: 'record-1', title: 'Record sintetico', type: 'other', time: '12:00',
      ingredients: [{ ingredientId: 'synthetic', name: 'Voce', quantity: 2, unit: 'unit' }],
    }] }],
  }, { startDate: '2026-10-21', dateConfirmed: true, now: NOW }).state;
  state.extension = { label, untouched: ['metadata'] };
  return state;
}

function rawOpen(indexedDB, name, version) {
  return new Promise((resolve, reject) => {
    const request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function seed(indexedDB, name, current, recovery = null, version = 1) {
  const database = await rawOpen(indexedDB, name, version);
  try {
    await new Promise((resolve, reject) => {
      const tx = database.transaction('snapshots', 'readwrite');
      const store = tx.objectStore('snapshots');
      store.put({ revision: 7, state: current }, 'current');
      if (recovery !== null) store.put({ revision: 4, state: recovery }, 'recovery');
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}

async function physical(indexedDB, name) {
  const database = await rawOpen(indexedDB, name);
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('snapshots', 'readonly');
      const result = { databaseVersion: database.version };
      for (const key of ['current', 'recovery']) {
        const request = tx.objectStore('snapshots').get(key);
        request.onsuccess = () => { result[key] = request.result; };
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}

function instrument() {
  const native = new IDBFactory();
  const control = { writes: 0, abortNextWrite: false, putSucceeded: false };
  const indexedDB = {
    open(...args) {
      const request = native.open(...args);
      request.addEventListener('success', () => {
        const database = request.result;
        const transaction = database.transaction.bind(database);
        database.transaction = (...parameters) => {
          const tx = transaction(...parameters);
          if (parameters[1] === 'readwrite') {
            control.writes += 1;
            if (control.abortNextWrite) {
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
          }
          return tx;
        };
      });
      return request;
    },
  };
  return { native, indexedDB, control };
}

// Versions 2/3 exist ONLY in this injected test registry. These callbacks
// exercise migration mechanics, not a proposed or shipping AppState schema.
function syntheticPipeline({ trace = [], captured = [] } = {}) {
  return createStateMigrationPipeline({
    currentVersion: 3,
    steps: [2, 1].map(fromVersion => ({
      fromVersion, toVersion: fromVersion + 1,
      migrate(state) {
        trace.push(fromVersion);
        captured.push(state);
        state.schemaVersion = fromVersion + 1;
        state.extension.syntheticSteps = [...(state.extension.syntheticSteps ?? []), fromVersion];
        return state;
      },
    })),
    validate(state) {
      assert.equal(state.schemaVersion, 3);
      assert.deepEqual(state.extension.syntheticSteps, [1, 2]);
      return state;
    },
  });
}

test('the shipping v1 pipeline preserves legacy optional fields and recovery with zero writes', async t => {
  const { native, indexedDB, control } = instrument();
  const original = fixture();
  delete original.lastImportUndo;
  delete original.calendar['2026-10-21'].meals[0].assignmentId;
  original.shopping.manualItems.push({ itemId: 'legacy-note', name: 'Nota', checked: true });
  const recovery = fixture('previous recovery');
  await seed(native, 'migration-v1', original, recovery);
  const repository = createIndexedDBRepository({ indexedDB, name: 'migration-v1' });
  t.after(() => repository.close());
  assert.equal(CURRENT_STATE_VERSION, 1);
  assert.deepEqual(STATE_MIGRATIONS, []);
  const loaded = await loadCompatibleState(repository);
  assert.deepEqual(loaded, original);
  assert.equal(Object.hasOwn(loaded, 'lastImportUndo'), false);
  assert.equal(Object.hasOwn(loaded.calendar['2026-10-21'].meals[0], 'assignmentId'), false);
  assert.ok(Object.isFrozen(Object.values(loaded.sourcePlans)[0].document));
  loaded.extension.untouched.push('caller');
  assert.deepEqual(await loadCompatibleState(repository), original);
  assert.deepEqual(await repository.loadRecovery(), recovery);
  assert.equal(control.writes, 0);
  const stored = await physical(native, 'migration-v1');
  assert.equal(stored.current.revision, 7);
  assert.deepEqual(stored.current.state, original);
  assert.deepEqual(stored.recovery.state, recovery);
});

test('injected migration steps run in version order on isolated snapshots and reject gaps, reverse paths and future versions', () => {
  const original = fixture();
  const before = cloneStateSnapshot(original);
  const trace = [];
  const captured = [];
  const pipeline = syntheticPipeline({ trace, captured });
  const result = pipeline.prepare(original);
  assert.deepEqual(trace, [1, 2]);
  assert.deepEqual(result.steps, [{ fromVersion: 1, toVersion: 2 }, { fromVersion: 2, toVersion: 3 }]);
  assert.equal(result.migrated, true);
  assert.equal(result.fromVersion, 1);
  assert.equal(result.toVersion, 3);
  assert.deepEqual(original, before);
  captured[1].extension.syntheticSteps.push('callback retained reference');
  assert.deepEqual(result.state.extension.syntheticSteps, [1, 2]);
  assert.deepEqual(Object.values(result.state.sourcePlans)[0].document, Object.values(original.sourcePlans)[0].document);

  let invoked = false;
  const gap = createStateMigrationPipeline({ currentVersion: 3, steps: [{
    fromVersion: 2, toVersion: 3, migrate() { invoked = true; },
  }], validate: value => value });
  assert.throws(() => gap.prepare(original), { code: 'STATE_MIGRATION_GAP' });
  assert.equal(invoked, false);
  assert.throws(() => createStateMigrationPipeline({ currentVersion: 2, steps: [{
    fromVersion: 2, toVersion: 1, migrate: value => value,
  }] }), { code: 'STATE_MIGRATION_INVALID' });
  assert.throws(() => pipeline.prepare({ ...original, schemaVersion: 4 }), { code: 'STATE_UNSUPPORTED_VERSION' });
  const wrongOutput = createStateMigrationPipeline({ currentVersion: 2, steps: [{
    fromVersion: 1, toVersion: 2, migrate: value => value,
  }], validate: value => value });
  assert.throws(() => wrongOutput.prepare(original), { code: 'STATE_MIGRATION_FAILED' });
  assert.deepEqual(original, before);
});

test('a registered future migration commits once with the original recovery and stale v1 code cannot overwrite or downgrade it', async t => {
  const indexedDB = new IDBFactory();
  const original = fixture();
  await seed(indexedDB, 'migration-atomic', original, fixture('older recovery'));
  const oldApp = createIndexedDBRepository({ indexedDB, name: 'migration-atomic' });
  const futureApp = createIndexedDBRepository({ indexedDB, name: 'migration-atomic', supportedStateVersion: 3 });
  t.after(() => { oldApp.close(); futureApp.close(); });
  await oldApp.load();
  await futureApp.load();
  const prepared = syntheticPipeline().prepare(original).state;
  await assert.rejects(futureApp.save(prepared), { code: 'STATE_MIGRATION_REQUIRED' });
  await assert.rejects(futureApp.clear(), { code: 'STATE_MIGRATION_REQUIRED' });
  const migrated = await loadCompatibleState(futureApp, { pipeline: syntheticPipeline() });
  const stored = await physical(indexedDB, 'migration-atomic');
  assert.equal(stored.current.revision, 8);
  assert.deepEqual(stored.current.state, migrated);
  assert.deepEqual(stored.recovery, { revision: 7, state: original });
  await assert.rejects(oldApp.save(original), { code: 'STATE_UNSUPPORTED_VERSION' });
  await assert.rejects(oldApp.clear(), { code: 'STATE_UNSUPPORTED_VERSION' });
  await assert.rejects(oldApp.load(), { code: 'STATE_UNSUPPORTED_VERSION' });
  await assert.rejects(futureApp.save(original, { checkpoint: true }), { code: 'STATE_UNSUPPORTED_VERSION' });
  const backup = await readStoredBackup({ indexedDB, name: 'migration-atomic', now: NOW });
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.state.schemaVersion, 3);
  assert.deepEqual(backup.state, migrated);
  assert.throws(() => readBackup(JSON.stringify(backup)), { code: 'BACKUP_INVALID_STATE' });
  await assert.rejects(oldApp.save(original), { code: 'STORAGE_NOT_LOADED' });
  assert.deepEqual(await physical(indexedDB, 'migration-atomic'), stored);
});

test('failed transformation, validation, transaction and concurrent save leave the original migration input and recovery intact', async t => {
  const { native, indexedDB, control } = instrument();
  const original = fixture();
  const priorRecovery = fixture('existing recovery');
  await seed(native, 'migration-failure', original, priorRecovery);
  const repository = createIndexedDBRepository({ indexedDB, name: 'migration-failure', supportedStateVersion: 3 });
  const competing = createIndexedDBRepository({ indexedDB: native, name: 'migration-failure' });
  t.after(() => { repository.close(); competing.close(); });
  const before = await physical(native, 'migration-failure');
  let visible = original;
  const throwing = createStateMigrationPipeline({ currentVersion: 2, steps: [{
    fromVersion: 1, toVersion: 2,
    migrate(state) { state.extension.untouched.push('isolated'); throw new Error('synthetic failure'); },
  }] });
  await assert.rejects(loadCompatibleState(repository, { pipeline: throwing }), { code: 'STATE_MIGRATION_FAILED' });
  const invalidFinal = createStateMigrationPipeline({ currentVersion: 2, steps: [{
    fromVersion: 1, toVersion: 2, migrate: state => ({ ...state, schemaVersion: 2 }),
  }], validate() { throw new Error('synthetic target validation failure'); } });
  await assert.rejects(loadCompatibleState(repository, { pipeline: invalidFinal }), { code: 'STATE_MIGRATION_FAILED' });
  assert.equal(control.writes, 0);
  assert.deepEqual(await physical(native, 'migration-failure'), before);

  control.abortNextWrite = true;
  await assert.rejects((async () => {
    visible = await loadCompatibleState(repository, { pipeline: syntheticPipeline() });
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(control.putSucceeded, true);
  assert.equal(visible, original);
  assert.deepEqual(await physical(native, 'migration-failure'), before);

  await competing.load();
  const winner = fixture('other tab saved while migration was being prepared');
  const interleaved = {
    load: () => repository.load(),
    async save(candidate, options) {
      await competing.save(winner);
      return repository.save(candidate, options);
    },
  };
  await assert.rejects(loadCompatibleState(interleaved, { pipeline: syntheticPipeline() }), { code: 'STORAGE_CONFLICT' });
  const after = await physical(native, 'migration-failure');
  assert.deepEqual(after.current.state, winner);
  assert.deepEqual(after.recovery.state, priorRecovery);
  assert.deepEqual(original.extension.untouched, ['metadata']);
});

test('original archive recovery reads newer physical versions without upgrades and refuses to manufacture or overwrite unknown storage', async t => {
  const indexedDB = new IDBFactory();
  const future = { ...fixture('future original'), schemaVersion: 99, unknown: { retained: ['verbatim JSON values'] } };
  await seed(indexedDB, 'future-physical', future, fixture('recovery copy'), 8);
  const repository = createIndexedDBRepository({ indexedDB, name: 'future-physical' });
  t.after(() => repository.close());
  await assert.rejects(repository.load(), { code: 'STORAGE_VERSION' });
  const before = await physical(indexedDB, 'future-physical');
  const backup = await readStoredBackup({ indexedDB, name: 'future-physical', now: NOW });
  assert.deepEqual(backup.state, future);
  assert.deepEqual(await readStoredBackup({ indexedDB, name: 'future-physical', record: 'recovery', now: NOW }), {
    format: 'meal-planner.backup', schemaVersion: 1, exportedAt: NOW, state: before.recovery.state,
  });
  backup.state.unknown.retained.push('caller only');
  assert.deepEqual(await physical(indexedDB, 'future-physical'), before);
  await assert.rejects(repository.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
  assert.equal(await readStoredBackup({ indexedDB, name: 'does-not-exist' }), null);
  assert.equal((await indexedDB.databases()).some(database => database.name === 'does-not-exist'), false);

  const unknown = { format: 'another.state', schemaVersion: 1, opaque: { keep: true } };
  await seed(indexedDB, 'unknown-header', fixture());
  const oldApp = createIndexedDBRepository({ indexedDB, name: 'unknown-header' });
  t.after(() => oldApp.close());
  await oldApp.load();
  // Replacing a header without incrementing its revision still cannot bypass
  // the format/version check inside the eventual write transaction.
  await seed(indexedDB, 'unknown-header', unknown);
  await assert.rejects(oldApp.save(fixture()), { code: 'STATE_INVALID_STATE' });
  await assert.rejects(oldApp.load(), { code: 'STATE_INVALID_STATE' });
  await assert.rejects(oldApp.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
  assert.deepEqual((await readStoredBackup({ indexedDB, name: 'unknown-header' })).state, unknown);

  const changedLayout = await new Promise((resolve, reject) => {
    const request = indexedDB.open('changed-layout', 4);
    request.onupgradeneeded = () => request.result.createObjectStore('different-store');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  changedLayout.close();
  await assert.rejects(readStoredBackup({ indexedDB, name: 'changed-layout' }), { code: 'STORAGE_VERSION' });
  assert.equal((await indexedDB.databases()).find(database => database.name === 'changed-layout').version, 4);
});
