import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, forceCloseDatabase } from 'fake-indexeddb';
import { addSourcePlan, createAppState } from '../src/data/state.js';
import { createIndexedDBRepository, defaultDatabaseName } from '../src/persistence/indexeddb.js';
import { commitCandidate } from '../src/persistence/commit.js';

const NOW = '2026-10-19T17:00:00.000Z';
const NAME = 'technical-persistence-test';

// These fixtures contain opaque technical records, never meal recommendations
// or nutrition expectations. Runtime storage has no third-party dependencies;
// fake-indexeddb provides actual IDB transactions only in this Node test file.
function fixture(label = 'first') {
  const initial = createAppState({ now: NOW });
  const { state } = addSourcePlan(initial, {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'opaque-source',
    title: label, language: 'it', days: [{ date: '2026-10-21', meals: [] }],
    retainedMetadata: { label },
  }, { sourceId: 'source-a', now: NOW });
  state.shopping.manualItems = [{ itemId: 'manual-a', name: label, checked: false }];
  state.imports = [{ importId: label, custom: { retained: true } }];
  state.ui.selectedDate = '2026-10-23';
  return state;
}

function rawOpen(factory, name = NAME, version = 1, upgrade) {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Instrument the real in-memory IDB implementation at public API boundaries. */
function instrument() {
  const native = new IDBFactory();
  const hooks = {};
  let latestDatabase;
  const indexedDB = {
    open(...args) {
      const request = native.open(...args);
      request.addEventListener('success', () => {
        const db = request.result;
        latestDatabase = db;
        const transaction = db.transaction.bind(db);
        db.transaction = (...parameters) => {
          hooks.beforeTransaction?.(...parameters);
          const tx = transaction(...parameters);
          hooks.transaction?.(tx);
          const objectStore = tx.objectStore.bind(tx);
          const wrapped = new WeakSet();
          tx.objectStore = (...storeArgs) => {
            const store = objectStore(...storeArgs);
            if (!wrapped.has(store)) {
              wrapped.add(store);
              const get = store.get.bind(store);
              store.get = key => { hooks.beforeGet?.(key, tx); return get(key); };
              const put = store.put.bind(store);
              store.put = (value, key) => {
                hooks.beforePut?.(key, tx, value);
                const result = hooks.put ? hooks.put(value, key, store, tx) : put(value, key);
                result.addEventListener('success', () => hooks.putSuccess?.(key, tx));
                return result;
              };
            }
            return store;
          };
          return tx;
        };
      });
      return request;
    },
  };
  return { native, indexedDB, hooks, get database() { return latestDatabase; } };
}

test('database names isolate GitHub Pages projects and remain stable for an app path', () => {
  assert.equal(defaultDatabaseName('https://example.github.io/project-a/'), 'meal-planner:/project-a');
  assert.equal(defaultDatabaseName('https://example.github.io/project-b/'), 'meal-planner:/project-b');
  assert.equal(defaultDatabaseName('https://example.github.io/'), 'meal-planner:/');
  assert.equal(defaultDatabaseName('https://example.github.io/project-a'), 'meal-planner:/project-a');
});

test('reload retains all state, snapshots isolate callers, and original sources remain frozen', async () => {
  const indexedDB = new IDBFactory();
  const first = createIndexedDBRepository({ indexedDB, name: NAME });
  assert.equal(first.kind, 'indexeddb');
  assert.equal(await first.load(), null);
  const candidate = fixture();
  const original = structuredClone(candidate);
  const saving = first.save(candidate);
  candidate.shopping.manualItems[0].name = 'caller changed while save was queued';
  await saving;
  first.close();

  const reloaded = createIndexedDBRepository({ indexedDB, name: NAME });
  const read = await reloaded.load();
  assert.deepEqual(read, original);
  assert.ok(Object.isFrozen(read.sourcePlans['source-a'].document));
  assert.ok(Object.isFrozen(read.sourcePlans['source-a'].document.retainedMetadata));
  assert.throws(() => { read.sourcePlans['source-a'].document.title = 'changed'; }, TypeError);
  read.settings.uiLanguage = 'en';
  read.imports[0].custom.retained = false;
  assert.deepEqual(await reloaded.load(), original);
  reloaded.close();
});

test('writes require a successful initial load and cannot overwrite an unknown archive', async () => {
  const indexedDB = new IDBFactory();
  const first = createIndexedDBRepository({ indexedDB, name: NAME });
  await assert.rejects(first.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
  await assert.rejects(first.clear(), { code: 'STORAGE_NOT_LOADED' });
  await first.load();
  await first.save(fixture());
  const another = createIndexedDBRepository({ indexedDB, name: NAME });
  await assert.rejects(another.save(fixture('unknown replacement')), { code: 'STORAGE_NOT_LOADED' });
  assert.equal(await another.loadRecovery(), null);
  await assert.rejects(another.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
  assert.deepEqual(await another.load(), fixture());
  first.close();
  another.close();
});

test('a save resolves on transaction complete, not successful put, and late abort retains current state', async () => {
  const control = instrument();
  const repository = createIndexedDBRepository({ indexedDB: control.indexedDB, name: NAME });
  await repository.load();
  await repository.save(fixture());
  let current = await repository.load();
  const before = structuredClone(current);
  let putSucceeded = false;
  let committed = false;
  let completedAtResolution = false;
  control.hooks.transaction = tx => {
    if (tx.mode === 'readwrite') tx.addEventListener('complete', () => { committed = true; });
  };
  control.hooks.putSuccess = (key, tx) => {
    if (key === 'current') { putSucceeded = true; tx.abort(); }
  };
  await assert.rejects((async () => {
    current = await commitCandidate(repository, fixture('candidate'));
    completedAtResolution = committed;
  })(), { code: 'STORAGE_ABORT' });
  assert.equal(putSucceeded, true);
  assert.equal(committed, false);
  assert.equal(completedAtResolution, false);
  assert.deepEqual(current, before);
  assert.deepEqual(await repository.load(), before);

  control.hooks.putSuccess = undefined;
  current = await commitCandidate(repository, fixture('successful retry'));
  assert.equal(committed, true);
  assert.deepEqual(current, await repository.load());
  repository.close();
});

test('restore checkpoints are atomic, survive ordinary saves, and failed restore retains both snapshots', async () => {
  const control = instrument();
  const repository = createIndexedDBRepository({ indexedDB: control.indexedDB, name: NAME });
  await repository.load();
  const a = fixture('before first restore');
  const b = fixture('restored');
  const c = fixture('second restore must fail');
  await repository.save(a);
  await repository.save(b, { checkpoint: true });
  assert.deepEqual(await repository.load(), b);
  assert.deepEqual(await repository.loadRecovery(), a);
  control.hooks.beforePut = key => {
    if (key === 'current') throw new DOMException('Simulated full disk', 'QuotaExceededError');
  };
  await assert.rejects(repository.save(c, { checkpoint: true }), { code: 'STORAGE_QUOTA' });
  assert.deepEqual(await repository.load(), b);
  const recovery = await repository.loadRecovery();
  assert.deepEqual(recovery, a);
  assert.ok(Object.isFrozen(recovery.sourcePlans['source-a'].document));
  control.hooks.beforePut = undefined;
  // Both replacement puts have succeeded before the final request triggers an
  // abort. Neither current nor recovery may expose those uncommitted changes.
  control.hooks.putSuccess = (key, tx) => { if (key === 'current') tx.abort(); };
  await assert.rejects(repository.save(c, { checkpoint: true }), { code: 'STORAGE_ABORT' });
  assert.deepEqual(await repository.load(), b);
  assert.deepEqual(await repository.loadRecovery(), a);
  control.hooks.putSuccess = undefined;
  const edited = fixture('ordinary edit after restore');
  // loadRecovery() must not replace the expected revision with its older one.
  await repository.save(edited);
  assert.deepEqual(await repository.load(), edited);
  assert.deepEqual(await repository.loadRecovery(), a);
  repository.close();
});

test('optimistic concurrency uses the current transaction revision across two independent tabs', async () => {
  const indexedDB = new IDBFactory();
  const a = createIndexedDBRepository({ indexedDB, name: NAME });
  const b = createIndexedDBRepository({ indexedDB, name: NAME });
  assert.equal(await a.load(), null);
  assert.equal(await b.load(), null);
  const outcomes = await Promise.allSettled([a.save(fixture('a')), b.save(fixture('b'))]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = outcomes.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'STORAGE_CONFLICT');
  const winner = outcomes[0].status === 'fulfilled' ? a : b;
  const stale = winner === a ? b : a;
  const saved = await winner.load();
  await assert.rejects(stale.save(fixture('must remain stale')), { code: 'STORAGE_CONFLICT' });
  assert.deepEqual(await winner.load(), saved);
  assert.deepEqual(await stale.load(), saved);
  await stale.save(fixture('explicitly reapplied after reload'));
  assert.equal((await winner.load()).shopping.manualItems[0].name, 'explicitly reapplied after reload');
  a.close();
  b.close();
});

test('clear keeps a revision tombstone and removes recovery without allowing an ABA overwrite', async () => {
  const indexedDB = new IDBFactory();
  const current = createIndexedDBRepository({ indexedDB, name: NAME });
  const stale = createIndexedDBRepository({ indexedDB, name: NAME });
  await current.load();
  await stale.load();
  await current.save(fixture());
  await current.save(fixture('restored'), { checkpoint: true });
  await current.clear();
  assert.equal(await current.load(), null);
  assert.equal(await current.loadRecovery(), null);
  await assert.rejects(stale.save(fixture('revision zero writer')), { code: 'STORAGE_CONFLICT' });
  const raw = await rawOpen(indexedDB);
  const record = await new Promise((resolve, reject) => {
    const request = raw.transaction('snapshots').objectStore('snapshots').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  assert.deepEqual(record, { revision: 3, state: null });
  raw.close();
  current.close();
  stale.close();
});

test('clearRecovery atomically removes the prior archive while saving retained UI settings', async () => {
  const control = instrument();
  const repository = createIndexedDBRepository({ indexedDB: control.indexedDB, name: NAME });
  await repository.load();
  await repository.save(fixture('before'));
  await repository.save(fixture('after'), { checkpoint: true });
  const empty = createAppState({ now: NOW, uiLanguage: 'en' });
  control.hooks.putSuccess = (key, tx) => { if (key === 'current') tx.abort(); };
  await assert.rejects(repository.save(empty, { clearRecovery: true }), { code: 'STORAGE_ABORT' });
  assert.deepEqual(await repository.loadRecovery(), fixture('before'));
  assert.deepEqual(await repository.load(), fixture('after'));
  control.hooks.putSuccess = undefined;
  await assert.rejects(repository.save(empty, { checkpoint: true, clearRecovery: true }), { code: 'STORAGE_WRITE' });
  await repository.save(empty, { clearRecovery: true });
  assert.deepEqual(await repository.load(), empty);
  assert.equal(await repository.loadRecovery(), null);
  repository.close();
});

test('read and write errors remain explicit and neither change the current snapshot nor poison retry', async () => {
  const control = instrument();
  const repository = createIndexedDBRepository({ indexedDB: control.indexedDB, name: NAME });
  await repository.load();
  await repository.save(fixture());
  control.hooks.beforeGet = () => { throw new DOMException('Simulated read failure', 'UnknownError'); };
  await assert.rejects(repository.load(), { code: 'STORAGE_READ' });
  control.hooks.beforeGet = undefined;
  control.hooks.beforePut = () => { throw new DOMException('Simulated write failure', 'UnknownError'); };
  await assert.rejects(repository.save(fixture('failed')), { code: 'STORAGE_WRITE' });
  control.hooks.beforePut = undefined;
  // A duplicate add produces a genuine asynchronous IDB request error.
  control.hooks.put = (value, key, store) => store.add(value, key);
  await assert.rejects(repository.save(fixture('request failed')), { code: 'STORAGE_WRITE' });
  control.hooks.put = undefined;
  // Failed write must not advance the last loaded revision.
  await repository.save(fixture('retried'));
  assert.deepEqual(await repository.load(), fixture('retried'));
  const unsupported = fixture('cannot clone');
  unsupported.extension = () => null;
  await assert.rejects(repository.save(unsupported), { code: 'STORAGE_WRITE' });
  assert.deepEqual(await repository.load(), fixture('retried'));
  repository.close();
});

test('missing, denied and failed IndexedDB opens never fall back to memory or permit writes', async () => {
  const unavailable = createIndexedDBRepository({ indexedDB: undefined });
  await assert.rejects(unavailable.load(), { code: 'STORAGE_UNAVAILABLE' });
  const denied = createIndexedDBRepository({ indexedDB: {
    open() { throw new DOMException('Access denied', 'SecurityError'); },
  } });
  await assert.rejects(denied.load(), { code: 'STORAGE_UNAVAILABLE' });
  const failed = createIndexedDBRepository({ indexedDB: {
    open() {
      const request = { error: new DOMException('Open failure', 'UnknownError') };
      queueMicrotask(() => request.onerror());
      return request;
    },
  } });
  await assert.rejects(failed.load(), { code: 'STORAGE_OPEN' });
  await assert.rejects(failed.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
});

test('blocked opens reject promptly and close a late successful connection before an explicit retry', async () => {
  const native = new IDBFactory();
  const seed = await rawOpen(native, NAME, 1, db => db.createObjectStore('snapshots'));
  seed.close();
  const statuses = [];
  let deliverLateSuccess;
  let lateDatabase;
  let attempt = 0;
  const indexedDB = {
    open(...args) {
      if (attempt++ > 0) return native.open(...args);
      const facade = {};
      queueMicrotask(() => facade.onblocked({ oldVersion: 0, newVersion: 1 }));
      deliverLateSuccess = async () => {
        lateDatabase = await rawOpen(native);
        facade.result = lateDatabase;
        facade.onsuccess();
      };
      return facade;
    },
  };
  const repository = createIndexedDBRepository({ indexedDB, name: NAME, onStatus: status => statuses.push(status) });
  await assert.rejects(repository.load(), { code: 'STORAGE_BLOCKED' });
  assert.equal(statuses[0].type, 'blocked');
  await deliverLateSuccess();
  assert.throws(() => lateDatabase.transaction('snapshots'), { name: 'InvalidStateError' });
  assert.equal(await repository.load(), null);
  await repository.save(fixture('explicit retry'));
  assert.deepEqual(await repository.load(), fixture('explicit retry'));
  repository.close();
});

test('versionchange closes the old connection and requires a new supported repository', async () => {
  const indexedDB = new IDBFactory();
  const statuses = [];
  const repository = createIndexedDBRepository({ indexedDB, name: NAME, onStatus: status => statuses.push(status) });
  await repository.load();
  await repository.save(fixture());
  const newer = await rawOpen(indexedDB, NAME, 2);
  assert.deepEqual(statuses[0], { type: 'versionchange', code: 'STORAGE_VERSION', oldVersion: 1, newVersion: 2 });
  await assert.rejects(repository.save(fixture('stale code')), { code: 'STORAGE_CLOSED' });
  await assert.rejects(repository.load(), { code: 'STORAGE_CLOSED' });
  const unsupported = createIndexedDBRepository({ indexedDB, name: NAME });
  await assert.rejects(unsupported.load(), { code: 'STORAGE_VERSION' });
  newer.close();
});

test('unexpected database closure is reported and the repository stays closed', async () => {
  const control = instrument();
  let closed;
  const notification = new Promise(resolve => { closed = resolve; });
  const repository = createIndexedDBRepository({ indexedDB: control.indexedDB, name: NAME, onStatus: closed });
  await repository.load();
  await repository.save(fixture());
  forceCloseDatabase(control.database);
  assert.deepEqual(await notification, { type: 'closed', code: 'STORAGE_CLOSED' });
  await assert.rejects(repository.load(), { code: 'STORAGE_CLOSED' });
  await assert.rejects(repository.save(fixture('closed')), { code: 'STORAGE_CLOSED' });
  const reopened = createIndexedDBRepository({ indexedDB: control.native, name: NAME });
  assert.deepEqual(await reopened.load(), fixture());
  reopened.close();
});

test('closing while an open is pending rejects its caller and closes the late result', async () => {
  const native = new IDBFactory();
  const seed = await rawOpen(native, NAME, 1, db => db.createObjectStore('snapshots'));
  seed.close();
  let deliverSuccess;
  let lateDatabase;
  let started;
  const opening = new Promise(resolve => { started = resolve; });
  const repository = createIndexedDBRepository({ name: NAME, indexedDB: {
    open() {
      const facade = {};
      deliverSuccess = async () => {
        lateDatabase = await rawOpen(native);
        facade.result = lateDatabase;
        facade.onsuccess();
      };
      started();
      return facade;
    },
  } });
  const loading = repository.load();
  await opening;
  repository.close();
  await assert.rejects(loading, { code: 'STORAGE_CLOSED' });
  await deliverSuccess();
  assert.throws(() => lateDatabase.transaction('snapshots'), { name: 'InvalidStateError' });
  await assert.rejects(repository.load(), { code: 'STORAGE_CLOSED' });
});

test('unrecognized storage envelopes and schema are rejected without deleting existing data', async () => {
  const native = new IDBFactory();
  const raw = await rawOpen(native, NAME, 1, db => db.createObjectStore('snapshots'));
  await new Promise((resolve, reject) => {
    const tx = raw.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put({ revision: 'invalid', state: fixture() }, 'current');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  const corrupt = createIndexedDBRepository({ indexedDB: native, name: NAME });
  await assert.rejects(corrupt.load(), { code: 'STORAGE_READ' });
  await assert.rejects(corrupt.save(fixture()), { code: 'STORAGE_NOT_LOADED' });
  raw.close();
  corrupt.close();

  const missingStore = await rawOpen(native, 'unexpected-schema', 1);
  missingStore.close();
  const unsupported = createIndexedDBRepository({ indexedDB: native, name: 'unexpected-schema' });
  await assert.rejects(unsupported.load(), { code: 'STORAGE_VERSION' });
});
