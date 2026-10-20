/** State primitives shared by imports, calendar edits and persistence. */

/** @param {string | Date | undefined} now @returns {string} */
export function timestampFor(now) {
  if (now === undefined) return new Date().toISOString();
  if (now instanceof Date) return now.toISOString();
  if (typeof now === 'string') return now;
  throw new TypeError('now must be an ISO timestamp string or a Date.');
}

/** Source documents are JSON-shaped immutable snapshots. */
function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

/**
 * Independent state copy, retaining open metadata and frozen source documents.
 * Exported for the backup and repository adapters, not for modifying sources.
 * @template T
 * @param {T} state
 * @returns {T}
 */
export function cloneStateSnapshot(state) {
  const copy = structuredClone(state);
  if (copy?.sourcePlans && typeof copy.sourcePlans === 'object') {
    for (const source of Object.values(copy.sourcePlans)) {
      if (source && typeof source === 'object') deepFreeze(source.document);
    }
  }
  return copy;
}

/** @param {string} prefix @returns {string} */
function newId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

/** @param {{now?: string | Date, uiLanguage?: 'it' | 'en'}} [options] */
export function createAppState({ now, uiLanguage = 'it' } = {}) {
  const timestamp = timestampFor(now);
  return {
    format: 'meal-planner.state',
    schemaVersion: 1,
    settings: { uiLanguage, reducedMotion: false, weekStartsOn: 1 },
    sourcePlans: {},
    calendar: {},
    imports: [],
    shopping: {
      mode: 'one',
      range: { startDate: null, endDate: null },
      checked: {},
      manualItems: [],
    },
    ui: { view: 'today', selectedDate: null },
    meta: { createdAt: timestamp, updatedAt: timestamp },
  };
}

/**
 * Store an immutable source snapshot. This does not schedule or import days.
 * A repeated planId remains a separate source, identified by a new sourceId.
 * @param {ReturnType<typeof createAppState>} state
 * @param {Record<string, any>} document
 * @param {{sourceId?: string, fileName?: string, now?: string | Date}} [options]
 * @returns {{state: ReturnType<typeof createAppState>, sourceId: string}}
 */
export function addSourcePlan(state, document, { sourceId, fileName, now } = {}) {
  let resolvedId = sourceId;
  if (resolvedId === undefined) {
    do { resolvedId = newId('source'); }
    while (Object.prototype.hasOwnProperty.call(state.sourcePlans, resolvedId));
  }
  if (typeof resolvedId !== 'string' || resolvedId.length === 0) {
    throw new TypeError('sourceId must be a nonempty string.');
  }
  if (Object.prototype.hasOwnProperty.call(state.sourcePlans, resolvedId)) {
    throw new Error('A source with this sourceId already exists.');
  }

  const next = cloneStateSnapshot(state);
  const timestamp = timestampFor(now);
  const source = {
    sourceId: resolvedId,
    document: deepFreeze(structuredClone(document)),
    importedAt: timestamp,
    ...(fileName === undefined ? {} : { fileName }),
  };
  // Computed properties preserve opaque IDs, including special object keys.
  next.sourcePlans = { ...next.sourcePlans, [resolvedId]: source };
  next.meta.updatedAt = timestamp;
  return { state: next, sourceId: resolvedId };
}

/**
 * Create a calendar reference; the source meal stays untouched. assignmentId
 * optionally records its original assignment group independently of its date.
 * cookingServings controls shopping quantities only, not personal nutrition.
 * @param {{entryId?: string, sourceId: string, sourceDate: string, mealId: string, cookingServings?: number, timeOverride?: string | null, assignmentId?: string}} options
 */
export function createCalendarEntry({ entryId, sourceId, sourceDate, mealId, cookingServings = 1, timeOverride = null, assignmentId }) {
  return {
    entryId: entryId ?? newId('entry'),
    sourceId,
    sourceDate,
    mealId,
    cookingServings,
    timeOverride,
    ...(assignmentId === undefined ? {} : { assignmentId }),
  };
}
