import test from 'node:test';
import assert from 'node:assert/strict';
import { groupShoppingItems, createShoppingText, shoppingTextFileName } from '../src/ui/shopping-output.js';
import { formatShoppingAmount } from '../src/ui/i18n.js';

function snapshot() {
  return {
    range: { startDate: '2026-10-21', endDate: '2026-10-23' }, mode: 'two',
    rows: [
      { key: 'a', name: 'Voce italiana', category: 'grains', quantity: 12345.5, unit: 'g', basis: 'dry', checked: false, reopened: true, previousQuantity: 500 },
      { key: 'b', name: 'Another supplied name', category: 'produce', quantity: 2, unit: 'unit', checked: true },
    ],
    manualItems: [{ itemId: 'extra', name: 'Sacchetti', quantity: 3, unit: 'box', category: 'other', checked: true }],
    mealCount: 4, generatedCount: 2, manualCount: 1, checkedCount: 2, totalCount: 3, reopenedCount: 1,
  };
}

test('text export localizes interface and quantities while preserving names, manual quantities and effective check states', () => {
  const list = snapshot();
  const original = structuredClone(list);
  const it = createShoppingText(list, 'it');
  const en = createShoppingText(list, 'en');
  assert.match(it, /12\.345,5 g/);
  assert.match(en, /12,345\.5 g/);
  for (const text of [it, en]) {
    assert.match(text, /\[ \] Voce italiana/);
    assert.match(text, /\[x\] Another supplied name/);
    assert.match(text, /\[x\] Sacchetti — 3 box/);
    assert.ok(text.includes('500 g'));
    assert.ok(text.endsWith('\n'));
  }
  assert.match(it, /Due persone/);
  assert.match(en, /Two people/);
  assert.ok(en.includes('21') && en.includes('23') && en.includes('2026'));
  assert.deepEqual(list, original);
});

test('category order is shared by screen/text and sorting never translates names or mutates the source arrays', () => {
  const list = snapshot();
  list.rows.push({ name: 'Zebra', category: 'custom-z' }, { name: 'Alfa', category: 'custom-a' });
  const original = structuredClone(list.rows);
  const grouped = groupShoppingItems(list.rows, 'it');
  assert.deepEqual(grouped.map(group => group.category), ['produce', 'grains', 'custom-a', 'custom-z']);
  assert.equal(grouped[1].items[0].name, 'Voce italiana');
  assert.deepEqual(list.rows, original);
});

test('manual-only and legacy rows can be exported without a selected range and multiline input stays on one checklist line', () => {
  const list = { ...snapshot(), rows: [], range: { startDate: null, endDate: null }, mealCount: 0,
    manualItems: [{ itemId: 'legacy', name: 'Voce\ncon\tspazi', checked: false }], totalCount: 1, checkedCount: 0 };
  const text = createShoppingText(list, 'it');
  assert.match(text, /\[ \] Voce con spazi/);
  assert.equal(text.split('\n').filter(line => line.startsWith('[ ]')).length, 1);
  assert.ok(!text.includes('undefined'));
  assert.equal(shoppingTextFileName(list, 'it'), 'meal-planner-shopping-manual-it.txt');
  assert.equal(shoppingTextFileName(snapshot(), 'en'), 'meal-planner-shopping-2026-10-21_2026-10-23-en.txt');
});

test('quantity formatting keeps tiny and large finite values visible without modifying the numbers', () => {
  for (const language of ['it', 'en']) {
    assert.notEqual(formatShoppingAmount(0.00000001, 'g', language), '0 g');
    assert.notEqual(formatShoppingAmount(1e15, 'ml', language), '— ml');
    assert.ok(formatShoppingAmount(1.5, 'unit', language).includes(language === 'it' ? '1,5' : '1.5'));
    assert.equal(formatShoppingAmount(3, 'box', language), '3 box');
    assert.equal(formatShoppingAmount(1, 'constructor', language), '1 constructor');
    assert.equal(formatShoppingAmount(1, '__proto__', language), '1 __proto__');
  }
});
