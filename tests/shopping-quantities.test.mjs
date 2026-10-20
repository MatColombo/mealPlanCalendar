import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateIngredients, getShoppingMultiplier, normalizeQuantity, scaleIngredients, validateUnitConversion,
} from '../src/shopping/quantities.js';

const item = (quantity, overrides = {}) => ({
  ingredientId: 'record-a', name: 'Etichetta dimostrativa', quantity, unit: 'unit', ...overrides,
});

test('all shopping modes sum each consumed allocation once, independent of preparation metadata', () => {
  const meals = [
    { cookingServings: 3, preparation: { batchId: 'shared-batch', role: 'cook', preparedServings: 100 }, ingredients: [item(2)] },
    { cookingServings: 2, preparation: { batchId: 'shared-batch', role: 'leftover' }, ingredients: [item(0.5)] },
    { ingredients: [item(1)] },
  ];
  const before = structuredClone(meals);
  for (const [mode, expected] of [['one', 3.5], ['two', 7], ['advanced', 8]]) {
    const rows = aggregateIngredients(meals, mode);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quantity, expected);
    assert.equal(rows[0].unit, 'unit');
  }
  assert.equal(aggregateIngredients([meals[1]], 'one')[0].quantity, 0.5);
  assert.equal(getShoppingMultiplier('advanced'), 1);
  assert.deepEqual(aggregateIngredients([], 'two'), []);
  assert.deepEqual(meals, before);
});

test('grouping uses stable identity, canonical metric unit and exact basis, independently of labels', () => {
  const rows = aggregateIngredients([{ ingredients: [
    item(1.25, { unit: ' KG ', basis: 'raw', category: 'first-category', extension: { source: 'first' } }),
    item(250, { unit: ' G ', basis: 'raw', name: 'Another language', category: 'second-category' }),
    item(2, { unit: 'unit', basis: 'raw' }),
    item(25, { unit: 'g', basis: 'cooked' }),
    item(10, { unit: 'g' }),
    item(5, { unit: 'g', basis: '' }),
    item(3, { unit: 'g', basis: 'RAW' }),
    item(7, { ingredientId: 'record-b', unit: 'g', basis: 'raw' }),
    item(1, { unit: 'box', basis: 'raw' }),
    item(2, { unit: ' box ', basis: 'raw' }),
    item(0.4, { ingredientId: 'volume-record', unit: ' L ' }),
    item(100, { ingredientId: 'volume-record', unit: 'mL' }),
  ] }]);
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map(row => row.key)).size, 10);
  const rawWeight = rows.find(row => row.key === '["record-a","g","raw"]');
  assert.equal(rawWeight.quantity, 1500);
  assert.equal(rawWeight.name, 'Etichetta dimostrativa');
  assert.equal(rawWeight.category, 'first-category');
  assert.deepEqual(rawWeight.extension, { source: 'first' });
  assert.deepEqual(rows.filter(row => row.ingredientId === 'record-a').map(row => [row.unit, row.basis, row.quantity]), [
    ['g', 'raw', 1500], ['unit', 'raw', 2], ['g', 'cooked', 25], ['g', undefined, 10],
    ['g', '', 5], ['g', 'RAW', 3], ['box', 'raw', 1], [' box ', 'raw', 2],
  ]);
  assert.equal(rows.find(row => row.ingredientId === 'record-b').quantity, 7);
  assert.deepEqual(rows.find(row => row.ingredientId === 'volume-record'), {
    ...item(500, { ingredientId: 'volume-record', unit: 'ml' }), key: '["volume-record","ml",null]',
  });
});

test('explicit conversion applies locally before metric normalization and retains the exact basis', () => {
  const meals = [{ cookingServings: 2, ingredients: [
    item(2, { basis: 'raw', unitConversion: { toUnit: 'g', factor: 50 } }),
    item(25, { unit: 'g', basis: 'raw' }),
    item(1, { basis: 'raw' }),
    item(1, { basis: 'raw', unitConversion: { toUnit: 'kg', factor: 0.075 } }),
    item(1, { basis: 'cooked', unitConversion: { toUnit: 'g', factor: 50 } }),
    item(1, { unitConversion: { toUnit: 'g', factor: 50 } }),
  ] }];
  const rows = aggregateIngredients(meals, 'advanced');
  assert.deepEqual(rows.map(row => [row.unit, row.basis, row.quantity]), [
    ['g', 'raw', 400], ['unit', 'raw', 2], ['g', 'cooked', 100], ['g', undefined, 100],
  ]);
  assert.deepEqual(normalizeQuantity(3, 'bottle', { toUnit: ' L ', factor: 0.25 }), { quantity: 750, unit: 'ml' });
  assert.deepEqual(normalizeQuantity(2, 'box', { toUnit: ' packet ', factor: 4 }), { quantity: 8, unit: ' packet ' });
  assert.deepEqual(normalizeQuantity(100, 'ml'), { quantity: 100, unit: 'ml' });
  assert.deepEqual(normalizeQuantity(100, 'ml', { toUnit: 'g', factor: 0.8 }), { quantity: 80, unit: 'g' });
});

test('derived rows consume conversion instructions once while original and other open metadata survive', () => {
  const ingredient = item(2, {
    unitConversion: { toUnit: 'g', factor: 50, annotation: { preservedInSource: true } },
    extension: { preserved: true },
  });
  const before = structuredClone(ingredient);
  assert.equal(validateUnitConversion(undefined), undefined);
  assert.equal(validateUnitConversion(ingredient.unitConversion), undefined);
  const scaled = scaleIngredients([ingredient], 3);
  assert.equal(scaled[0].quantity, 6);
  assert.equal(scaled[0].unit, 'unit');
  assert.deepEqual(scaled[0].unitConversion, ingredient.unitConversion);
  const [row] = aggregateIngredients([{ ingredients: [ingredient] }]);
  assert.equal(row.quantity, 100);
  assert.equal(Object.hasOwn(row, 'unitConversion'), false);
  assert.equal(aggregateIngredients([{ ingredients: [row] }])[0].quantity, 100);
  row.extension.preserved = false;
  scaled[0].unitConversion.annotation.preservedInSource = false;
  assert.deepEqual(ingredient, before);
});

test('fractional multipliers and small contributions are retained without intermediate rounding', () => {
  assert.equal(scaleIngredients([item(1.00125)], 0.5)[0].quantity, 0.500625);
  assert.equal(aggregateIngredients([{ cookingServings: 1.25, ingredients: [item(0.5)] }], 'advanced')[0].quantity, 0.625);
  for (const values of [[1e16, 1, 1], [1, 1, 1e16]]) {
    assert.equal(aggregateIngredients([{ ingredients: values.map(value => item(value)) }])[0].quantity, 10000000000000002);
  }
  const thirds = aggregateIngredients([{ ingredients: [item(1 / 3), item(1 / 3), item(1 / 3)] }]);
  assert.equal(thirds[0].quantity, 1);
  assert.equal(normalizeQuantity(1 / 3, 'unit', { toUnit: 'g', factor: 3 }).quantity, 1);
});

test('invalid conversion declarations and nonfinite arithmetic report technical errors without changing inputs', () => {
  for (const conversion of [
    null, [], {}, { toUnit: '', factor: 1 }, { toUnit: 'g', factor: 0 },
    { toUnit: 'g', factor: -1 }, { toUnit: 'g', factor: Infinity },
    { toUnit: 'g', factor: NaN }, { toUnit: 'g', factor: '50' },
  ]) {
    assert.throws(() => normalizeQuantity(1, 'unit', conversion), { code: 'SHOPPING_INVALID_CONVERSION' });
  }
  const ingredient = item(Number.MAX_VALUE);
  const before = structuredClone(ingredient);
  assert.throws(() => scaleIngredients([ingredient], 2), { code: 'SHOPPING_NONFINITE_QUANTITY' });
  assert.throws(() => normalizeQuantity(Number.MAX_VALUE, 'kg'), { code: 'SHOPPING_NONFINITE_QUANTITY' });
  assert.throws(() => normalizeQuantity(Number.MAX_VALUE, 'unit', { toUnit: 'g', factor: 2 }), { code: 'SHOPPING_NONFINITE_QUANTITY' });
  assert.throws(() => aggregateIngredients([{ ingredients: [ingredient, ingredient] }]), { code: 'SHOPPING_NONFINITE_QUANTITY' });
  assert.deepEqual(ingredient, before);
});
