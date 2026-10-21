import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../src/data/state.js';
import { applySessionImport, getDayEntries, setEntryServings } from '../src/data/session.js';
import { buildRecipeIndex } from '../src/data/recipes.js';
import { renderApp } from '../src/ui/render.js';
import { renderRecipeResults } from '../src/ui/recipes-view.js';

const TODAY = '2026-10-21';
const NOW = '2026-10-21T12:00:00.000Z';
const TITLE = 'Voce <Alfa & co>';
const ESCAPED_TITLE = 'Voce &lt;Alfa &amp; co&gt;';

// These values are arbitrary display fixtures, never nutritional assertions.
// String-render checks do not claim browser layout or iPhone picker coverage.
function fixture({ view = 'today', language = 'it' } = {}) {
  const document = {
    format: 'meal-planner.diet', schemaVersion: 1, planId: 'release-ui-1-1',
    title: 'Documento sintetico UI', language: 'it', createdAt: NOW,
    suggestedStartDate: '2026-01-01', baseServings: 1,
    days: ['2026-01-01', '2026-01-02', '2026-01-03'].map((date, index) => ({
      date,
      ...(index === 1 ? { workday: { class: 'night-shift', label: 'Linea A', startTime: '22:00', endTime: '06:00', endDayOffset: 1 } }
        : { notes: 'night-shift in a description is not a day class' }),
      meals: [{
        mealId: 'record-' + index, recipeId: 'ui-record-alpha', title: TITLE,
        type: 'lunch', time: '12:30',
        ingredients: [{ ingredientId: 'record-alpha', name: 'Elemento Àlfa', quantity: 123, unit: 'g', category: 'produce',
          nutrition: { kcal: 101, proteinG: 7, carbohydratesG: 11, fatG: 13, fiberG: 17, sugarsG: 19 } }],
        instructions: ['Passaggio <A> & B'],
      }],
    })),
  };
  const { state } = applySessionImport(createAppState({ now: NOW, uiLanguage: language }), document, {
    startDate: '2026-10-20', now: NOW, fileName: 'synthetic.diet',
  });
  state.ui = { view, selectedDate: TODAY };
  return { state, today: TODAY, loading: false, busy: false, storage: { status: 'ready' }, recipeFilters: {}, dialog: null };
}

function daySummary(html) {
  return html.match(/<section class="day-summary[\s\S]*?<\/section>/u)?.[0];
}

test('recipe book has localized toolbar and mobile navigation shortcuts', () => {
  for (const [language, label] of [['it', 'Ricettario'], ['en', 'Recipes']]) {
    const html = renderApp(fixture({ language, view: 'recipes' }));
    const toolbar = html.match(/<div class="header-actions"[\s\S]*?<div class="language-control"/u)?.[0];
    const mobile = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/u)?.[0];
    assert.ok(toolbar && mobile);
    assert.match(toolbar, /class="header-action is-active"[^>]*data-view="recipes"/u);
    assert.match(mobile, /href="#recipes"[^>]*aria-current="page"/u);
    assert.ok(toolbar.includes(label));
    assert.ok(mobile.includes(label));
  }
});

test('today and calendar expose a labeled people stepper directly on the meal card', () => {
  for (const view of ['today', 'calendar']) {
    const model = fixture({ view });
    const html = renderApp(model);
    const card = html.match(/<article class="meal-card [\s\S]*?<\/article>/u)?.[0];
    assert.ok(card);
    assert.doesNotMatch(html, /<dialog\b/u);
    assert.match(card, /class="field meal-people-control"/u);
    assert.match(card, /<label for="card-servings-[^"]+"/u);
    assert.match(card, /data-action="change-servings"[^>]*data-delta="-1"/u);
    assert.match(card, /data-action="change-servings"[^>]*data-delta="1"/u);
    assert.match(card, /<input[^>]*type="number"[^>]*data-control="meal-servings"[^>]*value="1"[^>]*aria-label=/u);
    assert.match(html, /data-people-status[^>]*role="status"[^>]*aria-live="polite"/u);
    assert.match(html, /class="workday-badge" data-workday-class="night-shift"/u);
    assert.match(html, /Turno notte/u);
    assert.match(html, /22:00 – 06:00/u);
  }
});

test('provided macro values render on cards and personal summaries survive a people change', () => {
  const model = fixture();
  const before = renderApp(model);
  const sourceBefore = structuredClone(model.state.sourcePlans);
  const card = before.match(/<article class="meal-card [\s\S]*?<\/article>/u)?.[0];
  assert.match(card, /class="meal-macros"/u);
  for (const label of ['Proteine', 'Carboidrati', 'Grassi']) assert.ok(card.includes(label));
  assert.match(card, /<strong>7 g<\/strong>/u);
  const originalSummary = daySummary(before);
  assert.ok(originalSummary);
  assert.match(originalSummary, /<strong>101<small>kcal<\/small><\/strong>/u);
  assert.match(originalSummary, /<strong>7<small>g<\/small><\/strong>/u);
  const entryId = getDayEntries(model.state, TODAY)[0].entry.entryId;
  model.state = setEntryServings(model.state, entryId, 3, { now: NOW });
  const after = renderApp(model);
  assert.equal(daySummary(after), originalSummary);
  assert.match(after, /data-control="meal-servings"[^>]*value="3"/u);
  assert.deepEqual(model.state.sourcePlans, sourceBefore);
});

test('the .diet picker leaves file types unrestricted for the native iPhone Files chooser', () => {
  const html = renderApp(fixture({ view: 'import' }));
  const input = html.match(/<input\b(?=[^>]*\bid="diet-file")[^>]*>/u)?.[0];
  assert.ok(input);
  assert.match(input, /type="file"/u);
  assert.match(input, /data-control="diet-file"/u);
  assert.doesNotMatch(input, /\baccept\s*=/iu);
  assert.match(html, /<label for="diet-file"/u);
  assert.match(html, /\.diet/u);
});

test('recipe filters and grouped occurrence counts link to actual calendar entries', () => {
  const model = fixture({ view: 'recipes' });
  const html = renderApp(model);
  for (const control of ['query', 'searchIn', 'type', 'category', 'period']) {
    assert.ok(html.includes(`data-control="recipe-${control}"`));
  }
  assert.match(html, /Da oggi in avanti<\/span><span class="badge">2<\/span>/u);
  assert.match(html, /Date passate<\/span><span class="badge">1<\/span>/u);
  assert.match(html, /Tutte le date<\/span><span class="badge">3<\/span>/u);
  assert.match(html, /data-action="open-recipe-occurrence"[^>]*data-date="2026-10-20"/u);
  assert.match(html, /data-action="open-recipe-occurrence"[^>]*data-date="2026-10-22"/u);
  assert.doesNotMatch(html, /data-date="2026-01-0[123]"/u);
  const filtered = renderRecipeResults({ ...model, recipeFilters: { query: 'alfa', searchIn: 'ingredients' } });
  assert.match(filtered, /class="recipe-ingredient recipe-match"/u);
  const empty = renderRecipeResults({ ...model, recipeFilters: { query: 'missing-synthetic-record' } });
  assert.match(empty, /class="empty-state"/u);
  assert.match(empty, /data-action="clear-recipe-filters"/u);
});

test('English interface keeps original plan text and escaped preparation details in the recipe dialog', () => {
  const model = fixture({ view: 'recipes', language: 'en' });
  const before = structuredClone(model.state.sourcePlans);
  const recipe = buildRecipeIndex(model.state)[0];
  model.dialog = { kind: 'recipe', recipeKey: recipe.key };
  const html = renderApp(model);
  assert.match(html, /class="modal recipe-dialog"/u);
  assert.ok(html.includes(`lang="it">${ESCAPED_TITLE}`));
  assert.match(html, /<ol class="instructions" lang="it"><li>Passaggio &lt;A&gt; &amp; B/u);
  assert.match(html, /class="ingredient-nutrition"/u);
  assert.match(html, /Protein 7 g/u);
  assert.match(html, /Today and upcoming/u);
  assert.doesNotMatch(html, /Voce <Alfa & co>/u);
  assert.deepEqual(model.state.sourcePlans, before);
});

test('descriptive text never creates a workday class and typed labels localize independently', () => {
  const model = fixture({ view: 'calendar', language: 'en' });
  const english = renderApp(model);
  assert.match(english, /data-workday-class="night-shift"/u);
  assert.match(english, /Night shift/u);
  assert.match(english, /Linea A/u);
  model.state.ui.selectedDate = '2026-10-20';
  const unknown = renderApp(model);
  assert.doesNotMatch(unknown, /data-workday-class=/u);
});
