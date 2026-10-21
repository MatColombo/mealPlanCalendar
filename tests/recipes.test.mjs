import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState, addSourcePlan, createCalendarEntry } from '../src/data/state.js';
import { setEntryDate, setEntryTime, setEntryServings } from '../src/data/session.js';
import { buildRecipeIndex, searchRecipes, recipePeriods } from '../src/data/recipes.js';

const TODAY = '2026-10-21';
const NOW = '2026-10-21T12:00:00.000Z';

// Synthetic names/amounts exercise indexing and calendar references only.
// Nothing in these tests judges food choices or their nutritional validity.
function fixture() {
  const base = {
    recipeId: 'record-alpha', title: 'Crème Alfa', type: 'lunch', time: '12:00',
    ingredients: [{ ingredientId: 'item-alpha', name: 'Voce Àcida', quantity: 2, unit: 'unit', category: 'produce' }],
    instructions: ['Passaggio sintetico A'],
  };
  const document = {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'recipe-index-fixture',
    title: 'Archivio sintetico', language: 'it', createdAt: NOW,
    suggestedStartDate: '2026-01-01', baseServings: 1,
    days: [
      { date: '2026-01-01', meals: [{ ...structuredClone(base), mealId: 'alpha-past', preparation: { batchId: 'batch-a', role: 'prepare' } }] },
      { date: '2026-01-02', meals: [
        { ...structuredClone(base), mealId: 'alpha-today', type: 'dinner', time: '18:00', preparation: { batchId: 'batch-a', role: 'leftover' } },
        { ...structuredClone(base), mealId: 'alpha-variant', ingredients: [{ ingredientId: 'item-beta', name: 'Voce Beta', quantity: 4, unit: 'g', category: 'grains' }] },
      ] },
      { date: '2026-01-03', meals: [
        { ...structuredClone(base), mealId: 'alpha-future', time: '09:00' },
        { recipeId: 'record-archive', mealId: 'archive-only', title: 'Voce in archivio', type: 'snack', time: '16:00',
          ingredients: [{ ingredientId: 'item-gamma', name: 'Voce Gamma', quantity: 3, unit: 'ml', category: 'pantry' }] },
      ] },
    ],
  };
  const { state } = addSourcePlan(createAppState({ now: NOW }), document, { sourceId: 'source-fixture', now: NOW });
  for (const [date, sourceDate, mealId, entryId] of [
    ['2026-10-20', '2026-01-01', 'alpha-past', 'past'],
    [TODAY, '2026-01-02', 'alpha-today', 'today'],
    ['2026-10-22', '2026-01-03', 'alpha-future', 'future'],
    ['2026-10-20', '2026-01-02', 'alpha-variant', 'variant'],
  ]) {
    const day = state.calendar[date] ?? { date, meals: [] };
    day.meals.push(createCalendarEntry({ sourceId: 'source-fixture', sourceDate, mealId, entryId }));
    state.calendar[date] = day;
  }
  return state;
}

function baseRecipe(index) {
  return index.find(recipe => recipe.meal.ingredients[0].ingredientId === 'item-alpha');
}

test('catalogue groups repeated servings but keeps a changed-ingredient recipeId as a separate variant', () => {
  const state = fixture();
  const before = structuredClone(state);
  const index = buildRecipeIndex(state);
  assert.equal(index.length, 3);
  const recipe = baseRecipe(index);
  assert.deepEqual(recipe.types, ['lunch', 'dinner']);
  assert.equal(recipe.sources.length, 1);
  assert.equal(recipe.occurrences.length, 3);
  assert.deepEqual(recipe.occurrences.map(row => row.date), ['2026-10-20', TODAY, '2026-10-22']);
  assert.equal(recipe.occurrences.find(row => row.entryId === 'today').time, '18:00');
  const variant = index.find(row => row.meal.ingredients[0].ingredientId === 'item-beta');
  assert.equal(variant.meal.recipeId, recipe.meal.recipeId);
  assert.notEqual(variant.key, recipe.key);
  assert.equal(variant.occurrences.length, 1);
  assert.equal(index.find(row => row.meal.mealId === 'archive-only').occurrences.length, 0);
  assert.deepEqual(state, before);
});

test('search combines normalized text, ingredient IDs, scope, type, category and calendar presence', () => {
  const index = buildRecipeIndex(fixture());
  const find = filters => searchRecipes(index, filters, TODAY);
  assert.equal(find({ query: ' CREME ', searchIn: 'recipes' }).length, 2);
  assert.equal(find({ query: 'creme', searchIn: 'ingredients' }).length, 0);
  assert.equal(find({ query: 'ACIDA', searchIn: 'ingredients' }).length, 1);
  assert.equal(find({ query: 'item-alpha', searchIn: 'ingredients' })[0].key, baseRecipe(index).key);
  assert.equal(find({ query: 'creme acida' }).length, 1);
  assert.deepEqual(find({ query: 'acida' })[0].matchedIngredients.map(row => row.ingredientId), ['item-alpha']);
  assert.equal(find({ query: 'acida', category: 'grains' }).length, 0);
  assert.equal(find({ type: 'dinner', category: 'produce', period: 'future' }).length, 1);
  assert.equal(find({ type: 'snack', period: 'future' }).length, 0);
  assert.equal(find({ category: 'grains', period: 'past' }).length, 1);
  assert.equal(find({ period: 'all' }).length, 3);
  assert.deepEqual(find({ period: 'unscheduled' }).map(row => row.meal.mealId), ['archive-only']);
});

test('today belongs to upcoming and period counts use actual civil dates with stable ordering', () => {
  const recipe = baseRecipe(buildRecipeIndex(fixture()));
  const before = structuredClone(recipe.occurrences);
  const periods = recipePeriods(recipe, TODAY);
  assert.deepEqual(periods.future.map(row => row.entryId), ['today', 'future']);
  assert.deepEqual(periods.past.map(row => row.entryId), ['past']);
  assert.deepEqual(periods.total.map(row => row.entryId), ['past', 'today', 'future']);
  assert.deepEqual(recipePeriods(recipe, '2026-10-23').past.map(row => row.entryId), ['future', 'today', 'past']);
  assert.deepEqual(recipe.occurrences, before);
});

test('moving an occurrence updates date, time and people without adding a recipe or changing its key', () => {
  const state = fixture();
  const before = structuredClone(state.sourcePlans);
  const oldIndex = buildRecipeIndex(state);
  let moved = setEntryDate(state, 'past', '2027-01-02', { now: NOW });
  moved = setEntryTime(moved, 'past', '07:15', { now: NOW });
  moved = setEntryServings(moved, 'past', 3, { now: NOW });
  const index = buildRecipeIndex(moved);
  const recipe = baseRecipe(index);
  assert.equal(index.length, oldIndex.length);
  assert.equal(recipe.key, baseRecipe(oldIndex).key);
  assert.equal(recipe.occurrences.length, 3);
  assert.deepEqual(recipe.occurrences.find(row => row.entryId === 'past'), {
    date: '2027-01-02', time: '07:15', entryId: 'past', type: 'lunch', cookingServings: 3, sourceId: 'source-fixture',
  });
  assert.equal(recipePeriods(recipe, TODAY).past.length, 0);
  assert.equal(recipePeriods(recipe, TODAY).future.length, 3);
  assert.deepEqual(moved.sourcePlans, before);
  assert.equal(baseRecipe(oldIndex).occurrences[0].date, '2026-10-20');
});

test('UI-language changes preserve recipe text, search results and catalogue keys', () => {
  const state = fixture();
  const before = buildRecipeIndex(state);
  state.settings.uiLanguage = 'en';
  const after = buildRecipeIndex(state);
  assert.deepEqual(after, before);
  assert.deepEqual(searchRecipes(after, { query: 'Àcida' }, TODAY), searchRecipes(before, { query: 'acida' }, TODAY));
  assert.equal(baseRecipe(after).language, 'it');
  assert.equal(baseRecipe(after).meal.title, 'Crème Alfa');
});
