/** Stable assignment identities for calendar edits and version-1 compatibility. */
import { daysBetween } from './dates.js';
import { cloneStateSnapshot } from './state.js';

/**
 * New occurrences carry their importId as assignmentId. For older snapshots,
 * resolve the most recent applicable historical mapping before a date move.
 * Without a matching record, the legacy source/date offset forms an opaque,
 * deterministic group. Persisting this value before movement keeps it stable.
 */
export function assignmentIdFor(state, entry, assignedDate) {
  if (typeof entry.assignmentId === 'string' && entry.assignmentId.length > 0) return entry.assignmentId;
  for (let index = state.imports.length - 1; index >= 0; index -= 1) {
    const record = state.imports[index];
    if (record.sourceId !== entry.sourceId || record.status === 'undone' || record.undoneAt) continue;
    if (record.dayMappings.some(mapping => mapping.sourceDate === entry.sourceDate && mapping.assignedDate === assignedDate)) {
      return record.importId;
    }
  }
  return `legacy-assignment:${JSON.stringify([entry.sourceId, daysBetween(entry.sourceDate, assignedDate)])}`;
}

/**
 * Older undo records did not list occurrence IDs because date moves were not
 * available. Infer surviving imported occurrences from their original mapping.
 * New records keep explicit IDs even after those occurrences move elsewhere.
 */
export function undoEntryIds(state) {
  const undo = state.lastImportUndo;
  if (!undo) return [];
  if (Array.isArray(undo.entryIds)) return [...undo.entryIds];
  return Object.entries(state.calendar).flatMap(([date, day]) => day.meals
    .filter(entry => assignmentIdFor(state, entry, date) === undo.importId)
    .map(entry => entry.entryId));
}

/** Enrich a fresh snapshot only; do not rewrite documents or old backups. */
export function materializeCalendarProvenance(state) {
  const next = cloneStateSnapshot(state);
  if (next.lastImportUndo && next.lastImportUndo.entryIds === undefined) {
    next.lastImportUndo.entryIds = undoEntryIds(state);
  }
  for (const [date, day] of Object.entries(next.calendar)) {
    for (const entry of day.meals) {
      if (entry.assignmentId === undefined) entry.assignmentId = assignmentIdFor(state, entry, date);
    }
  }
  return next;
}
