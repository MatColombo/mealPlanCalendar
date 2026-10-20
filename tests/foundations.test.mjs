import test from 'node:test';
import assert from 'node:assert/strict';
import { todayISO, addDays, daysBetween } from '../src/data/dates.js';
import { readDietDocument, summarizeDiet } from '../src/data/diet.js';
import { createAppState, addSourcePlan, createCalendarEntry } from '../src/data/state.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { createMemoryRepository } from '../src/persistence/repository.js';
import { getShoppingMultiplier, scaleIngredients, normalizeQuantity, aggregateIngredients, totalNutritionPerPerson } from '../src/shopping/quantities.js';

const NOW = '2026-10-19T14:15:58.000Z';
const LATER = '2026-10-19T14:20:00.000Z';

// Synthetic records exercise software contracts only. They are not recipes or
// examples of nutritional adequacy, and no dietary validity is asserted here.
function sourceFixture() {
  return {
    format: 'meal-planner.diet',
    schemaVersion: 1,
    planId: 'synthetic-source',
    title: 'Synthetic data fixture',
    language: 'it',
    createdAt: NOW,
    suggestedStartDate: '2026-10-24',
    baseServings: 1,
    extension: { retained: ['unknown', 'metadata'] },
    days: [{
      date: '2026-10-24',
      meals: [{
        mealId: 'entry-a',
        type: 'custom-type',
        title: 'Record A',
        time: '12:00',
        ingredients: [{ ingredientId: 'a', name: 'A', quantity: 10, unit: 'g', basis: 'raw' }],
        extension: { retained: true },
      }],
    }],
  };
}

test('civil-date arithmetic spans DST, leap days and year boundaries', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('0099-12-31', 1), '0100-01-01');
  assert.equal(daysBetween('2026-10-26', '2026-10-24'), -2);
});

test('date helpers reject unsafe syntax and invalid calendar dates', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '2026-10-19T00:00:00Z', null]) {
    assert.throws(() => addDays(date, 0), RangeError);
  }
  assert.throws(() => addDays('2026-10-19', 0.5), TypeError);
  assert.throws(() => addDays('9999-12-31', 1), RangeError);
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test('.diet envelope parsing retains the original shape and open metadata', () => {
  const source = sourceFixture();
  const parsed = readDietDocument(JSON.stringify(source));
  assert.deepEqual(parsed, source);
  assert.deepEqual(summarizeDiet(parsed), {
    planId: 'synthetic-source', title: 'Synthetic data fixture', language: 'it',
    dayCount: 1, mealCount: 1, suggestedStartDate: '2026-10-24',
  });
  const extended = { ...source, days: Array.from({ length: 11 }, (_, i) => ({ date: addDays('2026-10-24', i), meals: [] })) };
  assert.equal(readDietDocument(JSON.stringify(extended)).days.length, 11);
});

test('.diet failures are limited to JSON and supported envelope structure', () => {
  assert.throws(() => readDietDocument('{'), { code: 'DIET_INVALID_JSON' });
  assert.throws(() => readDietDocument('null'), { code: 'DIET_INVALID_DOCUMENT' });
  assert.throws(() => readDietDocument(JSON.stringify({ format: 'other', schemaVersion: 1, days: [{}] })), { code: 'DIET_UNSUPPORTED_FORMAT' });
  assert.throws(() => readDietDocument(JSON.stringify({ format: 'meal-planner.diet', schemaVersion: 2, days: [{}] })), { code: 'DIET_UNSUPPORTED_VERSION' });
  assert.throws(() => readDietDocument(JSON.stringify({ format: 'meal-planner.diet', schemaVersion: 1, days: [] })), { code: 'DIET_MISSING_DAYS' });
});

test('initial state contains the agreed phase-1 defaults', () => {
  const state = createAppState({ now: NOW });
  assert.equal(state.format, 'meal-planner.state');
  assert.equal(state.schemaVersion, 1);
  assert.deepEqual(state.settings, { uiLanguage: 'it', reducedMotion: false, weekStartsOn: 1 });
  assert.deepEqual(state.shopping.range, { startDate: null, endDate: null });
  assert.deepEqual(state.meta, { createdAt: NOW, updatedAt: NOW });
  assert.equal(createAppState({ now: new Date(NOW), uiLanguage: 'en' }).settings.uiLanguage, 'en');
});

test('source snapshots are isolated, immutable and separate from calendar references', () => {
  const original = createAppState({ now: NOW });
  const document = sourceFixture();
  const added = addSourcePlan(original, document, { sourceId: 'source-a', fileName: 'fixture.diet', now: LATER });
  assert.deepEqual(original.sourcePlans, {});
  assert.deepEqual(added.state.calendar, {});
  assert.equal(added.state.meta.updatedAt, LATER);
  assert.equal(added.state.sourcePlans['source-a'].fileName, 'fixture.diet');
  document.extension.retained.push('external mutation');
  assert.deepEqual(added.state.sourcePlans['source-a'].document.extension.retained, ['unknown', 'metadata']);
  assert.throws(() => { added.state.sourcePlans['source-a'].document.title = 'changed'; }, TypeError);
  const again = addSourcePlan(added.state, sourceFixture(), { sourceId: 'source-b', now: LATER });
  assert.equal(Object.keys(again.state.sourcePlans).length, 2);
  assert.equal(again.state.sourcePlans['source-a'].document.planId, again.state.sourcePlans['source-b'].document.planId);
  assert.throws(() => addSourcePlan(again.state, sourceFixture(), { sourceId: 'source-b' }));

  const entry = createCalendarEntry({ entryId: 'calendar-a', sourceId: 'source-a', sourceDate: '2026-10-24', mealId: 'entry-a' });
  assert.deepEqual(entry, {
    entryId: 'calendar-a', sourceId: 'source-a', sourceDate: '2026-10-24',
    mealId: 'entry-a', cookingServings: 1, timeOverride: null,
  });
});

test('opaque source keys and automatic source identities remain distinct', () => {
  const start = createAppState({ now: NOW });
  const special = addSourcePlan(start, sourceFixture(), { sourceId: '__proto__', now: NOW });
  assert.equal(Object.hasOwn(special.state.sourcePlans, '__proto__'), true);
  assert.equal(Object.getPrototypeOf(special.state.sourcePlans), Object.prototype);
  const first = addSourcePlan(start, sourceFixture(), { now: NOW });
  const second = addSourcePlan(first.state, sourceFixture(), { now: NOW });
  assert.notEqual(first.sourceId, second.sourceId);
});

test('backup round trips preserve state and metadata with snapshot isolation', () => {
  const { state } = addSourcePlan(createAppState({ now: NOW }), sourceFixture(), { sourceId: 'source-a', now: NOW });
  state.extra = { preserved: true };
  state.calendar['2026-11-01'] = {
    date: '2026-11-01',
    meals: [createCalendarEntry({ entryId: 'calendar-a', sourceId: 'source-a', sourceDate: '2026-10-24', mealId: 'entry-a', cookingServings: 2 })],
  };
  const backup = createBackup(state, { now: LATER });
  assert.equal(backup.format, 'meal-planner.backup');
  assert.equal(backup.exportedAt, LATER);
  assert.deepEqual(readBackup(JSON.stringify(backup)), state);
  backup.state.settings.uiLanguage = 'en';
  assert.equal(state.settings.uiLanguage, 'it');
  const restored = readBackup(JSON.stringify(backup));
  restored.shopping.manualItems.push({ itemId: 'manual-a', name: 'Synthetic extra', checked: false });
  assert.equal(backup.state.shopping.manualItems.length, 0);
  assert.equal(Object.isFrozen(restored.sourcePlans['source-a'].document), true);
});

test('backup parsing rejects unsupported envelopes and missing state containers', () => {
  assert.throws(() => readBackup('{'), { code: 'BACKUP_INVALID_JSON' });
  assert.throws(() => readBackup(JSON.stringify(sourceFixture())), { code: 'BACKUP_UNSUPPORTED_FORMAT' });
  const backup = createBackup(createAppState({ now: NOW }), { now: NOW });
  assert.throws(() => readBackup(JSON.stringify({ ...backup, schemaVersion: 2 })), { code: 'BACKUP_UNSUPPORTED_VERSION' });
  delete backup.state.shopping.range;
  assert.throws(() => readBackup(JSON.stringify(backup)), { code: 'BACKUP_INVALID_STATE' });
});

test('memory repository is asynchronous, isolated and explicitly ephemeral', async () => {
  const initial = createAppState({ now: NOW });
  const repository = createMemoryRepository(initial);
  assert.equal(repository.kind, 'memory');
  initial.settings.uiLanguage = 'en';
  assert.equal((await repository.load()).settings.uiLanguage, 'it');
  const firstRead = await repository.load();
  firstRead.shopping.mode = 'two';
  assert.equal((await repository.load()).shopping.mode, 'one');
  await repository.save(firstRead);
  firstRead.shopping.mode = 'advanced';
  assert.equal((await repository.load()).shopping.mode, 'two');
  assert.equal(await createMemoryRepository().load(), null);
  await repository.clear();
  assert.equal(await repository.load(), null);
});

test('shopping modes scale synthetic quantities without changing source metadata', () => {
  assert.equal(getShoppingMultiplier('one', 3), 1);
  assert.equal(getShoppingMultiplier('two', 3), 2);
  assert.equal(getShoppingMultiplier('advanced', 3), 3);
  const ingredients = [{ ingredientId: 'a', name: 'A', quantity: 1.25, unit: 'unit', extension: { preserved: true } }];
  const scaled = scaleIngredients(ingredients, 2);
  assert.equal(scaled[0].quantity, 2.5);
  assert.equal(ingredients[0].quantity, 1.25);
  scaled[0].extension.preserved = false;
  assert.equal(ingredients[0].extension.preserved, true);
});

test('compatible unit arithmetic preserves distinct units and measurement bases', () => {
  assert.deepEqual(normalizeQuantity(0.25, 'kg'), { quantity: 250, unit: 'g' });
  assert.deepEqual(normalizeQuantity(0.5, 'l'), { quantity: 500, unit: 'ml' });
  assert.deepEqual(normalizeQuantity(2, 'box'), { quantity: 2, unit: 'box' });
  const items = [
    { cookingServings: 3, ingredients: [{ ingredientId: 'a', name: 'A', quantity: 10, unit: 'g', basis: 'raw' }] },
    { cookingServings: 4, ingredients: [{ ingredientId: 'a', name: 'Alternate label', quantity: 0.02, unit: 'kg', basis: 'raw' }] },
    { cookingServings: 1, ingredients: [
      { ingredientId: 'a', name: 'A', quantity: 2, unit: 'unit', basis: 'raw' },
      { ingredientId: 'a', name: 'A', quantity: 5, unit: 'g', basis: 'cooked' },
      { ingredientId: 'a', name: 'A', quantity: 7, unit: 'g' },
    ] },
  ];
  for (const [mode, expected] of [['one', 30], ['two', 60], ['advanced', 110]]) {
    const totals = aggregateIngredients(items, mode);
    assert.equal(totals.length, 4);
    assert.equal(totals.find(item => item.unit === 'g' && item.basis === 'raw').quantity, expected);
    assert.equal(new Set(totals.map(item => item.key)).size, 4);
  }
});

test('personal arithmetic remains independent of shopping scaling and retains unknown totals', () => {
  const meals = [
    { cookingServings: 2, ingredients: [{ quantity: 10 }], nutrition: { kcal: 10, proteinG: 2, fatG: 0 } },
    { cookingServings: 7, ingredients: [{ quantity: 20 }], nutrition: { kcal: 20, proteinG: 3, fatG: 0 } },
  ];
  assert.equal(scaleIngredients(meals[0].ingredients, getShoppingMultiplier('advanced', meals[0].cookingServings))[0].quantity, 20);
  assert.deepEqual(totalNutritionPerPerson(meals), {
    kcal: 30, proteinG: 5, carbohydratesG: null, fatG: 0, fiberG: null,
  });
  assert.equal(totalNutritionPerPerson([...meals, { nutrition: {} }]).kcal, null);
  assert.deepEqual(totalNutritionPerPerson([]), {
    kcal: null, proteinG: null, carbohydratesG: null, fatG: null, fiberG: null,
  });
});
