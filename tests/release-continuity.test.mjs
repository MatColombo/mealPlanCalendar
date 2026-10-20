import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createAppState, cloneStateSnapshot } from '../src/data/state.js';
import { prepareImport, reconcileShopping } from '../src/data/imports.js';
import { findEntry, getDayEntries, setEntryDate, setEntryServings, setEntryTime } from '../src/data/session.js';
import { createBackup, readBackup } from '../src/data/backup.js';
import { exportSourceDiet } from '../src/data/export.js';
import { resolveNavigation } from '../src/data/navigation.js';
import {
  addManualItem, getShoppingList, setManualItemChecked,
  setShoppingItemChecked, setShoppingMode, setShoppingRange,
} from '../src/shopping/list.js';
import { createShoppingText } from '../src/ui/shopping-output.js';
import { renderApp } from '../src/ui/render.js';
import { createIndexedDBRepository, defaultDatabaseName } from '../src/persistence/indexeddb.js';
import { loadCompatibleState } from '../src/persistence/migrations.js';
import { commitCandidate } from '../src/persistence/commit.js';
import { createPwaManager } from '../src/pwa/client.js';

const NOW = '2026-10-19T17:00:00.000Z';
const LATER = '2026-10-19T18:00:00.000Z';
const TODAY = '2026-10-23';
const BASE = 'https://example.test/meal-planner/';

// Synthetic amounts carry no nutrition or dietary expectations. Earlier
// suites already establish each mode's arithmetic and checkbox policy; here
// their complete projections must survive a software-release boundary.
function document(planId) {
  return {
    format: 'meal-planner.diet', schemaVersion: 1, planId, title: `Piano italiano ${planId}`,
    language: 'it', createdAt: NOW, suggestedStartDate: '2026-10-21', baseServings: 1,
    extension: { originale: [planId] },
    days: ['2026-10-21', '2026-10-22', '2026-10-23'].map((date, index) => ({
      date,
      meals: [{
        mealId: `${planId}-${index}`, title: `Pasto italiano ${planId} ${index + 1}`,
        type: 'lunch', time: '12:00', instructions: ['Istruzione originale da conservare.'],
        ingredients: [{ ingredientId: 'shared-item', name: 'Ingrediente italiano', quantity: index + 2, unit: 'g', basis: 'raw', category: 'pantry' }],
      }],
    })),
  };
}

function archive() {
  const originals = [document('primo'), document('secondo')];
  let state = createAppState({ now: NOW });
  for (const [index, source] of originals.entries()) {
    state = prepareImport(state, source, {
      startDate: index === 0 ? '2026-10-21' : '2026-10-24', dateConfirmed: true,
      fileName: `${source.planId}.diet`, now: NOW,
    }).state;
  }
  const movedId = getDayEntries(state, '2026-10-22')[0].entry.entryId;
  state = setEntryTime(setEntryServings(state, movedId, 3), movedId, '09:15');
  state = reconcileShopping(setEntryDate(state, movedId, '2026-10-23', { now: LATER }), { now: LATER });
  state = setEntryServings(state, getDayEntries(state, '2026-10-24')[0].entry.entryId, 2);
  state = setShoppingRange(state, { startDate: '2026-10-22', endDate: '2026-10-25' }, { now: LATER });
  state = setShoppingItemChecked(state, getShoppingList(state).rows[0].key, true, { now: NOW });
  state = setShoppingMode(state, 'advanced', { now: LATER });
  state = addManualItem(state, { name: 'Contenitori', quantity: 2, unit: 'box', category: 'other', extension: { absolute: true } }, { itemId: 'containers', now: NOW });
  state = setManualItemChecked(state, 'containers', true, { now: NOW });
  state = addManualItem(state, { name: 'Etichette', quantity: 3, unit: 'unit', category: 'other' }, { itemId: 'labels', now: NOW });
  state.ui = resolveNavigation(state.ui, { view: 'calendar', date: TODAY, today: TODAY }).ui;
  state.settings.reducedMotion = true;
  state.settings.weekStartsOn = 0;
  state.extension = { retained: { acrossReleases: true } };
  return { state, originals, movedId };
}

function allModes(state) {
  return Object.fromEntries(['one', 'two', 'advanced'].map(mode => [
    mode, getShoppingList(setShoppingMode(state, mode, { now: LATER })),
  ]));
}

function englishCalendar(state, pwa) {
  const list = getShoppingList(state);
  return renderApp({
    state, today: TODAY, busy: false, loading: false, dialog: null, notice: null,
    storage: { status: 'ready', hasData: true, hasStoredState: true, recoveryAvailable: true },
    shoppingRows: list.rows, shoppingSummary: list, pwa,
  });
}

class Worker extends EventTarget {
  constructor(version, state = 'activated') { super(); this.version = version; this.state = state; }
  change(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}

/** Only browser lifecycle APIs are simulated; the manager itself is production code. */
function browser() {
  const active = new Worker('previous-release');
  const registration = Object.assign(new EventTarget(), { scope: BASE, active, waiting: null, installing: null });
  const serviceWorker = Object.assign(new EventTarget(), { controller: active });
  const windowObject = Object.assign(new EventTarget(), {
    isSecureContext: true, matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
  });
  const calls = { reloads: 0, messages: [] };
  serviceWorker.getRegistration = async () => registration;
  serviceWorker.register = async () => registration;
  registration.update = async () => {};
  const navigatorObject = {
    onLine: true, serviceWorker, userAgent: '', platform: '', maxTouchPoints: 0,
    storage: { persisted: async () => false, persist: async () => false },
  };
  function activate(worker) {
    registration.active = worker;
    registration.waiting = null;
    registration.installing = null;
    serviceWorker.controller = worker;
    worker.change('activated');
    serviceWorker.dispatchEvent(new Event('controllerchange'));
  }
  return {
    calls, registration, serviceWorker, navigatorObject,
    announce() {
      const worker = new Worker('next-release', 'installing');
      registration.installing = worker;
      registration.dispatchEvent(new Event('updatefound'));
      registration.waiting = worker;
      registration.installing = null;
      worker.change('installed');
      return worker;
    },
    manager(onReload = () => {}) {
      return createPwaManager({
        navigatorObject, windowObject, baseUrl: BASE,
        onReload() { calls.reloads += 1; onReload(); },
        requestMessage: async (worker, message) => {
          calls.messages.push(message.type);
          if (message.type === 'GET_STATUS') return { ready: true, version: worker.version };
          if (message.type === 'APPLY_UPDATE') { activate(worker); return { applied: true, version: worker.version }; }
          throw new Error('Unexpected message in this continuity scenario.');
        },
      });
    },
  };
}

/** Announce the release after a real put succeeds but before its transaction commits. */
function observedDatabase() {
  const native = new IDBFactory();
  const control = { onPut: null, completions: 0 };
  return {
    control,
    indexedDB: {
      open(...args) {
        const request = native.open(...args);
        request.addEventListener('success', () => {
          const database = request.result;
          const transaction = database.transaction.bind(database);
          database.transaction = (...parameters) => {
            const tx = transaction(...parameters);
            if (parameters[1] === 'readwrite') {
              tx.addEventListener('complete', () => { control.completions += 1; });
              const objectStore = tx.objectStore.bind(tx);
              tx.objectStore = (...storeArgs) => {
                const store = objectStore(...storeArgs);
                const put = store.put.bind(store);
                store.put = (value, key) => {
                  const result = put(value, key);
                  result.addEventListener('success', () => {
                    if (key === 'current' && control.onPut) {
                      const callback = control.onPut;
                      control.onPut = null;
                      callback();
                    }
                  });
                  return result;
                };
                return store;
              };
            }
            return tx;
          };
        });
        return request;
      },
    },
  };
}

test('a new release arriving during a commit preserves the full archive, three shopping projections and English UI over Italian sources after offline reopening', async t => {
  const { indexedDB, control } = observedDatabase();
  const name = defaultDatabaseName(BASE);
  let repository = createIndexedDBRepository({ indexedDB, name });
  t.after(() => repository.close());
  await loadCompatibleState(repository);
  const { state, originals, movedId } = archive();
  let visible = await commitCandidate(repository, state);
  const priorRecovery = cloneStateSnapshot(visible);
  const english = cloneStateSnapshot(visible);
  english.settings.uiLanguage = 'en';
  visible = await commitCandidate(repository, english, { checkpoint: true });
  const browserApis = browser();
  const manager = browserApis.manager(() => repository.close());
  t.after(() => manager.destroy());
  await manager.start();
  const completedBefore = control.completions;
  control.onPut = () => {
    assert.equal(control.completions, completedBefore);
    browserApis.announce();
    assert.equal(browserApis.calls.reloads, 0);
  };
  visible = await commitCandidate(repository, setManualItemChecked(visible, 'labels', true, { now: LATER }));
  assert.equal(control.completions, completedBefore + 1);
  await manager.refresh();
  assert.equal(manager.getState().updateAvailable, true);
  assert.equal(browserApis.calls.reloads, 0);
  assert.equal(browserApis.calls.messages.includes('APPLY_UPDATE'), false);
  const beforeRelease = cloneStateSnapshot(visible);
  const shoppingBefore = allModes(visible);
  const backupBefore = createBackup(visible, { now: LATER });
  assert.equal(await manager.applyUpdate(), true);
  assert.equal(browserApis.calls.reloads, 1);
  manager.destroy();

  browserApis.navigatorObject.onLine = false;
  browserApis.serviceWorker.register = async () => { throw new Error('Offline registration attempt'); };
  const reopenedManager = browserApis.manager();
  t.after(() => reopenedManager.destroy());
  repository = createIndexedDBRepository({ indexedDB, name });
  visible = await loadCompatibleState(repository);
  await reopenedManager.start();
  assert.equal(reopenedManager.getState().version, 'next-release');
  assert.equal(reopenedManager.getState().online, false);
  assert.equal(reopenedManager.getState().status, 'ready');
  assert.equal(reopenedManager.getState().persistence, 'not-granted');
  assert.deepEqual(visible, beforeRelease);
  assert.deepEqual(await repository.loadRecovery(), priorRecovery);
  assert.deepEqual(createBackup(visible, { now: LATER }), backupBefore);
  assert.deepEqual(allModes(visible), shoppingBefore);
  assert.equal(findEntry(visible, movedId).time, '09:15');
  assert.deepEqual(Object.keys(visible.sourcePlans).map(sourceId => exportSourceDiet(visible, sourceId)), originals);
  const html = englishCalendar(visible, reopenedManager.getState());
  assert.match(html, /<option value="en" selected>/u);
  assert.match(html, />Calendar</u);
  assert.ok(html.includes(findEntry(visible, movedId).meal.title));
  assert.match(createShoppingText(getShoppingList(visible), 'en'), /Ingrediente italiano/u);
  assert.equal(control.completions, completedBefore + 1);
});

test('an offline update check can remain pending and fail while a complete local backup restore commits and survives reopening', async t => {
  const indexedDB = new IDBFactory();
  const name = defaultDatabaseName(BASE);
  let repository = createIndexedDBRepository({ indexedDB, name });
  t.after(() => repository.close());
  await loadCompatibleState(repository);
  const existing = addManualItem(createAppState({ now: NOW }), {
    name: 'Archivio precedente', quantity: 4, unit: 'unit',
  }, { itemId: 'previous', now: NOW });
  await commitCandidate(repository, existing);
  const { state: incoming, originals } = archive();
  incoming.settings.uiLanguage = 'en';
  const backup = JSON.stringify(createBackup(incoming, { now: LATER }));
  const expected = cloneStateSnapshot(incoming);
  const browserApis = browser();
  browserApis.navigatorObject.onLine = false;
  browserApis.serviceWorker.register = async () => { throw new Error('No network'); };
  const manager = browserApis.manager(() => repository.close());
  t.after(() => manager.destroy());
  await manager.start();
  let rejectUpdate;
  let began;
  const started = new Promise(resolve => { began = resolve; });
  browserApis.registration.update = () => new Promise((resolve, reject) => { rejectUpdate = reject; began(); });
  let checked = false;
  const checking = manager.checkForUpdate().then(result => { checked = true; return result; });
  await started;
  let visible = await commitCandidate(repository, readBackup(backup), { checkpoint: true });
  assert.equal(checked, false);
  assert.deepEqual(visible, expected);
  assert.deepEqual(await repository.loadRecovery(), existing);
  rejectUpdate(new Error('Update server unavailable'));
  assert.deepEqual(await checking, { checked: false, available: false });
  assert.equal(manager.getState().status, 'ready');
  assert.equal(browserApis.calls.reloads, 0);
  repository.close();

  repository = createIndexedDBRepository({ indexedDB, name });
  visible = await loadCompatibleState(repository);
  assert.deepEqual(visible, expected);
  assert.deepEqual(allModes(visible), allModes(expected));
  assert.deepEqual(readBackup(JSON.stringify(createBackup(visible, { now: LATER }))), expected);
  assert.deepEqual(await repository.loadRecovery(), existing);
  assert.deepEqual(Object.keys(visible.sourcePlans).map(sourceId => exportSourceDiet(visible, sourceId)), originals);
  assert.equal(visible.settings.uiLanguage, 'en');
  assert.equal(visible.shopping.manualItems.find(item => item.itemId === 'containers').checked, true);
  assert.equal(visible.shopping.manualItems.find(item => item.itemId === 'labels').checked, false);
});
