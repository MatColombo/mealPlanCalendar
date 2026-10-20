/**
 * Phase 1 only reads the file envelope. The documented JSON Schema is not a
 * runtime validator: meal content, duration, nutrition, preferences and open
 * metadata pass through unchanged.
 */

/** @param {string} code @param {string} message @returns {Error & {code: string}} */
function fileError(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * Parse JSON without normalizing, translating or interpreting plan content.
 * Error codes allow the interface to provide its own localized messages.
 * @param {string} text
 * @returns {Record<string, any>}
 */
export function readDietDocument(text) {
  if (typeof text !== 'string') {
    throw fileError('DIET_EXPECTED_TEXT', 'Expected a .diet file as JSON text.');
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw fileError('DIET_INVALID_JSON', 'The .diet file is not readable JSON.');
  }

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw fileError('DIET_INVALID_DOCUMENT', 'The .diet document must be an object.');
  }
  if (document.format !== 'meal-planner.diet') {
    throw fileError('DIET_UNSUPPORTED_FORMAT', 'This file does not use the meal-planner.diet format.');
  }
  if (document.schemaVersion !== 1) {
    throw fileError('DIET_UNSUPPORTED_VERSION', 'This .diet schema version is not supported.');
  }
  if (!Array.isArray(document.days) || document.days.length === 0) {
    throw fileError('DIET_MISSING_DAYS', 'The .diet document must contain a nonempty days array.');
  }
  return document;
}

/** Summarize the envelope without evaluating the supplied meals. */
export function summarizeDiet(document) {
  return {
    planId: document.planId,
    title: document.title,
    language: document.language,
    dayCount: document.days.length,
    mealCount: document.days.reduce((count, day) => count + (Array.isArray(day?.meals) ? day.meals.length : 0), 0),
    suggestedStartDate: document.suggestedStartDate,
  };
}
