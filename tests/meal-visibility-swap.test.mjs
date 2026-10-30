import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../src/data/state.js';
import { applySessionImport, getDayEntries, setEntryHidden, swapEntries, setEntryServings } from '../src/data/session.js';
import { setShoppingRange, setShoppingMode, getShoppingList } from '../src/shopping/list.js';
import { summarizeNutrition } from '../src/data/nutrition.js';
import { createBackup, readBackup } from '../src/data/backup.js';

const NOW = '2026-10-30T18:00:00.000Z';
const A = '2026-11-01';
const B = '2026-11-02';
const ingredient = (id, quantity) => ({ ingredientId:id, name:id, quantity, unit:'g', basis:'raw', category:'produce' });
const meal = (id, time, kcal, protein, quantity) => ({ mealId:id, type:'lunch', title:id, time,
  nutrition:{kcal, proteinG:protein, fatG:10, carbohydratesG:20}, ingredients:[ingredient(id, quantity)] });
const document = { format:'meal-planner.diet', schemaVersion:1, planId:'visibility-swap', title:'Visibility swap', language:'en',
  createdAt:NOW, suggestedStartDate:A, baseServings:1,
  days:[{date:A, meals:[meal('alpha','12:00',300,30,100)]},{date:B, meals:[meal('beta','19:00',500,40,200)]}] };

function fixture() {
  let { state } = applySessionImport(createAppState({now:NOW}), document, {startDate:A, now:NOW});
  state = setShoppingRange(state,{startDate:A,endDate:B},{now:NOW});
  return state;
}

test('hidden occurrence is omitted from personal day totals and only Advanced shopping removes its ingredients', () => {
  let state = fixture();
  const alpha = getDayEntries(state,A)[0];
  state = setEntryServings(state, alpha.entry.entryId, 3);
  state = setEntryHidden(state, alpha.entry.entryId, true, {now:NOW});
  const visibleMeals = getDayEntries(state,A).filter(row=>row.entry.hidden!==true).map(row=>row.meal);
  assert.equal(summarizeNutrition(visibleMeals).metrics.kcal.value, null);
  assert.equal(getDayEntries(state,A)[0].entry.hidden, true);
  state = setShoppingMode(state,'one',{now:NOW});
  assert.equal(getShoppingList(state).mealCount,2);
  assert.equal(getShoppingList(state).rows.reduce((n,row)=>n+row.quantity,0),300);
  state = setShoppingMode(state,'advanced',{now:NOW});
  assert.equal(getShoppingList(state).mealCount,1);
  assert.equal(getShoppingList(state).rows.reduce((n,row)=>n+row.quantity,0),200);
  const restored = readBackup(JSON.stringify(createBackup(state,{now:NOW})));
  assert.equal(getDayEntries(restored,A)[0].entry.hidden,true);
  assert.equal(getDayEntries(restored,A)[0].cookingServings,3);
});

test('swapping two meals exchanges effective date/time but preserves source identity, people and occurrence metadata', () => {
  let state = fixture();
  const alpha = getDayEntries(state,A)[0];
  const beta = getDayEntries(state,B)[0];
  state = setEntryServings(state, alpha.entry.entryId, 2);
  state = setEntryHidden(state, beta.entry.entryId, true, {now:NOW});
  const sourcesBefore = structuredClone(state.sourcePlans);
  const swapped = swapEntries(state, alpha.entry.entryId, beta.entry.entryId, {now:NOW});
  const alphaAfter = getDayEntries(swapped,B).find(row=>row.entry.entryId===alpha.entry.entryId);
  const betaAfter = getDayEntries(swapped,A).find(row=>row.entry.entryId===beta.entry.entryId);
  assert.equal(alphaAfter.time,'19:00');
  assert.equal(betaAfter.time,'12:00');
  assert.equal(alphaAfter.cookingServings,2);
  assert.equal(betaAfter.entry.hidden,true);
  assert.equal(alphaAfter.meal.mealId,'alpha');
  assert.equal(betaAfter.meal.mealId,'beta');
  assert.deepEqual(swapped.sourcePlans,sourcesBefore);
  assert.deepEqual(state.sourcePlans,sourcesBefore);
});

test('same-day swap exchanges effective times without changing the day or hiding metadata', () => {
  let state = fixture();
  const beta = getDayEntries(state,B)[0];
  // move beta next to alpha first, then swap slots on the same date
  state.calendar[A].meals.push(state.calendar[B].meals[0]);
  state.calendar[B].meals=[];
  const rows = getDayEntries(state,A);
  const alpha = rows.find(row=>row.meal.mealId==='alpha');
  const betaSame = rows.find(row=>row.meal.mealId==='beta');
  const swapped = swapEntries(state,alpha.entry.entryId,betaSame.entry.entryId,{now:NOW});
  assert.equal(getDayEntries(swapped,A).find(row=>row.meal.mealId==='alpha').time,'19:00');
  assert.equal(getDayEntries(swapped,A).find(row=>row.meal.mealId==='beta').time,'12:00');
  assert.equal(getDayEntries(swapped,A).length,2);
});
