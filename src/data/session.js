/**
 * Pure interactions for the calendar screens. These operations only read
 * document structure, resolve references and perform calendar/quantity work.
 * They do not evaluate meals, recipes, nutrition, targets or food frequencies.
 */
import { readDietDocument } from './diet.js';
import { addDays, daysBetween } from './dates.js';
import { addSourcePlan, cloneStateSnapshot, createCalendarEntry, timestampFor } from './state.js';
import { aggregateIngredients, validateUnitConversion } from '../shopping/quantities.js';
import { materializeCalendarProvenance } from './provenance.js';
import { assertReadableWorkday, copyWorkdayProperty } from './workday.js';

const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Stable error codes let the UI choose localized messages. */
function sessionError(code, message) {
  return Object.assign(new Error(message), { code });
}

function assertDate(date) {
  try { addDays(date, 0); }
  catch { throw sessionError('SESSION_INVALID_DATE', 'Expected a valid calendar date.'); }
}

function assertRange(startDate, endDate) {
  assertDate(startDate);
  assertDate(endDate);
  if (startDate > endDate) {
    throw sessionError('SESSION_INVALID_RANGE', 'The range must end on or after its start date.');
  }
}

function assertServings(count) {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
    throw sessionError('SESSION_INVALID_SERVINGS', 'Cooking servings must be a positive finite number.');
  }
}

function assertTime(time) {
  if (typeof time !== 'string' || !CLOCK_TIME.test(time)) {
    throw sessionError('SESSION_INVALID_TIME', 'Expected a local time in HH:mm format.');
  }
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Check only the fields needed to read, identify and display a document safely.
 * No duration, ingredient choice, amount, target or nutrition rule is applied.
 * Open JSON metadata passes through unchanged.
 */
export function readablePlan(document) {
  let serialized;
  try { serialized = JSON.stringify(document); }
  catch { throw sessionError('SESSION_INVALID_PLAN', 'The plan must be serializable JSON.'); }
  const plan = readDietDocument(serialized);
  const requiredText = [plan.planId, plan.title, plan.language, plan.createdAt];
  if (!requiredText.every(isNonemptyString) || plan.baseServings !== 1) {
    throw sessionError('SESSION_INVALID_PLAN', 'The plan is missing required document fields.');
  }
  assertDate(plan.suggestedStartDate);
  const dates = new Set();
  const mealIds = new Set();
  let previousDate = null;
  for (const day of plan.days) {
    if (!day || typeof day !== 'object' || !Array.isArray(day.meals)) {
      throw sessionError('SESSION_INVALID_PLAN', 'Every day must contain a meals array.');
    }
    assertDate(day.date);
    try { assertReadableWorkday(day.workday); }
    catch { throw sessionError('SESSION_INVALID_PLAN', 'A workday must contain readable class and clock fields.'); }
    if (dates.has(day.date)) {
      throw sessionError('SESSION_DUPLICATE_ID', 'Source dates must be distinct.');
    }
    if (previousDate !== null && day.date < previousDate) {
      throw sessionError('SESSION_INVALID_PLAN', 'Source dates must be ordered.');
    }
    dates.add(day.date);
    previousDate = day.date;
    for (const meal of day.meals) {
      if (!meal || typeof meal !== 'object'
        || ![meal.mealId, meal.title, meal.type].every(isNonemptyString)
        || !Array.isArray(meal.ingredients)) {
        throw sessionError('SESSION_INVALID_PLAN', 'A meal is missing fields needed for display.');
      }
      if (mealIds.has(meal.mealId)) {
        throw sessionError('SESSION_DUPLICATE_ID', 'Meal identifiers must be distinct within the plan.');
      }
      mealIds.add(meal.mealId);
      assertTime(meal.time);
      if (meal.instructions !== undefined
        && (!Array.isArray(meal.instructions) || !meal.instructions.every(step => typeof step === 'string'))) {
        throw sessionError('SESSION_INVALID_PLAN', 'Preparation instructions must be an array of text.');
      }
      if (meal.preparation !== undefined
        && (!meal.preparation || typeof meal.preparation !== 'object' || Array.isArray(meal.preparation)
          || !isNonemptyString(meal.preparation.batchId))) {
        throw sessionError('SESSION_INVALID_PLAN', 'A preparation link must contain a readable batch identifier.');
      }
      for (const ingredient of meal.ingredients) {
        if (!ingredient || typeof ingredient !== 'object'
          || ![ingredient.ingredientId, ingredient.name, ingredient.unit].every(isNonemptyString)
          || typeof ingredient.quantity !== 'number' || !Number.isFinite(ingredient.quantity)) {
          throw sessionError('SESSION_INVALID_PLAN', 'An ingredient is missing fields needed for quantity display.');
        }
        if (['basis', 'category'].some(key => ingredient[key] !== undefined && typeof ingredient[key] !== 'string')) {
          throw sessionError('SESSION_INVALID_PLAN', 'Ingredient grouping fields must be text when supplied.');
        }
        validateUnitConversion(ingredient.unitConversion);
      }
    }
  }
  return plan;
}

/**
 * Resolve one calendar day against immutable source snapshots. Empty dates
 * return an empty array. Missing references raise a technical error rather
 * than silently dropping meals from the display or shopping calculation.
 */
export function getDayEntries(state, date) {
  assertDate(date);
  const day = state?.calendar?.[date];
  if (day === undefined) return [];
  if (!day || !Array.isArray(day.meals)) {
    throw sessionError('SESSION_BROKEN_REFERENCE', 'A calendar day has no readable meal references.');
  }
  const ids = new Set();
  const entries = day.meals.map(entry => {
    if (!entry || ![entry.entryId, entry.sourceId, entry.sourceDate, entry.mealId].every(isNonemptyString)
      || !Object.hasOwn(state?.sourcePlans ?? {}, entry.sourceId)) {
      throw sessionError('SESSION_BROKEN_REFERENCE', 'A calendar entry does not resolve to a source.');
    }
    if (ids.has(entry.entryId)) {
      throw sessionError('SESSION_DUPLICATE_ID', 'Calendar entry identifiers must be distinct.');
    }
    ids.add(entry.entryId);
    const source = state.sourcePlans[entry.sourceId];
    const sourceDays = source?.document?.days;
    const sourceDay = Array.isArray(sourceDays) ? sourceDays.find(day => day?.date === entry.sourceDate) : null;
    const meal = Array.isArray(sourceDay?.meals)
      ? sourceDay.meals.find(meal => meal?.mealId === entry.mealId)
      : null;
    if (!meal) {
      throw sessionError('SESSION_BROKEN_REFERENCE', 'A calendar entry does not resolve to a meal.');
    }
    const time = entry.timeOverride ?? meal.time;
    const cookingServings = entry.cookingServings ?? 1;
    assertTime(time);
    assertServings(cookingServings);
    return { entry, meal, source, date, time, cookingServings };
  });
  return entries.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Read the classification assigned to this date, independently of its meals.
 * Legacy archives without this metadata return null; moving a meal never
 * imports its original day's work schedule into the destination date.
 */
export function getDayWorkday(state, date) {
  assertDate(date);
  const workday = state?.calendar?.[date]?.workday;
  try { assertReadableWorkday(workday); }
  catch { throw sessionError('SESSION_INVALID_PLAN', 'The calendar workday metadata is not readable.'); }
  return workday === undefined || workday === null ? null : structuredClone(workday);
}

/** Find the unique calendar occurrence, independent of the selected day. */
export function findEntry(state, entryId) {
  let match = null;
  for (const date of Object.keys(state.calendar)) {
    const found = getDayEntries(state, date).find(item => item.entry.entryId === entryId);
    if (found && match) {
      throw sessionError('SESSION_DUPLICATE_ID', 'Calendar entry identifiers must be distinct.');
    }
    if (found) match = found;
  }
  return match;
}

/** Inclusive range of actual calendar dates, sorted by day and local time. */
export function getRangeEntries(state, startDate, endDate) {
  assertRange(startDate, endDate);
  return Object.keys(state.calendar)
    .filter(date => date >= startDate && date <= endDate)
    .sort()
    .flatMap(date => getDayEntries(state, date));
}

/** Preview an import without changing source documents or calendar state. */
export function buildImportPreview(state, document, startDate) {
  assertDate(startDate);
  const plan = readablePlan(document);
  const shift = daysBetween(plan.days[0].date, startDate);
  const dayMappings = plan.days.map(day => {
    let assignedDate;
    try { assignedDate = addDays(day.date, shift); }
    catch { throw sessionError('SESSION_INVALID_DATE', 'A mapped date is outside the supported calendar range.'); }
    return { sourceDate: day.date, assignedDate, mealCount: day.meals.length, ...copyWorkdayProperty(day) };
  });
  // Any existing day is treated as occupied, including an intentionally empty
  // day with metadata. A full-day replacement must always be explicit.
  const overlaps = dayMappings
    .filter(day => Object.hasOwn(state.calendar, day.assignedDate))
    .map(day => day.assignedDate);
  return {
    dayMappings,
    overlaps,
    startDate,
    endDate: dayMappings.at(-1).assignedDate,
    dayCount: dayMappings.length,
    mealCount: dayMappings.reduce((total, day) => total + day.mealCount, 0),
  };
}

/**
 * Apply the preview as one new state snapshot. The caller commits that result
 * to its memory repository only after success. Overwrites replace whole days;
 * snapshots of previously imported plans remain available in sourcePlans.
 */
export function applySessionImport(state, document, { startDate, fileName, overwrite = false, now } = {}) {
  const preview = buildImportPreview(state, document, startDate);
  if (preview.overlaps.length > 0 && overwrite !== true) {
    const error = sessionError('SESSION_IMPORT_OVERLAP', 'Confirm the overlapping dates before replacing them.');
    error.overlaps = preview.overlaps;
    throw error;
  }
  const imported = addSourcePlan(state, document, { fileName, now });
  const next = imported.state;
  const { sourceId } = imported;
  const source = next.sourcePlans[sourceId];
  const importId = `import-${sourceId}`;
  for (const mapping of preview.dayMappings) {
    const sourceDay = source.document.days.find(day => day.date === mapping.sourceDate);
    next.calendar[mapping.assignedDate] = {
      date: mapping.assignedDate,
      ...copyWorkdayProperty(sourceDay),
      meals: sourceDay.meals.map(meal => createCalendarEntry({
        sourceId,
        sourceDate: mapping.sourceDate,
        mealId: meal.mealId,
        cookingServings: 1,
        assignmentId: importId,
      })),
    };
  }
  next.imports.push({
    importId,
    sourceId,
    importedAt: source.importedAt,
    startDate,
    dayMappings: preview.dayMappings.map(({ sourceDate, assignedDate }) => ({ sourceDate, assignedDate })),
  });
  return { state: next, sourceId, preview };
}

function updateEntry(state, entryId, update) {
  const found = findEntry(state, entryId);
  if (!found) throw sessionError('SESSION_ENTRY_NOT_FOUND', 'The calendar entry is no longer available.');
  const next = cloneStateSnapshot(state);
  const entry = next.calendar[found.date].meals.find(item => item.entryId === entryId);
  Object.assign(entry, update);
  next.meta.updatedAt = timestampFor();
  return next;
}

/** Change only the calendar multiplier; personal nutrition stays untouched. */
export function setEntryServings(state, entryId, count) {
  assertServings(count);
  return updateEntry(state, entryId, { cookingServings: count });
}

/** null restores the original time; a supplied time is a calendar override. */
export function setEntryTime(state, entryId, time) {
  if (time !== null) assertTime(time);
  return updateEntry(state, entryId, { timeOverride: time });
}

/**
 * Move one occurrence without replacing either day's metadata or other meals.
 * Source references, time, people and open occurrence fields remain intact.
 * The selected shopping range is deliberately unchanged; callers reconcile
 * derived checks in the candidate before committing the calendar edit.
 */
export function setEntryDate(state, entryId, assignedDate, { now } = {}) {
  assertDate(assignedDate);
  const found = findEntry(state, entryId);
  if (!found) throw sessionError('SESSION_ENTRY_NOT_FOUND', 'The calendar entry is no longer available.');
  if (found.date === assignedDate) return cloneStateSnapshot(state);
  const next = materializeCalendarProvenance(state);
  const origin = next.calendar[found.date];
  const entry = origin.meals.find(item => item.entryId === entryId);
  origin.meals = origin.meals.filter(item => item.entryId !== entryId);
  const destination = next.calendar[assignedDate] ?? { date: assignedDate, meals: [] };
  next.calendar[assignedDate] = { ...destination, meals: [...destination.meals, entry] };
  next.calendar[assignedDate].meals = getDayEntries(next, assignedDate).map(row => row.entry);
  next.meta.updatedAt = timestampFor(now);
  return next;
}

/** Derived ingredient rows only; main/UI manage checked and manual items. */
export function getShoppingEntries(state) {
  const { range, excludedMealTypes = [] } = state.shopping;
  if (range.startDate === null || range.endDate === null) return [];
  return getRangeEntries(state, range.startDate, range.endDate)
    .filter(({ meal }) => !excludedMealTypes.includes(meal.type));
}

export function getShoppingItems(state) {
  const { mode, range } = state.shopping;
  if (!['one', 'two', 'advanced'].includes(mode)) {
    throw sessionError('SESSION_INVALID_SHOPPING_MODE', 'Unknown shopping mode.');
  }
  if (range.startDate === null || range.endDate === null) return [];
  const rows = getShoppingEntries(state);
  return aggregateIngredients(rows.map(({ meal, cookingServings }) => ({
    ingredients: meal.ingredients,
    cookingServings,
  })), mode);
}
