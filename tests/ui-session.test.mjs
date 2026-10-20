import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../src/data/state.js';
import { createDemoState } from '../src/data/demo.js';
import { messages } from '../src/ui/i18n.js';
import { escape, attributes, mealCard } from '../src/ui/components.js';
import {
  applySessionImport, buildImportPreview, findEntry, getDayEntries,
  getRangeEntries, getShoppingItems, setEntryServings, setEntryTime,
} from '../src/data/session.js';

const NOW = '2026-10-19T15:30:00.000Z';

// Synthetic records exercise references, date mapping and UI state only.
// They are not recipes and contain no nutrition or dietary preferences.
function sourceFixture(planId = 'synthetic-ui-plan') {
  const dates = ['2026-10-21', '2026-10-23', '2026-10-24'];
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId,
    title: 'Documento dimostrativo', language: 'it', createdAt: NOW,
    suggestedStartDate: dates[0], baseServings: 1,
    extension: { retained: ['unknown', 'metadata'] },
    days: dates.map((date, index) => ({
      date,
      meals: [
        {
          mealId: `record-${index}-later`, type: 'custom-type',
          title: `Record ${index} B`, time: '18:00',
          ingredients: [{ ingredientId: `item-${index}-b`, name: 'Voce B', quantity: 2, unit: 'unit' }],
        },
        {
          mealId: `record-${index}-earlier`, type: 'custom-type',
          title: `Record ${index} A`, time: '09:00',
          ingredients: [{ ingredientId: `item-${index}-a`, name: 'Voce A', quantity: 3, unit: 'unit' }],
          extension: { retained: true },
        },
      ],
    })),
  };
}

function scheduledState(document = sourceFixture()) {
  return createDemoState(document, { startDate: '2026-10-24', now: NOW });
}

test('demo assignment preserves gaps across DST and freezes original source dates', () => {
  const document = sourceFixture();
  const untouched = structuredClone(document);
  const state = createDemoState(document, {
    startDate: '2026-10-24', uiLanguage: 'en', now: NOW,
  });
  assert.deepEqual(Object.keys(state.calendar), ['2026-10-24', '2026-10-26', '2026-10-27']);
  assert.deepEqual(state.shopping.range, { startDate: '2026-10-24', endDate: '2026-10-27' });
  assert.deepEqual(state.ui, { view: 'today', selectedDate: '2026-10-24' });
  assert.equal(state.settings.uiLanguage, 'en');
  const source = Object.values(state.sourcePlans)[0];
  assert.deepEqual(source.document, untouched);
  assert.deepEqual(document, untouched);
  assert.ok(Object.isFrozen(source.document));
  assert.ok(Object.isFrozen(source.document.days[0].meals[0]));
  assert.equal(source.document.language, 'it');
  for (const row of getRangeEntries(state, '2026-10-24', '2026-10-27')) {
    assert.equal(row.cookingServings, 1);
    assert.equal(row.entry.timeOverride, null);
  }
  assert.deepEqual(state.imports[0].dayMappings, [
    { sourceDate: '2026-10-21', assignedDate: '2026-10-24' },
    { sourceDate: '2026-10-23', assignedDate: '2026-10-26' },
    { sourceDate: '2026-10-24', assignedDate: '2026-10-27' },
  ]);
});

test('import preview is nonmutating and overlapping days require an atomic explicit replacement', () => {
  const state = scheduledState();
  const before = structuredClone(state);
  const replacement = sourceFixture('replacement');
  replacement.days[0].meals = replacement.days[0].meals.slice(0, 1);
  const preview = buildImportPreview(state, replacement, '2026-10-26');
  assert.deepEqual(preview.overlaps, ['2026-10-26']);
  assert.equal(preview.endDate, '2026-10-29');
  assert.equal(preview.mealCount, 5);
  assert.deepEqual(state, before);
  assert.throws(() => applySessionImport(state, replacement, {
    startDate: '2026-10-26', now: NOW,
  }), { code: 'SESSION_IMPORT_OVERLAP' });
  assert.deepEqual(state, before);

  const result = applySessionImport(state, replacement, {
    startDate: '2026-10-26', fileName: 'replacement.diet', overwrite: true, now: NOW,
  });
  assert.equal(result.state.calendar['2026-10-26'].meals.length, 1);
  assert.deepEqual(result.state.calendar['2026-10-24'], before.calendar['2026-10-24']);
  assert.deepEqual(result.state.calendar['2026-10-27'], before.calendar['2026-10-27']);
  assert.equal(Object.keys(result.state.sourcePlans).length, 2);
  assert.equal(result.state.imports.length, 2);
  assert.equal(result.state.sourcePlans[result.sourceId].fileName, 'replacement.diet');
  assert.deepEqual(result.state.sourcePlans[result.sourceId].document, replacement);
  assert.deepEqual(result.state.ui, before.ui);
  assert.deepEqual(result.state.shopping.range, before.shopping.range);
  assert.deepEqual(state, before);
});

test('day and range reads resolve the selected occurrences and effective times', () => {
  const state = scheduledState();
  const first = getDayEntries(state, '2026-10-24');
  const second = getDayEntries(state, '2026-10-26');
  assert.deepEqual(first.map(row => row.meal.mealId), ['record-0-earlier', 'record-0-later']);
  assert.deepEqual(second.map(row => row.meal.mealId), ['record-1-earlier', 'record-1-later']);
  assert.equal(first[0].date, '2026-10-24');
  assert.equal(first[0].entry.sourceDate, '2026-10-21');
  assert.equal(findEntry(state, second[0].entry.entryId).meal.mealId, 'record-1-earlier');
  assert.deepEqual(getDayEntries(state, '2026-10-25'), []);
  assert.deepEqual(getRangeEntries(state, '2026-10-25', '2026-10-26').map(row => row.meal.mealId),
    ['record-1-earlier', 'record-1-later']);
  state.shopping.range = { startDate: '2026-10-26', endDate: '2026-10-26' };
  assert.deepEqual(getShoppingItems(state).map(row => row.ingredientId), ['item-1-a', 'item-1-b']);
});

test('unresolved references and duplicate identities fail as technical errors', () => {
  const state = scheduledState();
  const missingSource = structuredClone(state);
  missingSource.calendar['2026-10-24'].meals[0].sourceId = 'missing';
  assert.throws(() => getDayEntries(missingSource, '2026-10-24'), { code: 'SESSION_BROKEN_REFERENCE' });
  const missingMeal = structuredClone(state);
  missingMeal.calendar['2026-10-24'].meals[0].mealId = 'missing';
  assert.throws(() => getDayEntries(missingMeal, '2026-10-24'), { code: 'SESSION_BROKEN_REFERENCE' });
  const duplicateEntry = structuredClone(state);
  duplicateEntry.calendar['2026-10-24'].meals[1].entryId = duplicateEntry.calendar['2026-10-24'].meals[0].entryId;
  assert.throws(() => getDayEntries(duplicateEntry, '2026-10-24'), { code: 'SESSION_DUPLICATE_ID' });
  const duplicateAcrossDays = structuredClone(state);
  const repeatedId = duplicateAcrossDays.calendar['2026-10-24'].meals[0].entryId;
  duplicateAcrossDays.calendar['2026-10-26'].meals[0].entryId = repeatedId;
  assert.throws(() => findEntry(duplicateAcrossDays, repeatedId), { code: 'SESSION_DUPLICATE_ID' });
  const duplicateSourceDate = sourceFixture();
  duplicateSourceDate.days[1].date = duplicateSourceDate.days[0].date;
  assert.throws(() => buildImportPreview(state, duplicateSourceDate, '2026-11-01'), { code: 'SESSION_DUPLICATE_ID' });
  const duplicateMealId = sourceFixture();
  duplicateMealId.days[1].meals[0].mealId = duplicateMealId.days[0].meals[0].mealId;
  assert.throws(() => buildImportPreview(state, duplicateMealId, '2026-11-01'), { code: 'SESSION_DUPLICATE_ID' });
});

test('occurrence edits preserve sources and other entries and allow restoring the original time', () => {
  const state = scheduledState();
  const before = structuredClone(state);
  const entryId = getDayEntries(state, '2026-10-24')[1].entry.entryId;
  const withPeople = setEntryServings(state, entryId, 3);
  const withTime = setEntryTime(withPeople, entryId, '08:30');
  const changed = findEntry(withTime, entryId);
  assert.equal(changed.cookingServings, 3);
  assert.equal(changed.time, '08:30');
  assert.equal(changed.entry.timeOverride, '08:30');
  assert.equal(getDayEntries(withTime, '2026-10-24')[0].entry.entryId, entryId);
  assert.deepEqual(withTime.sourcePlans, before.sourcePlans);
  assert.deepEqual(withTime.calendar['2026-10-26'], before.calendar['2026-10-26']);
  assert.deepEqual(withTime.settings, before.settings);
  assert.deepEqual(state, before);
  const restoredTime = setEntryTime(withTime, entryId, null);
  assert.equal(findEntry(restoredTime, entryId).time, '18:00');
  assert.equal(findEntry(restoredTime, entryId).entry.timeOverride, null);
  assert.throws(() => setEntryTime(state, entryId, '28:10'), { code: 'SESSION_INVALID_TIME' });
  assert.throws(() => setEntryServings(state, entryId, 0), { code: 'SESSION_INVALID_SERVINGS' });
  assert.throws(() => setEntryServings(state, 'missing', 2), { code: 'SESSION_ENTRY_NOT_FOUND' });
});

test('empty views and inclusive empty ranges remain readable without inferred records', () => {
  const state = createAppState({ now: NOW });
  assert.deepEqual(getDayEntries(state, '2026-10-24'), []);
  assert.deepEqual(getRangeEntries(state, '2026-10-24', '2026-10-27'), []);
  assert.deepEqual(getShoppingItems(state), []);
  assert.equal(findEntry(state, 'missing'), null);
  state.shopping.range = { startDate: '2026-10-24', endDate: '2026-10-24' };
  assert.deepEqual(getShoppingItems(state), []);
  assert.throws(() => getRangeEntries(state, '2026-10-27', '2026-10-24'), { code: 'SESSION_INVALID_RANGE' });
  assert.throws(() => getDayEntries(state, '2026-02-30'), { code: 'SESSION_INVALID_DATE' });
});

test('UI dictionaries have matching keys and English rendering preserves escaped Italian source text', () => {
  function keys(value, prefix = '') {
    return Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === 'string' ? [path] : keys(child, path);
    }).sort();
  }
  assert.deepEqual(keys(messages.en), keys(messages.it));
  assert.equal(escape('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;');
  assert.equal(attributes({ title: '" onfocus="example', hidden: false }),
    ' title="&quot; onfocus=&quot;example"');
  const document = sourceFixture();
  document.days[0].meals[1].type = 'breakfast';
  document.days[0].meals[1].title = 'Titolo italiano & <em>originale</em>';
  const state = scheduledState(document);
  const before = structuredClone(state.sourcePlans);
  state.settings.uiLanguage = 'en';
  const html = mealCard(getDayEntries(state, '2026-10-24')[0], 'en');
  assert.match(html, /Breakfast/);
  assert.match(html, /lang="it"/);
  assert.match(html, /Titolo italiano &amp; &lt;em&gt;originale&lt;\/em&gt;/);
  assert.doesNotMatch(html, /<em>originale<\/em>/);
  assert.deepEqual(state.sourcePlans, before);
});
