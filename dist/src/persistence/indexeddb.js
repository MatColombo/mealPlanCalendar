import { cloneStateSnapshot } from '../data/state.js';
import { createBackup } from '../data/backup.js';
import { CURRENT_STATE_VERSION, stateVersion } from './migrations.js';

// Storage schema versions are independent from the .diet and backup formats.
export const DATABASE_VERSION = 1;
const STORE = 'snapshots';
const CURRENT = 'current';
const RECOVERY = 'recovery';

/** Each GitHub Pages project has its own database within the shared origin. */
export function defaultDatabaseName(baseUrl = new URL('../../', import.meta.url)) {
  const path = new URL(baseUrl).pathname.replace(/\/+$/, '') || '/';
  return `meal-planner:${path}`;
}

function storageError(code, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { code });
}

function classifiedError(error, fallback) {
  if (error?.code?.startsWith?.('STORAGE_') || error?.code?.startsWith?.('STATE_')) return error;
  const code = {
    QuotaExceededError: 'STORAGE_QUOTA',
    SecurityError: 'STORAGE_UNAVAILABLE',
    NotSupportedError: 'STORAGE_UNAVAILABLE',
    VersionError: 'STORAGE_VERSION',
    InvalidStateError: 'STORAGE_CLOSED',
    AbortError: 'STORAGE_ABORT',
  }[error?.name] ?? fallback;
  return storageError(code, `IndexedDB operation failed (${code}).`, error);
}

/** Only storage-envelope integrity is checked here, never meal contents. */
function readRecord(value) {
  if (value === undefined) return { revision: 0, state: null };
  if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.revision)
    || value.revision < 0 || !Object.hasOwn(value, 'state')
    || (value.state !== null && (typeof value.state !== 'object' || Array.isArray(value.state)))) {
    throw storageError('STORAGE_READ', 'The stored snapshot envelope is not readable.');
  }
  return value;
}

/**
 * Durable repository for the complete application state. A single readwrite
 * transaction compares the last loaded revision, writes a recovery checkpoint
 * when requested, and replaces the current state. Request success alone never
 * resolves a save: the transaction must complete successfully.
 *
 * load() must succeed before save()/clear(). loadRecovery() does not change the
 * expected current revision. A conflict requires an explicit fresh load by the
 * caller; no existing data are silently replaced or merged.
 *
 * @param {{indexedDB?: IDBFactory, name?: string, supportedStateVersion?: number,
 *   onStatus?: (status: {type: 'blocked'|'versionchange'|'closed', code: string,
 *     oldVersion?: number, newVersion?: number|null}) => void}} [options]
 */
export function createIndexedDBRepository(options = {}) {
  const name = options.name ?? defaultDatabaseName();
  const onStatus = options.onStatus;
  const supportedStateVersion = options.supportedStateVersion ?? CURRENT_STATE_VERSION;
  if (!Number.isSafeInteger(supportedStateVersion) || supportedStateVersion < 1) {
    throw new TypeError('supportedStateVersion must be a positive safe integer.');
  }
  let factory;
  let availabilityError = null;
  try {
    factory = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB;
    if (!factory || typeof factory.open !== 'function') {
      availabilityError = storageError('STORAGE_UNAVAILABLE', 'IndexedDB is not available.');
    }
  } catch (error) {
    availabilityError = classifiedError(error, 'STORAGE_UNAVAILABLE');
  }

  let database = null;
  let opening = null;
  let cancelOpening = null;
  let terminalError = null;
  let loaded = false;
  let revision = 0;
  let queue = Promise.resolve();

  const notify = status => { if (typeof onStatus === 'function') onStatus(Object.freeze(status)); };
  const assertAvailable = () => {
    if (terminalError) throw terminalError;
    if (availabilityError) throw availabilityError;
  };

  function connection() {
    assertAvailable();
    if (database) return Promise.resolve(database);
    if (opening) return opening;

    let request;
    try {
      request = factory.open(name, DATABASE_VERSION);
    } catch (error) {
      return Promise.reject(classifiedError(error, 'STORAGE_OPEN'));
    }

    const pending = new Promise((resolve, reject) => {
      let settled = false;
      let abandoned = false;
      let upgradeError = null;
      const fail = error => {
        abandoned = true;
        if (settled) return;
        settled = true;
        cancelOpening = null;
        reject(error);
      };
      cancelOpening = fail;
      request.onblocked = event => {
        fail(storageError('STORAGE_BLOCKED', 'Another tab is blocking access to the database.'));
        notify({ type: 'blocked', code: 'STORAGE_BLOCKED', oldVersion: event.oldVersion, newVersion: event.newVersion });
      };
      request.onupgradeneeded = () => {
        // A rejected/closed open request cannot be cancelled directly. Abort a
        // later upgrade and close any eventual late connection instead.
        if (abandoned || terminalError) {
          request.transaction.abort();
          return;
        }
        try {
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        } catch (error) {
          upgradeError = classifiedError(error, 'STORAGE_OPEN');
          request.transaction.abort();
        }
      };
      request.onerror = () => fail(upgradeError ?? classifiedError(request.error, 'STORAGE_OPEN'));
      request.onsuccess = () => {
        const opened = request.result;
        if (abandoned || terminalError) {
          opened.close();
          return;
        }
        if (opened.version !== DATABASE_VERSION || !opened.objectStoreNames.contains(STORE)) {
          opened.close();
          fail(storageError('STORAGE_VERSION', 'The database storage schema is not supported.'));
          return;
        }
        database = opened;
        opened.onversionchange = event => {
          terminalError = storageError('STORAGE_CLOSED', 'The database changed version; reopen and reload explicitly.');
          database = null;
          opened.close();
          notify({ type: 'versionchange', code: 'STORAGE_VERSION', oldVersion: event.oldVersion, newVersion: event.newVersion });
        };
        opened.onclose = () => {
          if (terminalError) return;
          terminalError = storageError('STORAGE_CLOSED', 'The database connection closed unexpectedly.');
          database = null;
          notify({ type: 'closed', code: 'STORAGE_CLOSED' });
        };
        settled = true;
        cancelOpening = null;
        resolve(opened);
      };
    });
    opening = pending;
    // A rejected operation stays rejected for its caller. Clearing this cached
    // promise merely allows an explicit subsequent load() to retry the open.
    const finished = () => { if (opening === pending) opening = null; };
    pending.then(finished, finished);
    return pending;
  }

  function enqueue(operation) {
    const result = queue.then(() => { assertAvailable(); return operation(); });
    // Keep later user-initiated retries possible after a rejected operation.
    // Return the original promise so failures are never concealed from the UI.
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function read(key, updateRevision) {
    const db = await connection();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, 'readonly'); }
      catch (error) { reject(classifiedError(error, 'STORAGE_READ')); return; }
      let result = null;
      let nextRevision = revision;
      let failure = null;
      tx.onerror = event => { failure ??= classifiedError(event.target.error, 'STORAGE_READ'); };
      tx.onabort = () => reject(failure ?? terminalError ?? classifiedError(tx.error, 'STORAGE_ABORT'));
      tx.oncomplete = () => {
        if (failure) { reject(failure); return; }
        if (updateRevision) { revision = nextRevision; loaded = true; }
        resolve(result);
      };
      try {
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => {
          try {
            const record = readRecord(request.result);
            if (record.state !== null) stateVersion(record.state, supportedStateVersion);
            result = record.state === null ? null : cloneStateSnapshot(record.state);
            nextRevision = record.revision;
          } catch (error) {
            if (updateRevision && error?.code?.startsWith?.('STATE_')) loaded = false;
            failure = classifiedError(error, 'STORAGE_READ');
            tx.abort();
          }
        };
      } catch (error) {
        failure = classifiedError(error, 'STORAGE_READ');
        tx.abort();
      }
    });
  }

  async function write(candidate, checkpoint, clearRecovery) {
    if (!loaded) throw storageError('STORAGE_NOT_LOADED', 'Load the current state successfully before writing.');
    const db = await connection();
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, 'readwrite'); }
      catch (error) { reject(classifiedError(error, 'STORAGE_WRITE')); return; }
      let failure = null;
      let nextRevision = revision;
      tx.onerror = event => { failure ??= classifiedError(event.target.error, 'STORAGE_WRITE'); };
      tx.onabort = () => reject(failure ?? terminalError ?? classifiedError(tx.error, 'STORAGE_ABORT'));
      tx.oncomplete = () => {
        if (failure) { reject(failure); return; }
        revision = nextRevision;
        resolve();
      };
      try {
        const store = tx.objectStore(STORE);
        const request = store.get(CURRENT);
        request.onsuccess = () => {
          try {
            const previous = readRecord(request.result);
            // Check inside the same transaction as the revision comparison.
            // A cached v1 app cannot overwrite a newer or unknown document,
            // even if a different writer failed to increment its revision.
            const previousVersion = previous.state === null ? null : stateVersion(previous.state, supportedStateVersion);
            if (previous.revision !== revision) {
              throw storageError('STORAGE_CONFLICT', 'Another tab changed the stored state. Reload it before applying changes.');
            }
            if (revision === Number.MAX_SAFE_INTEGER) {
              throw storageError('STORAGE_WRITE', 'The stored revision cannot be incremented safely.');
            }
            if (previousVersion !== null && previousVersion < supportedStateVersion
              && (candidate === null || !checkpoint)) {
              throw Object.assign(new Error('An older state requires an explicit migration with a recovery checkpoint.'), {
                code: 'STATE_MIGRATION_REQUIRED', foundVersion: previousVersion, supportedVersion: supportedStateVersion,
              });
            }
            nextRevision = revision + 1;
            if (checkpoint) store.put(previous, RECOVERY);
            if (clearRecovery) store.delete(RECOVERY);
            // A null state is a revision tombstone, not a deleted record. This
            // prevents an old revision-0 tab from overwriting a cleared store.
            store.put({ revision: nextRevision, state: candidate }, CURRENT);
          } catch (error) {
            failure = classifiedError(error, 'STORAGE_WRITE');
            tx.abort();
          }
        };
      } catch (error) {
        failure = classifiedError(error, 'STORAGE_WRITE');
        tx.abort();
      }
    });
  }

  return Object.freeze({
    kind: 'indexeddb',
    name,
    load() { return enqueue(() => read(CURRENT, true)); },
    loadRecovery() { return enqueue(() => read(RECOVERY, false)); },
    save(state, { checkpoint = false, clearRecovery = false } = {}) {
      let candidate;
      try {
        if (checkpoint && clearRecovery) {
          throw storageError('STORAGE_WRITE', 'Checkpoint and clearRecovery cannot be requested together.');
        }
        if (!state || typeof state !== 'object' || Array.isArray(state)) {
          throw storageError('STORAGE_WRITE', 'A state object is required; use clear() to remove its contents.');
        }
        if (stateVersion(state, supportedStateVersion) !== supportedStateVersion) {
          throw Object.assign(new Error('A save cannot downgrade the application-state version.'), {
            code: 'STATE_UNSUPPORTED_VERSION', foundVersion: state.schemaVersion, supportedVersion: supportedStateVersion,
          });
        }
        // Snapshot immediately, before waiting for any previous operation.
        candidate = cloneStateSnapshot(state);
      } catch (error) { return Promise.reject(classifiedError(error, 'STORAGE_WRITE')); }
      return enqueue(() => write(candidate, checkpoint, clearRecovery));
    },
    clear() { return enqueue(() => write(null, false, true)); },
    close() {
      if (terminalError) return;
      terminalError = storageError('STORAGE_CLOSED', 'This repository has been closed.');
      database?.close();
      database = null;
      cancelOpening?.(terminalError);
      notify({ type: 'closed', code: 'STORAGE_CLOSED' });
    },
  });
}

/**
 * Read-only recovery independent of the app's supported state/DB version.
 * The original state and its version are copied unchanged into a backup
 * envelope; they are not validated, migrated or made writable. A compatible
 * future app may be needed to open that download. The physical snapshots
 * store/envelope must still be recognizable, otherwise this fails explicitly.
 * A missing database stays missing: its creation transaction is aborted.
 *
 * @param {{indexedDB?: IDBFactory, name?: string, record?: 'current'|'recovery', now?: string|Date}} [options]
 * @returns {Promise<object|null>}
 */
export async function readStoredBackup(options = {}) {
  const name = options.name ?? defaultDatabaseName();
  const key = options.record ?? CURRENT;
  if (![CURRENT, RECOVERY].includes(key)) {
    throw storageError('STORAGE_READ', 'Only current or recovery snapshots can be downloaded.');
  }
  let factory;
  try {
    factory = Object.hasOwn(options, 'indexedDB') ? options.indexedDB : globalThis.indexedDB;
    if (!factory || typeof factory.open !== 'function') {
      throw storageError('STORAGE_UNAVAILABLE', 'IndexedDB is not available.');
    }
  } catch (error) { throw classifiedError(error, 'STORAGE_UNAVAILABLE'); }

  return new Promise((resolve, reject) => {
    let request;
    let database = null;
    let settled = false;
    let missing = false;
    const finish = (error, backup = null) => {
      if (settled) return;
      settled = true;
      database?.close();
      if (error) reject(error);
      else resolve(backup);
    };
    try { request = factory.open(name); }
    catch (error) { finish(classifiedError(error, 'STORAGE_OPEN')); return; }
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction.abort();
    };
    request.onblocked = () => finish(storageError('STORAGE_BLOCKED', 'Another tab is blocking the original archive download.'));
    request.onerror = () => finish(missing ? null : classifiedError(request.error, 'STORAGE_OPEN'));
    request.onsuccess = () => {
      database = request.result;
      if (settled) { database.close(); return; }
      database.onversionchange = () => database.close();
      database.onclose = () => finish(storageError('STORAGE_CLOSED', 'The archive connection closed before reading completed.'));
      if (!database.objectStoreNames.contains(STORE)) {
        finish(storageError('STORAGE_VERSION', 'The original archive uses an unrecognized storage layout.'));
        return;
      }
      let tx;
      let backup = null;
      let failure = null;
      try { tx = database.transaction(STORE, 'readonly'); }
      catch (error) { finish(classifiedError(error, 'STORAGE_READ')); return; }
      tx.onerror = event => { failure ??= classifiedError(event.target.error, 'STORAGE_READ'); };
      tx.onabort = () => finish(failure ?? classifiedError(tx.error, 'STORAGE_ABORT'));
      tx.oncomplete = () => finish(failure, backup);
      try {
        const reading = tx.objectStore(STORE).get(key);
        reading.onsuccess = () => {
          try {
            const stored = readRecord(reading.result);
            if (stored.state !== null) backup = createBackup(stored.state, { now: options.now });
          } catch (error) {
            failure = classifiedError(error, 'STORAGE_READ');
            tx.abort();
          }
        };
      } catch (error) {
        failure = classifiedError(error, 'STORAGE_READ');
        tx.abort();
      }
    };
  });
}
