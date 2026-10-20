/** One-source .diet exports. Calendar multipliers belong only in backups. */
import { addDays } from './dates.js';
import { getRangeEntries, readablePlan } from './session.js';
import { timestampFor } from './state.js';
import { assignmentIdFor } from './provenance.js';

function exportError(code, message) {
  return Object.assign(new Error(message), { code });
}

function sourceFor(state, sourceId) {
  const source = Object.hasOwn(state.sourcePlans, sourceId) ? state.sourcePlans[sourceId] : null;
  if (!source) throw exportError('EXPORT_SOURCE_NOT_FOUND', 'Choose an available source plan.');
  return source;
}

function uniqueExportId() {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `plan-export-${suffix}`;
}

/** Download an exact JSON-value copy of the imported source, not a backup. */
export function exportSourceDiet(state, sourceId) {
  return structuredClone(sourceFor(state, sourceId).document);
}

/**
 * Materialize actual dates and effective times for one source and an optional
 * inclusive date range. Source/meal extensions, ingredient IDs, quantities,
 * units, measurement bases and content language survive without scaling.
 */
export function exportCalendarDiet(state, { sourceId, startDate, endDate, now } = {}) {
  const source = sourceFor(state, sourceId);
  const sourceDates = Object.keys(state.calendar).filter(date => state.calendar[date].meals
    .some(entry => entry.sourceId === sourceId)).sort();
  if (sourceDates.length === 0) throw exportError('EXPORT_EMPTY_SELECTION', 'This source has no meals assigned to the calendar.');
  const firstDate = startDate ?? sourceDates[0];
  const lastDate = endDate ?? sourceDates.at(-1);
  try { addDays(firstDate, 0); addDays(lastDate, 0); }
  catch { throw exportError('SESSION_INVALID_DATE', 'Choose valid export dates.'); }
  if (firstDate > lastDate) throw exportError('SESSION_INVALID_RANGE', 'The export range is reversed.');
  const rows = getRangeEntries(state, firstDate, lastDate).filter(row => row.entry.sourceId === sourceId);
  if (rows.length === 0) throw exportError('EXPORT_EMPTY_SELECTION', 'The selected dates contain no meals from this source.');
  const planId = uniqueExportId();
  const byDate = new Map();
  const batches = new Map();
  let mealIndex = 0;
  for (const row of rows) {
    if (!byDate.has(row.date)) {
      const sourceDay = source.document.days.find(day => day.date === row.entry.sourceDate);
      byDate.set(row.date, { ...structuredClone(sourceDay), date: row.date, meals: [] });
    }
    const meal = { ...structuredClone(row.meal), mealId: `${planId}-meal-${++mealIndex}`, time: row.time };
    if (meal.preparation?.batchId) {
      // Stable assignment identity survives moves. Independent imports remain
      // distinct even when individual meals now happen on the same dates.
      const batchKey = JSON.stringify([assignmentIdFor(state, row.entry, row.date), meal.preparation.batchId]);
      if (!batches.has(batchKey)) batches.set(batchKey, `${planId}-batch-${batches.size + 1}`);
      meal.preparation.batchId = batches.get(batchKey);
    }
    byDate.get(row.date).meals.push(meal);
  }
  return readablePlan({
    ...structuredClone(source.document),
    format: 'meal-planner.diet', schemaVersion: 1,
    planId, createdAt: timestampFor(now), suggestedStartDate: rows[0].date, baseServings: 1,
    days: [...byDate.values()],
  });
}
