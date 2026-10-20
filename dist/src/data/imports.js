/** Atomic, pure import candidates. Persistence is committed by the caller. */
import { addSourcePlan, cloneStateSnapshot, createCalendarEntry, timestampFor } from './state.js';
import { buildImportPreview, readablePlan } from './session.js';
import { validateAppState } from './validation.js';
import { undoEntryIds } from './provenance.js';
import { reconcileShoppingChecks } from '../shopping/list.js';

function importError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

/** Object key order/whitespace do not identify a file; every JSON value does. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function equal(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function newImportId(state) {
  let id;
  do {
    const suffix = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    id = `import-${suffix}`;
  } while (state.imports.some(record => record.importId === id));
  return id;
}

function assignmentMatches(state, plan, sourceId, mappings) {
  return mappings.every(({ sourceDate, assignedDate }) => {
    const sourceDay = plan.days.find(day => day.date === sourceDate);
    const assigned = state.calendar[assignedDate];
    if (!assigned || assigned.meals.length !== sourceDay.meals.length) return false;
    const expected = new Set(sourceDay.meals.map(meal => meal.mealId));
    return assigned.meals.every(entry => entry.sourceId === sourceId && entry.sourceDate === sourceDate
      && expected.delete(entry.mealId)) && expected.size === 0;
  });
}

function assignedDates(state, sourceIds) {
  const selected = new Set(sourceIds);
  return Object.keys(state.calendar).filter(date => state.calendar[date].meals
    .some(entry => selected.has(entry.sourceId))).sort();
}

/**
 * Preview exact duplicates, changed revisions and occupied dates. Current
 * people/time overrides do not turn a repeated identical assignment into a
 * new import. Empty calendar days are replaceable without an overlap alert.
 */
export function previewImport(state, document, startDate) {
  const plan = readablePlan(document);
  const preview = buildImportPreview(state, plan, startDate);
  const canonical = canonicalJson(plan);
  const identicalSourceIds = [];
  const samePlanSourceIds = [];
  for (const [sourceId, source] of Object.entries(state.sourcePlans)) {
    if (source.document.planId === plan.planId) samePlanSourceIds.push(sourceId);
    if (canonicalJson(source.document) === canonical) identicalSourceIds.push(sourceId);
  }
  const exactSource = identicalSourceIds.find(sourceId => assignmentMatches(state, plan, sourceId, preview.dayMappings));
  const identicalSourceId = exactSource ?? identicalSourceIds[0] ?? null;
  return {
    ...preview,
    overlaps: preview.dayMappings.filter(mapping => state.calendar[mapping.assignedDate]?.meals.length > 0)
      .map(mapping => mapping.assignedDate),
    identicalSourceId,
    identicalSourceIds,
    samePlanSourceIds,
    existingAssignmentDates: assignedDates(state, identicalSourceIds),
    samePlanAssignmentDates: assignedDates(state, samePlanSourceIds),
    duplicate: identicalSourceId !== null,
    revision: identicalSourceId === null && samePlanSourceIds.length > 0,
    noOp: exactSource !== undefined,
  };
}

/** Keep the import/undo entry point aligned with the shared checklist policy. */
export function reconcileShopping(state, { now } = {}) {
  return reconcileShoppingChecks(state, { now });
}

function shoppingUndo(before, after) {
  const changed = {};
  const keys = new Set([...Object.keys(before.checked), ...Object.keys(after.checked)]);
  for (const key of keys) {
    const prior = Object.hasOwn(before.checked, key) ? before.checked[key] : null;
    const current = Object.hasOwn(after.checked, key) ? after.checked[key] : null;
    if (!equal(prior, current)) {
      Object.defineProperty(changed, key, {
        value: { before: structuredClone(prior), after: structuredClone(current) },
        enumerable: true, writable: true, configurable: true,
      });
    }
  }
  return {
    range: { before: structuredClone(before.range), after: structuredClone(after.range) },
    checked: changed,
  };
}

/**
 * Construct the entire next state, never modifying the supplied snapshot.
 * dateConfirmed must be explicit even when suggestedStartDate is retained.
 * A no-op keeps all occurrence edits and does not create history or an undo.
 */
export function prepareImport(state, document, {
  startDate, fileName, dateConfirmed = false, duplicateConfirmed = false, overwrite = false, now,
} = {}) {
  const preview = previewImport(state, document, startDate);
  if (dateConfirmed !== true) {
    throw importError('IMPORT_DATE_CONFIRMATION_REQUIRED', 'Confirm the initial date before importing.');
  }
  if (preview.noOp) return { state, sourceId: preview.identicalSourceId, preview, noOp: true };
  if (preview.duplicate && duplicateConfirmed !== true) {
    throw importError('IMPORT_DUPLICATE_CONFIRMATION_REQUIRED', 'Confirm assigning an already imported document again.', { preview });
  }
  if (preview.overlaps.length > 0 && overwrite !== true) {
    throw importError('SESSION_IMPORT_OVERLAP', 'Confirm the complete replacement of overlapping days.', { overlaps: preview.overlaps });
  }
  const timestamp = timestampFor(now);
  const imported = preview.identicalSourceId === null
    ? addSourcePlan(state, readablePlan(document), { fileName, now: timestamp })
    : { state: cloneStateSnapshot(state), sourceId: preview.identicalSourceId };
  let next = imported.state;
  const { sourceId } = imported;
  const source = next.sourcePlans[sourceId];
  const beforeDays = {};
  const importId = newImportId(next);
  const importedEntryIds = [];
  const entryIds = new Set(Object.values(next.calendar).flatMap(day => day.meals.map(entry => entry.entryId)));
  for (const mapping of preview.dayMappings) {
    beforeDays[mapping.assignedDate] = Object.hasOwn(state.calendar, mapping.assignedDate)
      ? structuredClone(state.calendar[mapping.assignedDate]) : null;
    const sourceDay = source.document.days.find(day => day.date === mapping.sourceDate);
    next.calendar[mapping.assignedDate] = {
      date: mapping.assignedDate,
      meals: sourceDay.meals.map(meal => {
        let entry;
        do { entry = createCalendarEntry({ sourceId, sourceDate: mapping.sourceDate, mealId: meal.mealId, assignmentId: importId }); }
        while (entryIds.has(entry.entryId));
        entryIds.add(entry.entryId);
        importedEntryIds.push(entry.entryId);
        return entry;
      }),
    };
  }
  next.imports.push({
    importId, sourceId, importedAt: timestamp, startDate,
    endDate: preview.endDate,
    ...(fileName === undefined ? {} : { fileName }),
    dayMappings: preview.dayMappings.map(({ sourceDate, assignedDate }) => ({ sourceDate, assignedDate })),
    status: 'applied',
    duplicate: preview.duplicate,
    revision: preview.revision,
    overwrittenDates: [...preview.overlaps],
  });
  if (next.shopping.range.startDate === null || next.shopping.range.endDate === null) {
    next.shopping.range = { ...next.shopping.range, startDate: preview.startDate, endDate: preview.endDate };
  }
  next = reconcileShopping(next, { now: timestamp });
  next.lastImportUndo = { importId, entryIds: importedEntryIds, beforeDays, shopping: shoppingUndo(state.shopping, next.shopping) };
  next.meta.updatedAt = timestamp;
  // Detect a corrupt candidate before the caller opens its write transaction.
  return { state: validateAppState(next), sourceId, preview, noOp: false };
}

/** Distinguish whole-day restoration from imported meals moved outside it. */
export function previewUndoImport(state) {
  const undo = state.lastImportUndo;
  if (!undo) return null;
  const dates = Object.keys(undo.beforeDays).sort();
  const mapped = new Set(dates);
  const entryIds = undoEntryIds(state);
  const selected = new Set(entryIds);
  const additionalDates = Object.keys(state.calendar).filter(date => !mapped.has(date)
    && state.calendar[date].meals.some(entry => selected.has(entry.entryId))).sort();
  return { importId: undo.importId, dates, additionalDates, entryIds };
}

/**
 * Restore imported dates and remove imported occurrences moved outside them,
 * retaining unrelated destination meals, edits and archived sources.
 * Checkbox/range changes are reversed only if still equal to the import's
 * after-snapshot. Later explicit edits to those controls therefore survive.
 */
export function undoLastImport(state, { now } = {}) {
  if (!state.lastImportUndo) throw importError('IMPORT_NOTHING_TO_UNDO', 'There is no import available to undo.');
  let next = validateAppState(state);
  const undo = next.lastImportUndo;
  const importedIds = new Set(undoEntryIds(next));
  // A moved imported meal must not survive undo. Keep unrelated meals and
  // metadata on external destinations, including newly empty destination days.
  for (const day of Object.values(next.calendar)) {
    day.meals = day.meals.filter(entry => !importedIds.has(entry.entryId));
  }
  for (const [date, before] of Object.entries(undo.beforeDays)) {
    if (before === null) delete next.calendar[date];
    else next.calendar[date] = structuredClone(before);
  }
  if (equal(next.shopping.range, undo.shopping.range.after)) {
    next.shopping.range = structuredClone(undo.shopping.range.before);
  }
  for (const [key, change] of Object.entries(undo.shopping.checked)) {
    const current = Object.hasOwn(next.shopping.checked, key) ? next.shopping.checked[key] : null;
    if (equal(current, change.after)) {
      if (change.before === null) delete next.shopping.checked[key];
      else Object.defineProperty(next.shopping.checked, key, {
        value: structuredClone(change.before), enumerable: true, writable: true, configurable: true,
      });
    }
  }
  const timestamp = timestampFor(now);
  next = reconcileShopping(next, { now: timestamp });
  const record = next.imports.find(item => item.importId === undo.importId);
  record.status = 'undone';
  record.undoneAt = timestamp;
  next.lastImportUndo = null;
  next.meta.updatedAt = timestamp;
  try { return validateAppState(next); }
  catch (cause) {
    throw importError('IMPORT_UNDO_CONFLICT', 'The saved occurrence identities conflict with later calendar changes.', { cause });
  }
}
