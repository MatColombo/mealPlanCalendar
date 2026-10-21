/** Technical state/reference checks only. No dietary or recipe rules. */
import { addDays, daysBetween } from './dates.js';
import { cloneStateSnapshot } from './state.js';
import { readablePlan } from './session.js';
import { assignmentIdFor } from './provenance.js';
import { assertReadableWorkday } from './workday.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string';
const isId = value => isText(value) && value.length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function invalid(message) {
  return Object.assign(new Error(message), { code: 'STATE_INVALID_STATE' });
}

function requireValue(condition, message) {
  if (!condition) throw invalid(message);
}

/** JSON-compatible snapshots preserve unknown fields without lossy coercion. */
function assertJson(value, path = 'state', ancestors = new Set()) {
  if (value === null || isText(value) || typeof value === 'boolean' || finite(value)) return;
  requireValue(typeof value === 'object' && value !== null, `${path} must be JSON-compatible.`);
  requireValue(!ancestors.has(value), `${path} cannot contain circular references.`);
  requireValue(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)),
    `${path} must contain plain JSON objects.`);
  ancestors.add(value);
  for (const [key, child] of Object.entries(value)) assertJson(child, `${path}.${key}`, ancestors);
  ancestors.delete(value);
}

function date(value, nullable = false) {
  if (nullable && value === null) return;
  try { addDays(value, 0); }
  catch { throw invalid('Expected a valid civil date.'); }
}

function instant(value) {
  requireValue(isText(value) && INSTANT.test(value) && Number.isFinite(Date.parse(value)),
    'Expected an ISO timestamp with an explicit timezone.');
}

function range(value) {
  requireValue(isRecord(value), 'A shopping range must be an object.');
  date(value.startDate, true);
  date(value.endDate, true);
  if (value.startDate !== null && value.endDate !== null) {
    requireValue(value.startDate <= value.endDate, 'The shopping range is reversed.');
  }
}

function checkedItem(value) {
  requireValue(isRecord(value) && typeof value.checked === 'boolean'
    && finite(value.quantity) && isText(value.unit), 'Unreadable shopping checkbox.');
  if (value.reopened !== undefined) requireValue(typeof value.reopened === 'boolean', 'Unreadable reopened shopping marker.');
  instant(value.updatedAt);
}

/** Check identifiers, time/multiplier types and every referenced source meal. */
function calendarDay(day, assignedDate, sources, entryIds) {
  date(assignedDate);
  requireValue(isRecord(day) && day.date === assignedDate && Array.isArray(day.meals),
    'Calendar keys and stored dates must agree.');
  try { assertReadableWorkday(day.workday); }
  catch (cause) { throw Object.assign(invalid('Unreadable calendar workday metadata.'), { cause }); }
  for (const entry of day.meals) {
    requireValue(isRecord(entry) && [entry.entryId, entry.sourceId, entry.mealId].every(isId),
      'A calendar occurrence is missing an identifier.');
    date(entry.sourceDate);
    requireValue(!entryIds.has(entry.entryId), 'Calendar occurrence IDs must be unique.');
    entryIds.add(entry.entryId);
    const source = Object.hasOwn(sources, entry.sourceId) ? sources[entry.sourceId] : null;
    const sourceDay = source?.document.days.find(item => item.date === entry.sourceDate);
    requireValue(Boolean(sourceDay?.meals.some(meal => meal.mealId === entry.mealId)),
      'A calendar occurrence points to a missing source meal.');
    requireValue(finite(entry.cookingServings) && entry.cookingServings > 0,
      'An occurrence multiplier must be a positive finite number.');
    requireValue(entry.timeOverride === null
      || (isText(entry.timeOverride) && CLOCK_TIME.test(entry.timeOverride)),
    'An occurrence time override must be null or HH:mm.');
    if (entry.assignmentId !== undefined) {
      requireValue(isId(entry.assignmentId), 'An assignment identity must be nonempty text.');
    }
  }
}

function importRecord(record, sources, importIds) {
  requireValue(isRecord(record) && [record.importId, record.sourceId].every(isId),
    'An import record is missing its identity.');
  requireValue(!importIds.has(record.importId), 'Import operation IDs must be unique.');
  importIds.add(record.importId);
  requireValue(Object.hasOwn(sources, record.sourceId), 'An import record points to a missing source.');
  instant(record.importedAt);
  date(record.startDate);
  requireValue(Array.isArray(record.dayMappings) && record.dayMappings.length > 0,
    'An import record must contain its initial date mapping.');
  const document = sources[record.sourceId].document;
  requireValue(record.dayMappings.length === document.days.length,
    'The initial import mapping must include every source day.');
  const shift = daysBetween(document.days[0].date, record.startDate);
  record.dayMappings.forEach((mapping, index) => {
    requireValue(isRecord(mapping), 'An import date mapping must be an object.');
    date(mapping.sourceDate);
    date(mapping.assignedDate);
    requireValue(mapping.sourceDate === document.days[index].date
      && daysBetween(mapping.sourceDate, mapping.assignedDate) === shift,
    'An import mapping must preserve the source order and day distances.');
  });
  if (record.endDate !== undefined) {
    requireValue(record.endDate === record.dayMappings.at(-1).assignedDate,
      'An import end date must match its date mapping.');
  }
  if (record.fileName !== undefined) requireValue(isText(record.fileName), 'An import filename must be text.');
  if (record.status !== undefined) requireValue(['applied', 'undone'].includes(record.status), 'Unknown import status.');
  if (record.undoneAt !== undefined) instant(record.undoneAt);
  if (record.status === 'undone') requireValue(record.undoneAt !== undefined, 'An undone import needs its undo timestamp.');
  if (record.overwrittenDates !== undefined) {
    requireValue(Array.isArray(record.overwrittenDates), 'Overwritten dates must be an array.');
    const mapped = new Set(record.dayMappings.map(item => item.assignedDate));
    requireValue(new Set(record.overwrittenDates).size === record.overwrittenDates.length,
      'Overwritten dates must be distinct.');
    record.overwrittenDates.forEach(value => {
      date(value);
      requireValue(mapped.has(value), 'An overwritten date must belong to the import.');
    });
  }
}

function undoRecord(undo, state) {
  if (undo === undefined || undo === null) return;
  requireValue(isRecord(undo) && isId(undo.importId) && isRecord(undo.beforeDays), 'Unreadable import undo snapshot.');
  const record = state.imports.at(-1);
  requireValue(record?.importId === undo.importId && record.status !== 'undone',
    'The undo snapshot must refer to the latest applied import.');
  const expectedDates = record.dayMappings.map(mapping => mapping.assignedDate).sort();
  const actualDates = Object.keys(undo.beforeDays).sort();
  requireValue(expectedDates.length === actualDates.length
    && expectedDates.every((value, index) => value === actualDates[index]),
  'The undo snapshot must cover exactly the dates affected by its import.');
  const entryIds = new Set();
  for (const [assignedDate, day] of Object.entries(undo.beforeDays)) {
    date(assignedDate);
    if (day !== null) calendarDay(day, assignedDate, state.sourcePlans, entryIds);
  }
  if (undo.entryIds !== undefined) {
    requireValue(Array.isArray(undo.entryIds) && undo.entryIds.every(isId),
      'Undo occurrence identities must be an array of nonempty strings.');
    const importedIds = new Set(undo.entryIds);
    requireValue(importedIds.size === undo.entryIds.length, 'Undo occurrence identities must be unique.');
    requireValue(undo.entryIds.every(id => !entryIds.has(id)),
      'Imported occurrence identities must be distinct from the preceding days.');
    for (const [assignedDate, day] of Object.entries(state.calendar)) {
      for (const entry of day.meals) {
        const belongsToImport = assignmentIdFor(state, entry, assignedDate) === undo.importId;
        if (importedIds.has(entry.entryId)) {
          requireValue(entry.sourceId === record.sourceId && belongsToImport,
            'An undo occurrence must belong to the import being undone.');
        }
        if (belongsToImport) requireValue(importedIds.has(entry.entryId), 'The undo list must include all surviving imported occurrences.');
      }
    }
  }
  requireValue(isRecord(undo.shopping) && isRecord(undo.shopping.range)
    && isRecord(undo.shopping.checked), 'Unreadable shopping undo changes.');
  range(undo.shopping.range.before);
  range(undo.shopping.range.after);
  for (const change of Object.values(undo.shopping.checked)) {
    requireValue(isRecord(change) && Object.hasOwn(change, 'before') && Object.hasOwn(change, 'after'),
      'A checkbox undo change needs before and after snapshots.');
    if (change.before !== null) checkedItem(change.before);
    if (change.after !== null) checkedItem(change.after);
  }
}

/**
 * Return an isolated snapshot only after validating the storage contract.
 * Optional Phase 4/5 fields are not synthesized in older version-1 backups.
 * Source food data and open metadata are retained, not judged or normalized.
 */
export function validateAppState(state) {
  requireValue(isRecord(state) && state.format === 'meal-planner.state', 'Unsupported application state format.');
  if (state.schemaVersion !== 1) {
    throw Object.assign(new Error('Unsupported application state version.'), { code: 'STATE_UNSUPPORTED_VERSION' });
  }
  assertJson(state);
  const containers = ['settings', 'sourcePlans', 'calendar', 'shopping', 'ui', 'meta'];
  requireValue(containers.every(key => isRecord(state[key])) && Array.isArray(state.imports),
    'The application state is missing required containers.');
  const settings = state.settings;
  requireValue(['it', 'en'].includes(settings.uiLanguage) && typeof settings.reducedMotion === 'boolean'
    && [0, 1].includes(settings.weekStartsOn), 'Unreadable application settings.');
  requireValue(isText(state.ui.view), 'The selected view must be text.');
  date(state.ui.selectedDate, true);
  instant(state.meta.createdAt);
  instant(state.meta.updatedAt);
  for (const [sourceId, source] of Object.entries(state.sourcePlans)) {
    requireValue(isId(sourceId) && isRecord(source) && source.sourceId === sourceId,
      'A source identifier must match its map key.');
    instant(source.importedAt);
    if (source.fileName !== undefined) requireValue(isText(source.fileName), 'A source filename must be text.');
    // Only identifiers, display fields and technical quantity representation.
    try { readablePlan(source.document); }
    catch (cause) { throw Object.assign(invalid('A source document is not technically readable.'), { cause }); }
  }
  const entryIds = new Set();
  for (const [assignedDate, day] of Object.entries(state.calendar)) {
    calendarDay(day, assignedDate, state.sourcePlans, entryIds);
  }
  const importIds = new Set();
  state.imports.forEach(record => importRecord(record, state.sourcePlans, importIds));
  requireValue(['one', 'two', 'advanced'].includes(state.shopping.mode), 'Unknown shopping mode.');
  range(state.shopping.range);
  if (state.shopping.excludedMealTypes !== undefined) {
    requireValue(Array.isArray(state.shopping.excludedMealTypes)
      && state.shopping.excludedMealTypes.every(type => ['breakfast', 'snack'].includes(type))
      && new Set(state.shopping.excludedMealTypes).size === state.shopping.excludedMealTypes.length,
    'Unreadable shopping meal exclusions.');
  }
  requireValue(isRecord(state.shopping.checked) && Array.isArray(state.shopping.manualItems),
    'Unreadable shopping state.');
  Object.values(state.shopping.checked).forEach(checkedItem);
  const itemIds = new Set();
  for (const item of state.shopping.manualItems) {
    requireValue(isRecord(item) && isId(item.itemId) && isText(item.name) && typeof item.checked === 'boolean',
      'Unreadable manual shopping item.');
    requireValue(!itemIds.has(item.itemId), 'Manual shopping item IDs must be unique.');
    itemIds.add(item.itemId);
    if (item.quantity !== undefined) requireValue(finite(item.quantity), 'A manual quantity must be a finite number.');
    for (const key of ['unit', 'category']) {
      if (item[key] !== undefined) requireValue(isText(item[key]), 'A manual unit or category must be text.');
    }
  }
  undoRecord(state.lastImportUndo, state);
  return cloneStateSnapshot(state);
}
