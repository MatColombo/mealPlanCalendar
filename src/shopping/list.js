/**
 * Pure shopping-list interactions and a display snapshot. Generated checks
 * belong to the selected period; manual entries are independent, absolute
 * quantities. No operation changes source plans or calendar multipliers.
 */
import { addDays } from '../data/dates.js';
import { getShoppingEntries, getShoppingItems } from '../data/session.js';
import { cloneStateSnapshot, timestampFor } from '../data/state.js';

function shoppingError(code, message) {
  return Object.assign(new Error(message), { code });
}

function assertChecked(checked) {
  if (typeof checked !== 'boolean') {
    throw shoppingError('SHOPPING_INVALID_CHECK', 'A shopping check must be a boolean.');
  }
}

function assertRange(range) {
  for (const value of [range?.startDate, range?.endDate]) {
    if (value === null) continue;
    try { addDays(value, 0); }
    catch { throw shoppingError('SESSION_INVALID_DATE', 'Expected a valid calendar date or null.'); }
  }
  if (range.startDate !== null && range.endDate !== null && range.startDate > range.endDate) {
    throw shoppingError('SESSION_INVALID_RANGE', 'The range must end on or after its start date.');
  }
}

/** Ignore only a few relative floating-point rounding units, never a fixed amount. */
function quantityIncreased(current, previous) {
  const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(current), Math.abs(previous));
  return current > previous && current - previous > tolerance;
}

function savedCheck(state, key) {
  return Object.hasOwn(state.shopping.checked, key) ? state.shopping.checked[key] : null;
}

function checkStatus(row, saved) {
  const previousQuantity = typeof saved?.quantity === 'number' && Number.isFinite(saved.quantity)
    ? saved.quantity : null;
  const comparable = Boolean(row && previousQuantity !== null && row.unit === saved.unit);
  const increased = comparable && quantityIncreased(row.quantity, previousQuantity);
  return {
    checked: Boolean(saved?.checked && comparable && !increased),
    reopened: Boolean(increased && (saved?.checked || saved?.reopened === true)),
    previousQuantity,
  };
}

/**
 * A nonmutating, isolated view of the current requirements. A legacy stored
 * check with an insufficient quantity is shown as open before any save occurs.
 * Counts include manual entries; reopenedCount concerns generated rows only.
 */
export function getShoppingList(state) {
  const rows = getShoppingItems(state).map(row => ({
    ...row,
    ...checkStatus(row, savedCheck(state, row.key)),
  }));
  const manualItems = structuredClone(state.shopping.manualItems);
  const range = structuredClone(state.shopping.range);
  const mealCount = range.startDate === null || range.endDate === null
    ? 0 : getShoppingEntries(state).length;
  return {
    rows,
    manualItems,
    mode: state.shopping.mode,
    excludedMealTypes: [...(state.shopping.excludedMealTypes || [])],
    range,
    mealCount,
    generatedCount: rows.length,
    manualCount: manualItems.length,
    checkedCount: rows.filter(row => row.checked).length + manualItems.filter(item => item.checked).length,
    totalCount: rows.length + manualItems.length,
    reopenedCount: rows.filter(row => row.reopened).length,
  };
}

function writeCheck(state, key, value) {
  Object.defineProperty(state.shopping.checked, key, {
    value, enumerable: true, writable: true, configurable: true,
  });
}

function updateCheck(state, key, saved, { checked, reopened }, timestamp) {
  const hasReopened = Object.hasOwn(saved, 'reopened');
  if (saved.checked === checked
    && (reopened ? saved.reopened === true : !hasReopened)) return;
  const next = { ...saved, checked, updatedAt: timestamp };
  if (reopened) next.reopened = true;
  else delete next.reopened;
  writeCheck(state, key, next);
}

function reconcileSnapshot(state, timestamp) {
  const rows = new Map(getShoppingItems(state).map(row => [row.key, row]));
  for (const [key, saved] of Object.entries(state.shopping.checked)) {
    const row = rows.get(key);
    const status = checkStatus(row, saved);
    // A smaller requirement hides the badge without discarding its unconfirmed
    // baseline. If the requirement rises again, the badge can reappear.
    if (row && row.unit === saved.unit && saved.checked === false && saved.reopened === true) {
      status.reopened = true;
    }
    updateCheck(state, key, saved, status, timestamp);
  }
  return state;
}

/**
 * Keep the last explicitly checked quantity as a baseline. Increases reopen
 * a check and retain reopened:true for an explanatory badge. A disappearance
 * or incomparable unit leaves an unchecked historical record with no badge.
 * Reductions hide the badge but retain its marker until an explicit choice;
 * they never automatically re-check a row that was already reopened.
 * This helper does not stamp meta.updatedAt: its surrounding operation does.
 */
export function reconcileShoppingChecks(state, { now } = {}) {
  return reconcileSnapshot(cloneStateSnapshot(state), timestampFor(now));
}

/** A genuinely new period starts a fresh generated checklist; manual checks survive. */
export function setShoppingRange(state, range, { now } = {}) {
  assertRange(range);
  const changed = state.shopping.range.startDate !== range.startDate
    || state.shopping.range.endDate !== range.endDate;
  const next = cloneStateSnapshot(state);
  const timestamp = timestampFor(now);
  next.shopping.range = {
    ...next.shopping.range, startDate: range.startDate, endDate: range.endDate,
  };
  if (changed) {
    for (const [key, saved] of Object.entries(next.shopping.checked)) {
      updateCheck(next, key, saved, { checked: false, reopened: false }, timestamp);
    }
  }
  reconcileSnapshot(next, timestamp);
  next.meta.updatedAt = timestamp;
  return next;
}

/** Mode changes derive quantities only; per-meal people and manual amounts stay unchanged. */
export function setShoppingMode(state, mode, { now } = {}) {
  if (!['one', 'two', 'advanced'].includes(mode)) {
    throw shoppingError('SESSION_INVALID_SHOPPING_MODE', 'Unknown shopping calculation mode.');
  }
  const next = cloneStateSnapshot(state);
  const timestamp = timestampFor(now);
  next.shopping.mode = mode;
  reconcileSnapshot(next, timestamp);
  next.meta.updatedAt = timestamp;
  return next;
}

/** An explicit check/uncheck adopts today's requirement and clears any automatic badge. */
export function setShoppingItemChecked(state, key, checked, { now } = {}) {
  assertChecked(checked);
  const row = getShoppingItems(state).find(item => item.key === key);
  if (!row) throw shoppingError('SHOPPING_ITEM_NOT_FOUND', 'The generated shopping item is no longer in this period.');
  const next = cloneStateSnapshot(state);
  const timestamp = timestampFor(now);
  const updated = {
    ...savedCheck(next, key), checked, quantity: row.quantity, unit: row.unit, updatedAt: timestamp,
  };
  delete updated.reopened;
  writeCheck(next, key, updated);
  next.meta.updatedAt = timestamp;
  return next;
}

function newManualId(state) {
  let id;
  do {
    const suffix = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    id = `manual-${suffix}`;
  } while (state.shopping.manualItems.some(item => item.itemId === id));
  return id;
}

/** New manual quantities are explicit and absolute; repeated names remain distinct items. */
export function addManualItem(state, item, { itemId, now } = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)
    || typeof item.name !== 'string' || item.name.trim().length === 0) {
    throw shoppingError('SHOPPING_INVALID_ITEM', 'A manual item needs a nonempty name.');
  }
  if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw shoppingError('SHOPPING_INVALID_QUANTITY', 'A manual quantity must be a positive finite number.');
  }
  if (['unit', 'category'].some(key => item[key] !== undefined && typeof item[key] !== 'string')
    || (item.unit !== undefined && item.unit.trim().length === 0)) {
    throw shoppingError('SHOPPING_INVALID_ITEM', 'A manual unit or category must be text.');
  }
  const resolvedId = itemId ?? newManualId(state);
  if (typeof resolvedId !== 'string' || resolvedId.length === 0) {
    throw shoppingError('SHOPPING_INVALID_ITEM', 'A manual item identifier must be nonempty text.');
  }
  if (state.shopping.manualItems.some(item => item.itemId === resolvedId)) {
    throw shoppingError('SHOPPING_DUPLICATE_ITEM', 'The manual item identifier already exists.');
  }
  const next = cloneStateSnapshot(state);
  const added = { ...structuredClone(item), itemId: resolvedId, name: item.name.trim(), checked: false };
  if (added.category === undefined) delete added.category;
  if (added.unit === undefined) added.unit = 'unit';
  next.shopping.manualItems.push(added);
  next.meta.updatedAt = timestampFor(now);
  return next;
}

function requireManualItem(state, itemId) {
  const item = state.shopping.manualItems.find(item => item.itemId === itemId);
  if (!item) throw shoppingError('SHOPPING_ITEM_NOT_FOUND', 'The manual shopping item is no longer available.');
  return item;
}

export function setManualItemChecked(state, itemId, checked, { now } = {}) {
  assertChecked(checked);
  requireManualItem(state, itemId);
  const next = cloneStateSnapshot(state);
  requireManualItem(next, itemId).checked = checked;
  next.meta.updatedAt = timestampFor(now);
  return next;
}

export function removeManualItem(state, itemId, { now } = {}) {
  requireManualItem(state, itemId);
  const next = cloneStateSnapshot(state);
  next.shopping.manualItems = next.shopping.manualItems.filter(item => item.itemId !== itemId);
  next.meta.updatedAt = timestampFor(now);
  return next;
}

/** Persist filters with the existing atomic save path and reconcile acquired quantities. */
export function setShoppingExcludedMealTypes(state, types, { now } = {}) {
  if (!Array.isArray(types) || types.some(type => !['breakfast', 'snack'].includes(type))) {
    throw shoppingError('SHOPPING_INVALID_EXCLUSIONS', 'Only breakfast and snack exclusions are supported.');
  }
  const next = cloneStateSnapshot(state);
  const timestamp = timestampFor(now);
  next.shopping.excludedMealTypes = ['breakfast', 'snack'].filter(type => types.includes(type));
  reconcileSnapshot(next, timestamp);
  next.meta.updatedAt = timestamp;
  return next;
}
