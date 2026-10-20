import { cloneStateSnapshot } from '../data/state.js';

/**
 * @typedef {Object} StateRepository
 * @property {'memory' | 'indexeddb'} kind
 * @property {() => Promise<object | null>} load Returns a separate snapshot.
 * @property {(state: object, options?: {checkpoint?: boolean, clearRecovery?: boolean}) => Promise<void>} save Copies its input; IndexedDB resolves only after transaction completion.
 * @property {() => Promise<void>} clear
 *
 * Durable app startup uses loadCompatibleState(repository): the current v1
 * state is checked and cloned without a write; future registered migrations
 * require an atomic pre-migration checkpoint. IndexedDB also guards state
 * headers during reads and within writes, so old app code cannot overwrite
 * a newer state. readStoredBackup provides a separate read-only escape hatch
 * for downloading an original archive without authorizing any replacement.
 */

/**
 * Phase 1 adapter: ephemeral process/tab memory, NOT durable browser storage.
 * A reload or a new repository instance loses its contents. The Phase 4
 * indexeddb.js adapter provides durable snapshots and surfaced storage errors.
 * Consumers must await saves; successful memory saves imply no persistence.
 * @param {object | null} [initialState]
 * @returns {StateRepository}
 */
export function createMemoryRepository(initialState = null) {
  let snapshot = initialState === null ? null : cloneStateSnapshot(initialState);
  return Object.freeze({
    kind: 'memory',
    async load() {
      return snapshot === null ? null : cloneStateSnapshot(snapshot);
    },
    async save(state) {
      // Finish copying before replacement so a copy failure retains old data.
      const next = cloneStateSnapshot(state);
      snapshot = next;
    },
    async clear() {
      snapshot = null;
    },
  });
}
