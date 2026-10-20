/** Pure quantity arithmetic. No dietary targets, limits or meal checks. */

function quantityError(code, message) {
  return Object.assign(new RangeError(message), { code });
}

function finiteQuantity(quantity) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw quantityError('SHOPPING_NONFINITE_QUANTITY', 'The calculated quantity must be a finite number.');
  }
  return quantity;
}

/**
 * @param {'one' | 'two' | 'advanced'} mode
 * @param {number} [cookingServings]
 * @returns {number}
 */
export function getShoppingMultiplier(mode, cookingServings = 1) {
  if (mode === 'one') return 1;
  if (mode === 'two') return 2;
  if (mode === 'advanced') return cookingServings;
  throw new RangeError('Unknown shopping mode.');
}

/** Scale quantities into a fresh array, keeping units and open metadata. */
export function scaleIngredients(ingredients = [], multiplier = 1) {
  return ingredients.map(ingredient => ({
    ...structuredClone(ingredient),
    quantity: finiteQuantity(ingredient.quantity * multiplier),
  }));
}

/** Technical shape only; this does not apply a conversion or assess its factor. */
export function validateUnitConversion(unitConversion) {
  if (unitConversion === undefined) return;
  if (!unitConversion || typeof unitConversion !== 'object' || Array.isArray(unitConversion)
    || typeof unitConversion.toUnit !== 'string' || unitConversion.toUnit.length === 0
    || typeof unitConversion.factor !== 'number' || !Number.isFinite(unitConversion.factor)
    || unitConversion.factor <= 0) {
    throw quantityError('SHOPPING_INVALID_CONVERSION', 'A unit conversion needs a destination unit and a positive finite factor.');
  }
}

/**
 * Apply a supplied conversion once, then canonicalize compatible metric units.
 * The factor expresses one original unit in toUnit; it belongs only to this
 * ingredient occurrence. Without it, counts and unknown units stay distinct.
 * No weight/volume relationship or change of measurement basis is inferred.
 * @param {number} quantity
 * @param {string} unit
 * @param {{toUnit: string, factor: number}} [unitConversion]
 * @returns {{quantity: number, unit: string}}
 */
export function normalizeQuantity(quantity, unit, unitConversion) {
  validateUnitConversion(unitConversion);
  if (unitConversion !== undefined) {
    quantity *= unitConversion.factor;
    unit = unitConversion.toUnit;
  }
  const normalized = typeof unit === 'string' ? unit.trim().toLowerCase() : unit;
  if (normalized === 'kg') return { quantity: finiteQuantity(quantity * 1000), unit: 'g' };
  if (normalized === 'l') return { quantity: finiteQuantity(quantity * 1000), unit: 'ml' };
  if (normalized === 'g' || normalized === 'ml') return { quantity: finiteQuantity(quantity), unit: normalized };
  return { quantity: finiteQuantity(quantity), unit };
}

/**
 * Input meals carry per-person ingredients and optional cookingServings.
 * Group keys retain the exact basis; an omitted basis is its own group.
 * Names/categories/extension metadata come from the first matching item,
 * except an applied unitConversion: it is consumed on the derived row only.
 * Leftover allocations are summed as supplied; batch metadata is not expanded.
 * Compensated sums reduce floating-point loss without rounding quantities.
 * @param {Array<{ingredients?: Array<Record<string, any>>, cookingServings?: number}>} mealsWithCookingServings
 * @param {'one' | 'two' | 'advanced'} [mode]
 */
export function aggregateIngredients(mealsWithCookingServings, mode = 'one') {
  const groups = new Map();
  for (const meal of mealsWithCookingServings) {
    const multiplier = getShoppingMultiplier(mode, meal.cookingServings ?? 1);
    for (const ingredient of scaleIngredients(meal.ingredients, multiplier)) {
      const normalized = normalizeQuantity(ingredient.quantity, ingredient.unit, ingredient.unitConversion);
      if (ingredient.unitConversion !== undefined) delete ingredient.unitConversion;
      const key = JSON.stringify([ingredient.ingredientId, normalized.unit, ingredient.basis ?? null]);
      const existing = groups.get(key);
      if (existing) {
        const total = existing.sum + normalized.quantity;
        existing.correction += Math.abs(existing.sum) >= Math.abs(normalized.quantity)
          ? (existing.sum - total) + normalized.quantity
          : (normalized.quantity - total) + existing.sum;
        existing.sum = total;
      } else {
        groups.set(key, { row: { ...ingredient, ...normalized, key }, sum: normalized.quantity, correction: 0 });
      }
    }
  }
  return [...groups.values()].map(({ row, sum, correction }) => ({
    ...row, quantity: finiteQuantity(sum + correction),
  }));
}

/**
 * Add explicitly supplied per-person values. cookingServings is ignored.
 * A missing number in any included meal makes that metric unknown (null),
 * rather than implying a zero. These are arithmetic totals, not assessments.
 * @param {Array<{nutrition?: Record<string, any>}>} [meals]
 * @returns {{kcal: number | null, proteinG: number | null, carbohydratesG: number | null, fatG: number | null, fiberG: number | null}}
 */
export function totalNutritionPerPerson(meals = []) {
  const keys = ['kcal', 'proteinG', 'carbohydratesG', 'fatG', 'fiberG'];
  return Object.fromEntries(keys.map(key => {
    const values = meals.map(meal => meal.nutrition?.[key]);
    const complete = values.length > 0 && values.every(value => typeof value === 'number' && Number.isFinite(value));
    return [key, complete ? values.reduce((total, value) => total + value, 0) : null];
  }));
}
