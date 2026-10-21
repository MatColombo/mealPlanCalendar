/**
 * Presentation arithmetic for supplied per-person values. No ingredient
 * database, recipe judgement, target comparison or food inference belongs here.
 */
export const NUTRITION_METRICS = Object.freeze([
  'kcal', 'proteinG', 'carbohydratesG', 'fatG', 'fiberG', 'sugarsG',
]);

const finite = value => typeof value === 'number' && Number.isFinite(value);

function sumAvailable(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Number.isFinite(sum) ? sum : null;
}

function resultFromMetrics(metrics) {
  return {
    values: Object.fromEntries(NUTRITION_METRICS.map(key => [key, metrics[key].value])),
    metrics,
  };
}

/**
 * A declared finite meal value wins for each metric. Otherwise add only the
 * values attached to the exact ingredient quantities for one person. They are
 * already row contributions: never multiply them by grams, pieces or people.
 * Partial sums stay separate from values; null/missing is never an implicit 0.
 */
export function resolveMealNutrition(meal) {
  const ingredients = Array.isArray(meal?.ingredients) ? meal.ingredients : [];
  const metrics = Object.fromEntries(NUTRITION_METRICS.map(key => {
    const declared = meal?.nutrition?.[key];
    if (finite(declared)) return [key, {
      value: declared, partialValue: declared, knownCount: 1, totalCount: 1,
      complete: true, source: 'meal',
    }];
    const supplied = ingredients.map(ingredient => ingredient?.nutrition?.[key]).filter(finite);
    const partialValue = sumAvailable(supplied);
    const complete = ingredients.length > 0 && supplied.length === ingredients.length && partialValue !== null;
    return [key, {
      value: complete ? partialValue : null,
      partialValue, knownCount: supplied.length, totalCount: ingredients.length,
      complete, source: supplied.length > 0 ? 'ingredients' : 'missing',
    }];
  }));
  return resultFromMetrics(metrics);
}

/**
 * Sum each resolved personal metric across meals. knownCount counts complete
 * meals; partialValue may include known ingredient contributions from meals
 * whose metric is incomplete. Only a fully known, finite total enters values.
 */
export function summarizeNutrition(meals) {
  const resolved = Array.isArray(meals) ? meals.map(resolveMealNutrition) : [];
  const metrics = Object.fromEntries(NUTRITION_METRICS.map(key => {
    const records = resolved.map(meal => meal.metrics[key]);
    const knownCount = records.filter(record => record.complete).length;
    const partialValue = sumAvailable(records.map(record => record.partialValue).filter(finite));
    const complete = records.length > 0 && knownCount === records.length && partialValue !== null;
    return [key, {
      value: complete ? partialValue : null,
      partialValue, knownCount, totalCount: records.length,
      complete, source: records.some(record => record.source !== 'missing') ? 'meals' : 'missing',
    }];
  }));
  return resultFromMetrics(metrics);
}
