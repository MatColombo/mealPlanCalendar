import test from 'node:test';
import assert from 'node:assert/strict';
import { NUTRITION_METRICS, resolveMealNutrition, summarizeNutrition } from '../src/data/nutrition.js';

// Synthetic numbers exercise presentation arithmetic, precedence and missing
// data. They are not checks of food values, recipes, adequacy or dietary limits.
test('each declared metric wins independently and fallback adds exact row contributions without scaling', () => {
  const meal = {
    cookingServings: 4,
    nutrition: { kcal: 123, proteinG: null, carbohydratesG: 0 },
    ingredients: [
      { quantity: 700, unit: 'g', nutrition: { kcal: 8, proteinG: 2, carbohydratesG: 30, fatG: 4, fiberG: 0, sugarsG: 1 } },
      { quantity: 3, unit: 'piece', nutrition: { kcal: 9, proteinG: 5, carbohydratesG: 40, fatG: 6, fiberG: 0, sugarsG: 2 } },
    ],
  };
  const before = structuredClone(meal);
  const result = resolveMealNutrition(meal);
  assert.deepEqual(result.values, { kcal: 123, proteinG: 7, carbohydratesG: 0, fatG: 10, fiberG: 0, sugarsG: 3 });
  assert.equal(result.metrics.kcal.source, 'meal');
  assert.equal(result.metrics.carbohydratesG.source, 'meal');
  assert.deepEqual(result.metrics.proteinG, {
    value: 7, partialValue: 7, knownCount: 2, totalCount: 2, complete: true, source: 'ingredients',
  });
  meal.cookingServings = 9;
  assert.deepEqual(resolveMealNutrition(meal), result);
  assert.deepEqual({ ...meal, cookingServings: before.cookingServings }, before);
});

test('missing, null and non-number contributions stay unknown with separate partial sums', () => {
  const meal = {
    nutrition: { proteinG: null },
    ingredients: [
      { nutrition: { proteinG: 2, carbohydratesG: 0, fatG: 5, fiberG: null, sugarsG: '3' } },
      { nutrition: { proteinG: null, carbohydratesG: 0, fatG: 7 } },
      {},
    ],
  };
  const result = resolveMealNutrition(meal);
  assert.deepEqual(result.values, Object.fromEntries(NUTRITION_METRICS.map(key => [key, null])));
  assert.deepEqual(result.metrics.proteinG, {
    value: null, partialValue: 2, knownCount: 1, totalCount: 3, complete: false, source: 'ingredients',
  });
  assert.equal(result.metrics.carbohydratesG.partialValue, 0);
  assert.equal(result.metrics.carbohydratesG.knownCount, 2);
  assert.equal(result.metrics.fatG.partialValue, 12);
  assert.equal(result.metrics.fiberG.partialValue, null);
  assert.equal(result.metrics.sugarsG.source, 'missing');
  assert.equal(result.metrics.sugarsG.partialValue, null);
});

test('an external range or absent ingredient rows never becomes a point value or an assumed zero', () => {
  const empty = resolveMealNutrition({ ingredients: [], externalMeal: { kind: 'canteen', kcalRange: { min: 200, max: 700, unit: 'kcal' } } });
  for (const key of NUTRITION_METRICS) {
    assert.deepEqual(empty.metrics[key], {
      value: null, partialValue: null, knownCount: 0, totalCount: 0, complete: false, source: 'missing',
    });
  }
  assert.deepEqual(resolveMealNutrition(undefined), empty);
  const declared = resolveMealNutrition({ ingredients: [], nutrition: { proteinG: 0 } });
  assert.equal(declared.values.proteinG, 0);
  assert.equal(declared.metrics.proteinG.complete, true);
  assert.equal(declared.values.kcal, null);
});

test('day totals combine complete meal values and flag partial supplied contributions explicitly', () => {
  const meals = [
    { cookingServings: 2, nutrition: { kcal: 10, proteinG: 2, carbohydratesG: 3, fatG: 0, fiberG: 1, sugarsG: 0 } },
    { cookingServings: 7, ingredients: [
      { nutrition: { kcal: 5, proteinG: 4, carbohydratesG: 5, fatG: 0, sugarsG: 1 } },
      { nutrition: { kcal: 15, carbohydratesG: 7, fatG: 0, fiberG: 2, sugarsG: 2 } },
    ] },
  ];
  const before = structuredClone(meals);
  const result = summarizeNutrition(meals);
  assert.deepEqual(result.values, { kcal: 30, proteinG: null, carbohydratesG: 15, fatG: 0, fiberG: null, sugarsG: 3 });
  assert.deepEqual(result.metrics.proteinG, {
    value: null, partialValue: 6, knownCount: 1, totalCount: 2, complete: false, source: 'meals',
  });
  assert.equal(result.metrics.fiberG.partialValue, 3);
  assert.equal(result.metrics.kcal.knownCount, 2);
  assert.equal(result.metrics.kcal.complete, true);
  assert.deepEqual(meals, before);
  assert.deepEqual(summarizeNutrition([]).values, Object.fromEntries(NUTRITION_METRICS.map(key => [key, null])));
});

test('non-finite arithmetic cannot produce a displayed complete numeric total', () => {
  const overflow = resolveMealNutrition({ ingredients: [
    { nutrition: { proteinG: Number.MAX_VALUE } },
    { nutrition: { proteinG: Number.MAX_VALUE } },
  ] });
  assert.equal(overflow.values.proteinG, null);
  assert.equal(overflow.metrics.proteinG.complete, false);
  assert.equal(overflow.metrics.proteinG.partialValue, null);
  const ignored = resolveMealNutrition({ nutrition: { proteinG: Infinity }, ingredients: [{ nutrition: { proteinG: 3 } }] });
  assert.equal(ignored.values.proteinG, 3);
  const summary = summarizeNutrition([{ nutrition: { proteinG: Number.MAX_VALUE } }, { nutrition: { proteinG: Number.MAX_VALUE } }]);
  assert.equal(summary.values.proteinG, null);
  assert.equal(summary.metrics.proteinG.complete, false);
});
