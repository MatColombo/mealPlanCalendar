import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAppState } from '../src/data/state.js';
import { applySessionImport, getDayEntries, getShoppingEntries, setEntryServings, setEntryDate } from '../src/data/session.js';
import { validateAppState } from '../src/data/validation.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { createMemoryRepository } from '../src/persistence/repository.js';
import { getShoppingList, setShoppingExcludedMealTypes, setShoppingRange, setShoppingMode, setShoppingItemChecked, addManualItem, setManualItemChecked } from '../src/shopping/list.js';
import { ingredientCategory } from '../src/shopping/categories.js';
import { groupShoppingItems, createShoppingText } from '../src/ui/shopping-output.js';
import { buildRecipeIndex, searchIngredients, searchRecipes } from '../src/data/recipes.js';
import { renderApp } from '../src/ui/render.js';
import { renderRecipeResults } from '../src/ui/recipes-view.js';

const NOW = '2026-10-21T10:00:00.000Z';
const TODAY = '2026-10-22';
// Synthetic records and amounts test software only; no dietary recommendations.
function fixture() {
  const shared = quantity => ({ ingredientId: 'apple', name: 'Mela dimostrativa', quantity, unit: 'g', basis: 'raw' });
  const meal = (id, type, amount, time) => ({ mealId: id, type, time, title: 'Record ' + id,
    recipeId: id, prepMinutes: 8, instructions: ['Passaggio dimostrativo'], ingredients: [shared(amount)] });
  const document = { format: 'meal-planner.diet', schemaVersion: 1, planId: 'ui-v12-synthetic',
    title: 'Dati dimostrativi', language: 'it', createdAt: NOW, suggestedStartDate: TODAY, baseServings: 1,
    days: [{ date: TODAY, meals: [meal('b','breakfast',10,'08:00'), meal('s','snack',20,'10:00'), meal('l','lunch',30,'13:00')] },
      { date: '2026-10-23', meals: [meal('d','dinner',40,'20:00')] }] };
  let { state } = applySessionImport(createAppState({now: NOW}), document, {startDate: TODAY, now: NOW});
  const entries = getDayEntries(state, TODAY);
  state = setEntryServings(state, entries[0].entry.entryId, 2);
  state = setEntryServings(state, entries[1].entry.entryId, 3);
  state = setEntryServings(state, entries[2].entry.entryId, 4);
  state = setShoppingRange(state,{startDate:TODAY,endDate:'2026-10-23'},{now:NOW});
  state.ui = {view:'shopping', selectedDate:TODAY};
  return state;
}
const modelFor = state => ({state,today:TODAY,loading:false,busy:false,storage:{status:'ready'},recipeFilters:{},dialog:null});

test('exclusions filter scheduled meal types, not globally shared ingredient IDs, in all modes', () => {
  const state = fixture(), before = structuredClone(state);
  const cases = [ [[],[100,200,240],4], [['breakfast'],[90,180,220],3], [['snack'],[80,160,180],3], [['snack','breakfast'],[70,140,160],2] ];
  for (const [types, amounts, count] of cases) for (const [index,mode] of ['one','two','advanced'].entries()) {
    const next = setShoppingMode(setShoppingExcludedMealTypes(state,types,{now:NOW}),mode,{now:NOW});
    const list = getShoppingList(next);
    assert.equal(list.rows[0].quantity,amounts[index]);
    assert.equal(list.rows[0].ingredientId,'apple');
    assert.equal(list.mealCount,count);
    assert.deepEqual(next.calendar,state.calendar);
    assert.deepEqual(next.sourcePlans,state.sourcePlans);
  }
  assert.deepEqual(state,before);
});

test('range boundaries and moved meals are respected together with exclusions', () => {
  let state = setShoppingExcludedMealTypes(fixture(),['breakfast','snack'],{now:NOW});
  state = setShoppingRange(state,{startDate:TODAY,endDate:TODAY},{now:NOW});
  assert.equal(getShoppingList(state).rows[0].quantity,30);
  const id = getDayEntries(state,TODAY).find(item=>item.meal.type==='lunch').entry.entryId;
  state = setEntryDate(state,id,'2026-10-24',{now:NOW});
  assert.equal(getShoppingList(state).rows.length,0);
  state = setShoppingRange(state,{startDate:'2026-10-23',endDate:'2026-10-24'},{now:NOW});
  assert.equal(getShoppingList(state).rows[0].quantity,70);
  assert.equal(getShoppingEntries(state).length,2);
});

test('manual amounts and checks survive every exclusion/mode combination', () => {
  let state = addManualItem(fixture(),{name:'Sacchetti demo',quantity:2,unit:'unit',category:'pantry'},{itemId:'manual-demo',now:NOW});
  state = setManualItemChecked(state,'manual-demo',true,{now:NOW});
  for (const types of [[],['snack'],['breakfast'],['snack','breakfast']]) for (const mode of ['one','two','advanced']) {
    const next = setShoppingMode(setShoppingExcludedMealTypes(state,types,{now:NOW}),mode,{now:NOW});
    assert.deepEqual(next.shopping.manualItems,state.shopping.manualItems);
    assert.equal(getShoppingList(next).manualItems[0].quantity,2);
    assert.equal(getShoppingList(next).manualItems[0].checked,true);
  }
});

test('re-including meals reopens acquired quantities instead of hiding increases', () => {
  let state = setShoppingExcludedMealTypes(fixture(),['snack','breakfast'],{now:NOW});
  const key = getShoppingList(state).rows[0].key;
  state = setShoppingItemChecked(state,key,true,{now:NOW});
  assert.equal(getShoppingList(state).rows[0].quantity,70);
  state = setShoppingExcludedMealTypes(state,[],{now:NOW});
  const row = getShoppingList(state).rows[0];
  assert.equal(row.quantity,100); assert.equal(row.previousQuantity,70);
  assert.equal(row.checked,false); assert.equal(row.reopened,true);
});

test('filters round-trip through the v1 backup and memory adapter; legacy states include all meals', async () => {
  const state = setShoppingExcludedMealTypes(fixture(),['snack','breakfast'],{now:NOW});
  validateAppState(state);
  const repo = createMemoryRepository();
  await repo.save(state);
  const loaded = await repo.load();
  assert.deepEqual(loaded.shopping.excludedMealTypes,['breakfast','snack']);
  const restored = readBackup(JSON.stringify(createBackup(loaded,{now:NOW})));
  assert.deepEqual(restored,state);
  const legacy = structuredClone(state); delete legacy.shopping.excludedMealTypes;
  validateAppState(legacy);
  assert.equal(getShoppingList(readBackup(JSON.stringify(createBackup(legacy,{now:NOW})))).mealCount,4);
});

test('only supported exclusion codes are accepted, with no partial mutation', () => {
  const state=fixture(),before=structuredClone(state);
  for (const value of [null,'breakfast',['lunch'],[1]]) assert.throws(()=>setShoppingExcludedMealTypes(state,value),{code:'SHOPPING_INVALID_EXCLUSIONS'});
  const next = setShoppingExcludedMealTypes(state,['snack','snack']);
  assert.deepEqual(next.shopping.excludedMealTypes,['snack']);
  const invalid = structuredClone(state);invalid.shopping.excludedMealTypes=['dinner'];
  assert.throws(()=>validateAppState(invalid));
  assert.deepEqual(state,before);
});

test('explicit categories win; offline ID fallback does not change source items or merge bases', () => {
  assert.equal(ingredientCategory({ingredientId:'apple'}),'produce');
  assert.equal(ingredientCategory({ingredientId:'apple',category:'custom'}),'custom');
  assert.equal(ingredientCategory({ingredientId:'apple',category:'other'}),'other');
  assert.equal(ingredientCategory({ingredientId:'unknown-record',name:'Mela'}),'other');
  const rows=[{ingredientId:'apple',name:'Mela',quantity:3,unit:'g',basis:'raw'},
    {ingredientId:'apple',name:'Mela',quantity:1,unit:'unit',basis:'cooked'},
    {ingredientId:'milk',name:'Latte',quantity:2,unit:'ml'},
    {ingredientId:'unknown-record',name:'Voce',quantity:1,unit:'unit'}];
  const before=structuredClone(rows), groups=groupShoppingItems(rows,'it');
  assert.deepEqual(groups.map(g=>g.category),['produce','dairy','other']);
  assert.equal(groups[0].items.length,2);
  assert.deepEqual(rows,before);
});

test('export labels the filtered calculation in both interface languages without translating item names', () => {
  const list=getShoppingList(setShoppingExcludedMealTypes(fixture(),['breakfast','snack']));
  const it=createShoppingText(list,'it'), en=createShoppingText(list,'en');
  assert.match(it,/Pasti esclusi/); assert.match(it,/Colazione/); assert.match(it,/Spuntino/);
  assert.match(en,/Excluded meals/); assert.match(en,/Breakfast/); assert.match(en,/Snack/);
  assert.match(it,/Frutta e verdura/); assert.ok(en.includes('Mela dimostrativa'));
});

test('ingredient-first index groups exact IDs and links scheduled meal titles, without duplicate occurrences', () => {
  const state=fixture(), before=structuredClone(state), index=buildRecipeIndex(state);
  const [ingredient]=searchIngredients(index,{query:'mela',searchIn:'ingredients'},'2026-10-23');
  assert.equal(ingredient.ingredientId,'apple'); assert.equal(ingredient.recipes.length,4);
  assert.equal(ingredient.occurrences.length,4);
  assert.equal(new Set(ingredient.occurrences.map(item=>item.entryId)).size,4);
  assert.ok(ingredient.occurrences.every(item=>item.title.startsWith('Record ')));
  const onlyLunch=searchIngredients(index,{query:'mela',searchIn:'ingredients',type:'lunch'},TODAY);
  assert.equal(onlyLunch[0].occurrences.length,1);
  assert.equal(searchIngredients(index,{query:'mela',searchIn:'recipes'},TODAY).length,0);
  assert.equal(searchRecipes(index,{query:'mela',searchIn:'ingredients',ingredientId:'wrong-id'},TODAY).length,0);
  assert.deepEqual(state,before);
});

test('unassigned recipes do not invent ingredient dates; multiword ingredient search stays within an item', () => {
  const state=fixture(); state.calendar={};
  const index=buildRecipeIndex(state);
  const groups=searchIngredients(index,{query:'mela',searchIn:'ingredients',period:'unscheduled'},TODAY);
  assert.equal(groups[0].occurrences.length,0);
  const multi=[{...index[0],meal:{...index[0].meal,ingredients:[{ingredientId:'green',name:'Verde'},{ingredientId:'bean',name:'Fagiolo'}]}}];
  assert.equal(searchRecipes(multi,{query:'verde fagiolo',searchIn:'ingredients'},TODAY).length,0);
});

test('ingredient sections precede recipes; toolbar contains settings and header excludes import/export', () => {
  const state=fixture(),model=modelFor(state); model.recipeFilters={query:'mela',searchIn:'ingredients'};
  const results=renderRecipeResults(model);
  assert.ok(results.indexOf('ingredient-search-results')<results.indexOf('recipe-search-results'));
  assert.match(results,/data-ingredient-result="apple"/);
  assert.match(results,/Record l/);
  const html=renderApp(model), header=html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.match(header,/data-view="settings"/);
  assert.doesNotMatch(header,/data-view="(?:import|export)"/);
  assert.doesNotMatch(header,/header-actions|language-control/);
  const settings=renderApp({...model,state:{...state,ui:{...state.ui,view:'settings'}}});
  assert.match(settings,/class="panel settings-tools"/);
  assert.match(settings,/data-view="import"/);assert.match(settings,/data-view="export"/);
});

test('shopping sections include persisted exclusions and manual rows only once; cards use the compact hierarchy', async () => {
  let state=setShoppingExcludedMealTypes(fixture(),['breakfast']);
  state=addManualItem(state,{name:'Demo sacchetto',quantity:2,unit:'unit',category:'pantry'},{itemId:'unique-manual',now:NOW});
  const html=renderApp(modelFor(state));
  assert.match(html,/id="exclude-breakfast"[^>]*checked/);
  assert.match(html,/id="shopping-categories"/); assert.match(html,/category-items/);
  assert.equal((html.match(/data-control="manual-check"/g)||[]).length,1);
  const today=renderApp(modelFor({...state,ui:{...state.ui,view:'today'}}));
  assert.match(today,/class="meal-side"/);assert.match(today,/meal-inline-detail/);
  assert.match(today,/today-meal-list/);assert.doesNotMatch(today,/class="meal-list meal-carousel"/);
  for (const label of ['P:','G:','C:']) assert.ok(today.includes(label));
  const css=await readFile(new URL('../src/ui/compact.css',import.meta.url),'utf8');
  assert.match(css,/scroll-snap-type:\s*x/);assert.match(css,/data-view="today"/);
  const motion=await readFile(new URL('../src/ui/motion.js',import.meta.url),'utf8');
  assert.match(motion,/data-view="today"/);
});
