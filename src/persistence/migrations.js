/**
 * Explicit application-state compatibility, independent of IndexedDB's own
 * store version. Version 1 needs no migration; optional v1 fields stay absent.
 * Future code must register every adjacent step and its target validator.
 */
import { cloneStateSnapshot } from '../data/state.js';
import { validateAppState } from '../data/validation.js';

export const CURRENT_STATE_VERSION = 1;
export const STATE_MIGRATIONS = Object.freeze([]);

function migrationError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function isVersion(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

/** Header guard only. Full state/reference validation belongs to the pipeline. */
export function stateVersion(state, supportedVersion = CURRENT_STATE_VERSION) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.format !== 'meal-planner.state') {
    throw migrationError('STATE_INVALID_STATE', 'The stored value is not a supported application-state document.');
  }
  const version = state.schemaVersion;
  if (!isVersion(version) || version > supportedVersion) {
    throw migrationError('STATE_UNSUPPORTED_VERSION', 'The application-state version is not supported by this app.', {
      foundVersion: version, supportedVersion,
    });
  }
  return version;
}

/**
 * Build an immutable registry of synchronous n -> n+1 transformations.
 * Definitions can arrive unordered; execution follows the version chain.
 * Callbacks receive isolated snapshots and must return an explicit state.
 * Passing another currentVersion/validator is a future-release integration
 * point and a test seam, not an instruction to invent or infer a new schema.
 *
 * @param {{currentVersion?: number,
 *   steps?: Array<{fromVersion: number, toVersion: number, migrate: Function}>,
 *   validate?: Function}} [options]
 */
export function createStateMigrationPipeline({
  currentVersion = CURRENT_STATE_VERSION, steps = STATE_MIGRATIONS, validate = validateAppState,
} = {}) {
  if (!isVersion(currentVersion) || !Array.isArray(steps) || typeof validate !== 'function') {
    throw migrationError('STATE_MIGRATION_INVALID', 'A migration registry needs a target version, steps and a validator.');
  }
  const registry = new Map();
  for (const step of steps) {
    if (!step || !isVersion(step.fromVersion) || !isVersion(step.toVersion)
      || step.toVersion !== step.fromVersion + 1 || step.toVersion > currentVersion
      || typeof step.migrate !== 'function' || registry.has(step.fromVersion)) {
      throw migrationError('STATE_MIGRATION_INVALID', 'Migration steps must be distinct adjacent forward versions.');
    }
    registry.set(step.fromVersion, Object.freeze({
      fromVersion: step.fromVersion, toVersion: step.toVersion, migrate: step.migrate,
    }));
  }

  function prepare(state) {
    const fromVersion = stateVersion(state, currentVersion);
    const path = [];
    // Check the whole path before invoking any transformation. A missing step
    // never causes a partial in-memory migration, let alone a partial save.
    for (let version = fromVersion; version < currentVersion; version += 1) {
      const step = registry.get(version);
      if (!step) {
        throw migrationError('STATE_MIGRATION_GAP', 'No complete migration path exists for this state version.', {
          fromVersion, missingVersion: version, supportedVersion: currentVersion,
        });
      }
      path.push(step);
    }
    let candidate;
    try { candidate = cloneStateSnapshot(state); }
    catch (cause) { throw migrationError('STATE_INVALID_STATE', 'The state cannot be copied without data loss.', { cause }); }
    for (const step of path) {
      try {
        const migrated = step.migrate(cloneStateSnapshot(candidate));
        if (stateVersion(migrated, currentVersion) !== step.toVersion) {
          throw migrationError('STATE_MIGRATION_INVALID', 'A migration returned an unexpected state version.');
        }
        // Isolate the result from references retained by the callback.
        candidate = cloneStateSnapshot(migrated);
      } catch (cause) {
        throw migrationError('STATE_MIGRATION_FAILED', 'The state migration did not complete.', {
          fromVersion: step.fromVersion, toVersion: step.toVersion, cause,
        });
      }
    }
    // Validate before the caller can replace any stored snapshot. An unchanged
    // v1 state is also checked, without adding defaults or rewriting originals.
    let validated;
    try {
      validated = validate(cloneStateSnapshot(candidate));
      if (stateVersion(validated, currentVersion) !== currentVersion) {
        throw migrationError('STATE_MIGRATION_INVALID', 'The validator returned a different state version.');
      }
    } catch (cause) {
      if (path.length === 0) throw cause;
      throw migrationError('STATE_MIGRATION_FAILED', 'The migrated state failed its technical validation.', { cause });
    }
    return {
      state: cloneStateSnapshot(validated),
      fromVersion,
      toVersion: currentVersion,
      migrated: path.length > 0,
      steps: path.map(({ fromVersion: from, toVersion: to }) => ({ fromVersion: from, toVersion: to })),
    };
  }

  return Object.freeze({ currentVersion, prepare });
}

export const stateMigrationPipeline = createStateMigrationPipeline();

/**
 * Return a readable state only after a real migration has committed. A v1
 * read is zero-write and leaves any recovery copy untouched. Future migrations
 * use the repository's atomic checkpoint: any failed save retains both old
 * current and old recovery, and the migrated candidate is never returned.
 */
export async function loadCompatibleState(repository, { pipeline = stateMigrationPipeline } = {}) {
  const stored = await repository.load();
  if (stored === null) return null;
  const prepared = pipeline.prepare(stored);
  if (prepared.migrated) await repository.save(prepared.state, { checkpoint: true });
  return prepared.state;
}
