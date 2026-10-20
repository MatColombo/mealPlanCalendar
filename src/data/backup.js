import { cloneStateSnapshot, timestampFor } from './state.js';
import { stateMigrationPipeline } from '../persistence/migrations.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** @param {string} code @param {string} message */
function backupError(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Independent backup envelope. No source document is evaluated or normalized.
 * @param {Record<string, any>} state
 * @param {{now?: string | Date}} [options]
 */
export function createBackup(state, { now } = {}) {
  return {
    format: 'meal-planner.backup',
    schemaVersion: 1,
    exportedAt: timestampFor(now),
    state: cloneStateSnapshot(state),
  };
}

/**
 * Check the backup envelope and the state/reference graph needed to restore
 * it safely. No food, nutrition, recipe or dietary target is evaluated.
 * @param {string} text
 * @returns {Record<string, any>}
 */
export function readBackup(text) {
  if (typeof text !== 'string') {
    throw backupError('BACKUP_EXPECTED_TEXT', 'Expected a backup file as JSON text.');
  }
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw backupError('BACKUP_INVALID_JSON', 'The backup file is not readable JSON.');
  }
  if (!isRecord(backup) || backup.format !== 'meal-planner.backup') {
    throw backupError('BACKUP_UNSUPPORTED_FORMAT', 'This file does not use the meal-planner.backup format.');
  }
  if (backup.schemaVersion !== 1) {
    throw backupError('BACKUP_UNSUPPORTED_VERSION', 'This backup schema version is not supported.');
  }

  if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))
    || !/(?:Z|[+-]\d{2}:\d{2})$/.test(backup.exportedAt)) {
    throw backupError('BACKUP_INVALID_STATE', 'The backup has no readable export timestamp.');
  }
  // The envelope version is independent. Known state versions use the same
  // explicit compatibility path as a local archive, without writing anything.
  try { return stateMigrationPipeline.prepare(backup.state).state; }
  catch (cause) {
    throw Object.assign(backupError('BACKUP_INVALID_STATE', 'The backup does not contain a readable application state.'), { cause });
  }
}
