import { readDietDocument } from './data/diet.js';
import { createAppState, cloneStateSnapshot } from './data/state.js';
import { createBackup, readBackup } from './data/backup.js';
import { addDays, todayISO } from './data/dates.js';
import { DEMO_DOCUMENT_URL } from './data/demo.js';
import { previewImport, prepareImport, previewUndoImport, undoLastImport, reconcileShopping } from './data/imports.js';
import { exportCalendarDiet, exportSourceDiet } from './data/export.js';
import { findEntry, getRangeEntries, setEntryDate, setEntryServings, setEntryTime } from './data/session.js';
import { resolveNavigation, resolveRoute, getSelectedCalendarDate } from './data/navigation.js';
import { createIndexedDBRepository, readStoredBackup } from './persistence/indexeddb.js';
import { loadCompatibleState } from './persistence/migrations.js';
import { commitCandidate } from './persistence/commit.js';
import { getShoppingList, setShoppingRange, setShoppingMode, setShoppingItemChecked,
  addManualItem, setManualItemChecked, removeManualItem } from './shopping/list.js';
import { renderApp, renderMealMoveFeedback, renderPwaStatus, renderPwaSettings } from './ui/render.js';
import { t, formatDate } from './ui/i18n.js';
import { createShoppingText, shoppingTextFileName } from './ui/shopping-output.js';
import { createPwaManager } from './pwa/client.js';
import { createMotionController } from './ui/motion.js';
import { DEFAULT_RECIPE_FILTERS } from './data/recipes.js';
import { renderRecipeResults } from './ui/recipes-view.js';

const root = document.querySelector('#app');
const motion = createMotionController({ root });
const today = todayISO();
const model = {
  state: createAppState({ uiLanguage: 'it' }), today,
  loading: true, error: null, dialog: null, importDraft: null, backupDraft: null,
  exportSourceId: null, exportRange: { startDate: null, endDate: null },
  exportPreview: null, exportError: null, undoPreview: null, currentSummary: null,
  notice: null, busy: false, viewSaving: false,
  storage: { status: 'loading', errorKey: null, hasData: false, hasStoredState: false,
    recoveryAvailable: false, rawBackupAvailable: false },
  manualDraft: { name: '', quantity: '', unit: 'unit', customUnit: '', category: 'other' },
  mealMoveDraft: null,
  recipeFilters: { ...DEFAULT_RECIPE_FILTERS },
  shoppingRows: [], shoppingSummary: null, shoppingError: null, shoppingCopyText: '', shoppingCopyFileName: '',
  pwa: null, rawBackup: null,
};
let repository;
let storageGeneration = 0;
let connectionHealthy = false;
let demoDocument;
let dialogOpener = null;
let activeFileRead = 0;
let activeShoppingCopy = 0;
let lastViewKey = null;
let lastDialogKey = null;
let routeRevision = 0;
let savedUi = null;
let viewSaveTimer = null;
let viewSavePromise = null;
let activeWrite = null;
const pendingServings = new Map();
let servingsWriteActive = false;

const storageKeys = {
  STORAGE_UNAVAILABLE: 'unavailable', STORAGE_OPEN: 'unavailable',
  STORAGE_BLOCKED: 'blocked', STORAGE_VERSION: 'version',
  STORAGE_NOT_LOADED: 'read', STORAGE_READ: 'read', STORAGE_WRITE: 'write',
  STORAGE_QUOTA: 'quota', STORAGE_ABORT: 'abort', STORAGE_CONFLICT: 'conflict',
  STORAGE_CLOSED: 'closed', STATE_INVALID_STATE: 'invalidState',
  STATE_UNSUPPORTED_VERSION: 'version',
  STATE_MIGRATION_REQUIRED: 'version', STATE_MIGRATION_INVALID: 'migration',
  STATE_MIGRATION_GAP: 'migration', STATE_MIGRATION_FAILED: 'migration',
};

/** Background capability changes never replace a meal, import or shopping form. */
function refreshPwaParts() {
  const active = document.activeElement;
  const focus = focusLocator(active);
  let replacedFocus = false;
  for (const [selector, renderer] of [
    ['[data-pwa-status]', renderPwaStatus], ['[data-pwa-settings]', renderPwaSettings],
  ]) {
    const slot = root.querySelector(selector);
    if (!slot) continue;
    if (slot.contains(active)) replacedFocus = true;
    slot.innerHTML = renderer(model);
  }
  if (replacedFocus && focus) root.querySelector(focus)?.focus({ preventScroll: true });
  const apply = root.querySelector('[data-action="apply-app-update"]');
  if (apply) {
    const working = model.busy || ['loading', 'saving'].includes(model.storage.status);
    apply.disabled = working || model.pwa.updating || !model.pwa.updateAvailable;
    const label = apply.querySelector('span');
    if (label) label.textContent = t(model.state.settings.uiLanguage,
      model.pwa.updating ? 'pwa.updating' : 'pwa.applyUpdate');
    const progress = root.querySelector('[data-pwa-update-progress]');
    if (progress) {
      const key = model.pwa.updating ? 'pwa.updating' : working ? 'pwa.updateBusy'
        : !model.pwa.updateAvailable ? 'pwa.updateMissing' : null;
      progress.hidden = key === null;
      progress.textContent = key ? t(model.state.settings.uiLanguage, key) : '';
    }
  }
  lockUnavailableEdits();
}

const pwa = createPwaManager({
  onChange(snapshot) { model.pwa = snapshot; refreshPwaParts(); },
  onReload() { repository?.close(); window.location.reload(); },
});
model.pwa = pwa.getState();

function validDate(value) {
  try { return addDays(value, 0) === value; } catch { return false; }
}

function notice(key, params = {}, type = 'success') {
  model.notice = { key, params, type };
}

function errorKey(error, fallback = 'errors.generic') {
  const code = error?.code ?? '';
  if (storageKeys[code]) return 'storage.errors.' + storageKeys[code];
  if (code.startsWith('DIET_')) return 'errors.invalidDiet';
  if (code.startsWith('BACKUP_')) return 'errors.invalidBackup';
  return ({
    SESSION_INVALID_DATE: 'errors.invalidDate', SESSION_INVALID_RANGE: 'errors.invalidRange',
    SESSION_IMPORT_OVERLAP: 'errors.importOverlap', SESSION_INVALID_SERVINGS: 'errors.invalidServings',
    SESSION_INVALID_TIME: 'errors.invalidTime', SESSION_ENTRY_NOT_FOUND: 'errors.missingEntry',
    SESSION_BROKEN_REFERENCE: 'errors.invalidBackup', SESSION_INVALID_PLAN: 'errors.invalidDiet',
    SESSION_DUPLICATE_ID: 'errors.invalidDiet', IMPORT_DATE_CONFIRMATION_REQUIRED: 'errors.dateConfirmation',
    SESSION_INVALID_SHOPPING_MODE: 'errors.shoppingCalculation',
    SHOPPING_INVALID_CONVERSION: 'errors.invalidConversion', SHOPPING_NONFINITE_QUANTITY: 'errors.shoppingCalculation',
    SHOPPING_EMPTY_LIST: 'errors.emptyShopping', SHOPPING_INVALID_QUANTITY: 'errors.invalidManualQuantity',
    SHOPPING_INVALID_ITEM: 'errors.emptyItem', SHOPPING_ITEM_NOT_FOUND: 'errors.generic',
    IMPORT_DUPLICATE_CONFIRMATION_REQUIRED: 'errors.duplicateConfirmation',
    IMPORT_NOTHING_TO_UNDO: 'errors.nothingToUndo', IMPORT_UNDO_CONFLICT: 'errors.nothingToUndo',
    EXPORT_SOURCE_NOT_FOUND: 'errors.unavailableExport', EXPORT_EMPTY_SELECTION: 'errors.emptyExport',
  })[code] ?? fallback;
}

/** Counts describe the archive; they do not evaluate any food values. */
function summarizeState(state) {
  const dates = Object.keys(state.calendar).sort();
  return {
    plans: Object.keys(state.sourcePlans).length, days: dates.length,
    meals: dates.reduce((count, date) => count + state.calendar[date].meals.length, 0),
    manualItems: state.shopping.manualItems.length,
    checkedItems: Object.values(state.shopping.checked).filter(row => row.checked).length
      + state.shopping.manualItems.filter(row => row.checked).length,
    imports: state.imports.length, startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null,
  };
}

function resetExportSelection(sourceId = model.exportSourceId) {
  const sources = model.state.sourcePlans;
  model.exportSourceId = sourceId && Object.hasOwn(sources, sourceId) ? sourceId : Object.keys(sources)[0] ?? null;
  const dates = Object.keys(model.state.calendar).filter(date =>
    model.state.calendar[date].meals.some(entry => entry.sourceId === model.exportSourceId)).sort();
  model.exportRange = { startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null };
}

function updateDerivedViews() {
  model.currentSummary = summarizeState(model.state);
  model.shoppingRows = [];
  model.shoppingSummary = null;
  model.shoppingError = null;
  try {
    model.shoppingSummary = getShoppingList(model.state);
    model.shoppingRows = model.shoppingSummary.rows;
  } catch (error) {
    model.shoppingError = errorKey(error, 'errors.shoppingCalculation');
  }
  const undo = previewUndoImport(model.state);
  const record = undo && model.state.imports.find(item => item.importId === undo.importId);
  model.undoPreview = undo ? {
    importId: undo.importId, dates: undo.dates,
    movedDates: undo.additionalDates,
    movedMealCount: undo.additionalDates.reduce((count, date) => count
      + model.state.calendar[date].meals.filter(entry => undo.entryIds.includes(entry.entryId)).length, 0),
    title: model.state.sourcePlans[record?.sourceId]?.document.title ?? '',
  } : null;
  model.exportPreview = null;
  model.exportError = null;
  if (!model.exportSourceId) return;
  const { startDate, endDate } = model.exportRange;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    model.exportError = startDate || endDate ? 'errors.invalidRange' : 'errors.emptyExport';
    return;
  }
  const entries = getRangeEntries(model.state, startDate, endDate)
    .filter(row => row.entry.sourceId === model.exportSourceId);
  if (!entries.length) { model.exportError = 'errors.emptyExport'; return; }
  const dates = [...new Set(entries.map(row => row.date))];
  model.exportPreview = {
    dayCount: dates.length, mealCount: entries.length,
    startDate: dates[0], endDate: dates.at(-1),
  };
}

/** Stable selectors restore keyboard focus after declarative rendering. */
function focusLocator(element = document.activeElement) {
  if (!(element instanceof HTMLElement) || !root.contains(element)) return null;
  if (element.id) return '#' + CSS.escape(element.id);
  const attributes = ['data-action', 'data-control', 'data-entry-id', 'data-date',
    'data-view', 'data-delta', 'data-offset', 'data-key', 'data-item-id', 'data-recipe-key', 'name', 'value'];
  const selectors = attributes.filter(name => element.hasAttribute(name))
    .map(name => '[' + name + '="' + CSS.escape(element.getAttribute(name)) + '"]');
  return selectors.length ? element.tagName.toLowerCase() + selectors.join('') : null;
}

/** Navigation and previews remain usable when the saved archive is read-only. */
function lockUnavailableEdits() {
  const cannotWrite = model.storage.status !== 'ready';
  const mutations = new Set(['change-servings', 'confirm-import', 'request-restore',
    'clear-session', 'reset-demo', 'confirm-action', 'undo-last-import', 'remove-manual']);
  const savedControls = new Set(['language', 'reduced-motion', 'week-starts',
    'shopping-start', 'shopping-end', 'shopping-mode', 'meal-date', 'meal-time', 'meal-servings',
    'shopping-check', 'manual-check']);
  for (const control of root.querySelectorAll('button,input,select')) {
    if (servingsWriteActive && (control.dataset.action === 'change-servings' || control.dataset.control === 'meal-servings')) continue;
    if ((model.busy && !model.viewSaving) || (cannotWrite && (mutations.has(control.dataset.action)
      || savedControls.has(control.dataset.control)
      || control.closest('[data-form="manual-item"], [data-form="move-meal"]')))) {
      control.disabled = true;
    }
    if (!model.storage.hasData && ['download-backup', 'export-plan', 'export-original'].includes(control.dataset.action)) {
      control.disabled = true;
    }
  }
}

function render({ focus = focusLocator(), top = false } = {}) {
  model.today = todayISO();
  updateDerivedViews();
  const view = model.state.ui.view;
  const viewKey = [view, view === 'today' ? model.today : view === 'calendar' ? model.state.ui.selectedDate : '', model.loading].join(':');
  const dialogKey = model.dialog ? model.dialog.kind + ':' + (model.dialog.entryId ?? model.dialog.recipeKey ?? model.dialog.action) : null;
  const dialogScroll = root.querySelector('dialog .modal-body')?.scrollTop ?? 0;
  const oldScroll = window.scrollY;
  document.documentElement.lang = model.state.settings.uiLanguage;
  document.documentElement.dataset.reducedMotion = String(model.state.settings.reducedMotion);
  document.title = 'Meal Planner · ' + t(model.state.settings.uiLanguage, 'nav.' + view);
  root.innerHTML = renderApp(model);
  root.querySelector('.view-content')?.classList.toggle('is-entering', viewKey !== lastViewKey);
  lockUnavailableEdits();
  const strip = root.querySelector('.mobile-date-strip');
  const selectedDate = strip?.querySelector('[aria-pressed="true"]');
  if (strip?.clientWidth && selectedDate) {
    strip.scrollLeft = selectedDate.offsetLeft - strip.offsetLeft - (strip.clientWidth - selectedDate.clientWidth) / 2;
  }
  const dialog = root.querySelector('dialog');
  if (dialog) {
    dialog.classList.toggle('is-entering', dialogKey !== lastDialogKey);
    dialog.showModal();
    const body = dialog.querySelector('.modal-body');
    if (body) body.scrollTop = dialogScroll;
  }
  const focusTarget = focus ? root.querySelector(focus) : null;
  if (focusTarget && (!dialog || dialog.contains(focusTarget))) focusTarget.focus({ preventScroll: true });
  window.scrollTo({ top: top ? 0 : oldScroll, behavior: 'auto' });
  showPendingServings();
  motion.sync({ reducedMotion: model.state.settings.reducedMotion,
    pageChanged: viewKey !== lastViewKey, dialogChanged: dialogKey !== lastDialogKey });
  lastViewKey = viewKey;
  lastDialogKey = dialogKey;
  scheduleViewSave();
}

function clearManualDraft() {
  model.manualDraft = { name: '', quantity: '', unit: 'unit', customUnit: '', category: 'other' };
}

function showStorageFailure(error, fallback = 'storage.errors.write') {
  model.storage.status = error?.code === 'STORAGE_CONFLICT' ? 'conflict'
    : error?.code === 'STORAGE_UNAVAILABLE' ? 'unavailable' : 'error';
  model.storage.errorKey = errorKey(error, fallback);
  notice(model.storage.errorKey, {}, 'error');
}

/**
 * Application data is swapped only after the IndexedDB transaction completes.
 * On rejection the candidate is discarded; import/restore previews stay open.
 */
async function saveCandidate(candidate, options = {}) {
  if (model.storage.status !== 'ready' || !repository) {
    throw Object.assign(new Error('Storage is not writable.'), { code: 'STORAGE_UNAVAILABLE' });
  }
  const hadStoredState = model.storage.hasStoredState;
  const routeAtStart = routeRevision;
  const focus = focusLocator();
  const { quiet = false, viewOnly = false, ...commitOptions } = options;
  model.busy = true;
  if (!viewOnly) model.storage.status = 'saving';
  model.storage.errorKey = null;
  let finishWrite;
  const completion = new Promise(resolve => { finishWrite = resolve; });
  activeWrite = completion;
  if (!quiet) render({ focus });
  try {
    const committed = await commitCandidate(repository, candidate, commitOptions);
    // Browser Back/Forward may be used while a transaction is pending. Keep
    // that newer transient route while adopting the committed archive data.
    model.state = routeRevision === routeAtStart ? committed
      : { ...committed, ui: { ...model.state.ui } };
    savedUi = structuredClone(committed.ui);
    model.storage.hasData = true;
    model.storage.hasStoredState = true;
    if (options.checkpoint) model.storage.recoveryAvailable = hadStoredState;
    if (options.clearRecovery) model.storage.recoveryAvailable = false;
    if (connectionHealthy) {
      model.storage.status = 'ready';
      model.storage.errorKey = null;
    }
    return committed;
  } catch (error) {
    showStorageFailure(error);
    throw error;
  } finally {
    model.busy = false;
    if (activeWrite === completion) activeWrite = null;
    finishWrite();
    scheduleViewSave();
  }
}

/** View state is allowed to change locally even when archive writes are blocked. */
function routeTo(view, date = null, replace = false) {
  model.today = todayISO();
  const route = resolveNavigation(model.state.ui, { view, date, today: model.today });
  routeRevision += 1;
  model.state = { ...model.state, ui: route.ui };
  if (location.hash !== route.hash) history[replace ? 'replaceState' : 'pushState'](null, '', route.hash);
}

function readRoute() {
  model.today = todayISO();
  const route = resolveRoute(model.state.ui, { hash: location.hash, today: model.today });
  routeRevision += 1;
  model.state = { ...model.state, ui: route.ui };
  if (location.hash !== route.hash) history.replaceState(null, '', route.hash);
}

/** Store the resulting route in the same candidate as the calendar change. */
function withRoute(candidate, view, date = null) {
  return { ...candidate, ui: resolveNavigation(candidate.ui, { view, date, today: model.today }).ui };
}

function hasUnsavedView() {
  return savedUi !== null && JSON.stringify(model.state.ui) !== JSON.stringify(savedUi);
}

/**
 * Browser history can change while a file read or transaction is pending.
 * Coalesce that navigation after the action completes. A failed view-only
 * save never changes the outcome of the already committed calendar action.
 */
function scheduleViewSave() {
  if (viewSaveTimer !== null || model.busy || model.storage.status !== 'ready' || !hasUnsavedView()) return;
  viewSaveTimer = setTimeout(async () => {
    viewSaveTimer = null;
    if (model.busy || model.storage.status !== 'ready' || !hasUnsavedView()) return;
    try { await rememberView(); }
    catch (error) { notice(errorKey(error, 'storage.errors.write'), {}, 'error'); render(); }
  }, 0);
}

async function rememberView() {
  if (!model.busy && model.storage.status === 'ready' && hasUnsavedView()) {
    model.viewSaving = true;
    viewSavePromise = saveCandidate(cloneStateSnapshot(model.state), { quiet: true, viewOnly: true });
    try { await viewSavePromise; }
    finally { model.viewSaving = false; viewSavePromise = null; refreshPwaParts(); }
  }
}

function showPendingServings() {
  for (const field of root.querySelectorAll('[data-control="meal-servings"]')) {
    if (!pendingServings.has(field.dataset.entryId)) continue;
    field.value = pendingServings.get(field.dataset.entryId);
    field.setAttribute('aria-busy', 'true');
    const minus = field.closest('.serving-control')?.querySelector('[data-delta="-1"]');
    if (minus) minus.disabled = Number(field.value) <= 1;
  }
}

/** Coalesce rapid taps without dropping clicks or overwriting a later saved count. */
async function changePeople(entryId, { delta, value } = {}) {
  if ((model.busy && !servingsWriteActive && !model.viewSaving) || (!servingsWriteActive && model.storage.status !== 'ready')) return;
  const item = findEntry(model.state, entryId);
  if (!item) return;
  const base = pendingServings.get(entryId) ?? item.cookingServings;
  const count = value ?? Math.max(1, base + delta);
  try { setEntryServings(model.state, entryId, count); }
  catch (error) { notice(errorKey(error), {}, 'error'); render(); return; }
  pendingServings.set(entryId, count);
  showPendingServings();
  if (servingsWriteActive) return;
  servingsWriteActive = true;
  try {
    while (pendingServings.size) {
      // Recheck after every wake-up: another waiting action can acquire the
      // write slot first. Construct this candidate only from the latest state.
      while (activeWrite) await activeWrite;
      const [id, target] = pendingServings.entries().next().value;
      const previous = findEntry(model.state, id)?.cookingServings ?? target;
      const candidate = reconcileShopping(setEntryServings(model.state, id, target));
      await saveCandidate(candidate, { quiet: true });
      if (pendingServings.get(id) === target) pendingServings.delete(id);
      render();
      for (const element of root.querySelectorAll('.meal-people-control[data-entry-id="' + CSS.escape(id) + '"]')) {
        motion.feedback(element, { direction: target >= previous ? 1 : -1 });
      }
      for (const status of root.querySelectorAll('[data-people-status][data-entry-id="' + CSS.escape(id) + '"]')) {
        status.textContent = t(model.state.settings.uiLanguage, 'meal.peopleSaved', { count: target });
      }
    }
  } catch (error) {
    pendingServings.clear();
    notice(errorKey(error), {}, 'error');
    render();
  } finally {
    servingsWriteActive = false;
    lockUnavailableEdits();
  }
}

function selectDate(date) {
  if (!validDate(date)) throw Object.assign(new Error('Invalid date'), { code: 'SESSION_INVALID_DATE' });
  routeTo('calendar', date);
  render({ focus: '#day-heading' });
  root.querySelector('.calendar-layout')?.scrollIntoView({ block: 'start', behavior: 'auto' });
}

function openDialog(dialog) {
  dialogOpener = focusLocator();
  model.notice = null;
  model.dialog = dialog;
  const row = dialog.kind === 'meal' ? findEntry(model.state, dialog.entryId) : null;
  model.mealMoveDraft = row ? { entryId: row.entry.entryId, date: row.date, error: null } : null;
  render({ focus: null });
}

function closeDialog() {
  model.dialog = null;
  model.mealMoveDraft = null;
  model.shoppingCopyText = '';
  model.shoppingCopyFileName = '';
  render({ focus: dialogOpener });
  dialogOpener = null;
}

function downloadContent(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadJSON(value, fileName) {
  downloadContent(JSON.stringify(value, null, 2) + '\n', fileName, 'application/json;charset=utf-8');
}

/** A fresh snapshot makes copy and download match the current calculated list. */
function shoppingExport() {
  const list = getShoppingList(model.state);
  if (list.totalCount === 0) {
    throw Object.assign(new Error('The shopping list has no items.'), { code: 'SHOPPING_EMPTY_LIST' });
  }
  const language = model.state.settings.uiLanguage;
  return { text: createShoppingText(list, language), fileName: shoppingTextFileName(list, language) };
}

async function copyShoppingList() {
  const payload = shoppingExport();
  const request = ++activeShoppingCopy;
  const routeAtStart = routeRevision;
  const dialogAtStart = model.dialog;
  // Clipboard permission can settle after a newer dialog or local I/O starts.
  const mayPresent = () => request === activeShoppingCopy && routeRevision === routeAtStart
    && model.dialog === dialogAtStart && !model.busy;
  try {
    if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable.');
    await navigator.clipboard.writeText(payload.text);
    if (!mayPresent()) return;
    notice('notices.shoppingCopied');
    render();
  } catch {
    if (!mayPresent()) return;
    model.shoppingCopyText = payload.text;
    model.shoppingCopyFileName = payload.fileName;
    openDialog({ kind: 'shopping-copy' });
    const field = root.querySelector('#shopping-copy-text');
    field?.focus();
    field?.select();
  }
}

function exportFileName(document, kind) {
  const language = document.language.replace(/[^a-zA-Z0-9-]/g, '') || 'plan';
  return 'meal-plan-' + kind + '-' + document.suggestedStartDate + '-' + language + '.diet';
}

function refreshImportPreview({ resetConfirmation = false } = {}) {
  const draft = model.importDraft;
  if (!draft?.document) return;
  if (resetConfirmation) {
    draft.dateConfirmed = false;
    draft.duplicateConfirmed = false;
  }
  try {
    draft.preview = previewImport(model.state, draft.document, draft.startDate);
    draft.error = null;
  } catch (error) {
    draft.preview = null;
    draft.error = errorKey(error, 'errors.invalidDiet');
  }
}

function previewPlan(document, fileName, startDate = document.suggestedStartDate) {
  const preview = previewImport(model.state, document, startDate);
  model.importDraft = {
    document, fileName, startDate, preview, error: null,
    dateConfirmed: false, duplicateConfirmed: false,
  };
}

/** A demo is loaded only on request, never over a saved calendar during startup. */
async function loadDemoDocument() {
  if (demoDocument) return demoDocument;
  const response = await fetch(DEMO_DOCUMENT_URL);
  if (!response.ok) throw Object.assign(new Error('Demo not available.'), { code: 'DEMO_NOT_LOADED' });
  demoDocument = readDietDocument(await response.text());
  return demoDocument;
}

async function applyImport(overwrite = false) {
  const routeAtStart = routeRevision;
  const draft = model.importDraft;
  if (!draft?.document || draft.error) return;
  const result = prepareImport(model.state, draft.document, {
    startDate: draft.startDate, fileName: draft.fileName,
    dateConfirmed: draft.dateConfirmed, duplicateConfirmed: draft.duplicateConfirmed, overwrite,
  });
  if (result.noOp) {
    model.dialog = null;
    notice('notices.alreadyImported');
    render();
    return;
  }
  await saveCandidate(withRoute(result.state, 'calendar', result.preview.startDate));
  model.dialog = null;
  model.importDraft = null;
  resetExportSelection(result.sourceId);
  if (routeRevision === routeAtStart) routeTo('calendar', result.preview.startDate);
  notice('notices.imported', { count: result.preview.dayCount });
  render({ focus: '#day-heading', top: true });
}

async function reconnectStorage({ initial = false } = {}) {
  const generation = ++storageGeneration;
  repository?.close();
  connectionHealthy = false;
  model.storage.status = 'loading';
  model.storage.errorKey = null;
  model.storage.rawBackupAvailable = false;
  model.rawBackup = null;
  model.busy = true;
  if (!initial) { model.dialog = null; model.mealMoveDraft = null; model.notice = null; }
  render();
  let invalidated = false;
  repository = createIndexedDBRepository({
    onStatus(event) {
      if (generation !== storageGeneration) return;
      invalidated = true;
      connectionHealthy = false;
      showStorageFailure({ code: event.code ?? 'STORAGE_CLOSED' }, 'storage.errors.closed');
      render();
    },
  });
  try {
    const loaded = await loadCompatibleState(repository);
    const candidate = loaded === null ? createAppState({ uiLanguage: model.state.settings.uiLanguage }) : loaded;
    const recovery = await repository.loadRecovery();
    if (invalidated) throw Object.assign(new Error('Storage connection changed.'), { code: 'STORAGE_CLOSED' });
    // A failed read or validation never replaces the current visible snapshot.
    model.state = candidate;
    savedUi = structuredClone(candidate.ui);
    connectionHealthy = true;
    model.storage = {
      status: 'ready', errorKey: null, hasData: true,
      hasStoredState: loaded !== null, recoveryAvailable: recovery !== null,
      rawBackupAvailable: false,
    };
    readRoute();
    resetExportSelection();
    refreshImportPreview({ resetConfirmation: true });
    if (model.backupDraft) model.backupDraft.summary = summarizeState(model.backupDraft.state);
    if (!initial) notice('notices.storageReloaded');
  } catch (error) {
    showStorageFailure(error, 'storage.errors.read');
    // A compatibility failure must not force a user to overwrite or discard
    // their archive. A separate read-only path can export its original JSON.
    try {
      model.rawBackup = await readStoredBackup();
      model.storage.rawBackupAvailable = model.rawBackup !== null;
    } catch { model.rawBackup = null; }
  } finally {
    model.loading = false;
    model.busy = false;
    render({ focus: initial ? null : '#page-title' });
  }
}

/** An explicit update flushes navigation and waits for any local save first. */
async function applyAppUpdate() {
  if (model.busy || ['loading', 'saving'].includes(model.storage.status)
    || model.dialog?.kind !== 'app-update') return;
  if (model.storage.status === 'ready') {
    while (hasUnsavedView()) {
      await rememberView();
      // Back/Forward during the commit cancels the update confirmation.
      if (model.dialog?.kind !== 'app-update') return;
    }
  }
  model.busy = true;
  render();
  const applied = await pwa.applyUpdate();
  if (!applied) {
    model.busy = false;
    render();
  }
}

async function readFile(file, kind) {
  if (!file) return;
  const request = ++activeFileRead;
  model.busy = true;
  model.notice = null;
  render();
  try {
    const text = await file.text();
    if (request !== activeFileRead) return;
    if (kind === 'diet') previewPlan(readDietDocument(text), file.name);
    else {
      const state = readBackup(text);
      model.backupDraft = { state, fileName: file.name, summary: summarizeState(state) };
    }
  } catch (error) {
    if (request !== activeFileRead) return;
    if (kind === 'diet') {
      model.importDraft = { document: null, fileName: file.name, startDate: model.today,
        preview: null, error: errorKey(error, 'errors.invalidDiet'), dateConfirmed: false, duplicateConfirmed: false };
    } else {
      model.backupDraft = null;
      notice('errors.invalidBackup', {}, 'error');
    }
  } finally {
    if (request === activeFileRead) { model.busy = false; render(); }
  }
}

async function confirmAction(action) {
  const routeAtStart = routeRevision;
  if (action === 'import') { await applyImport(true); return; }
  if (action === 'restore' && model.backupDraft) {
    await saveCandidate(withRoute(model.backupDraft.state, 'settings'), { checkpoint: true });
    model.backupDraft = null;
    model.importDraft = null;
    model.dialog = null;
    model.mealMoveDraft = null;
    clearManualDraft();
    resetExportSelection();
    if (routeRevision === routeAtStart) routeTo('settings');
    notice('notices.restored');
  } else if (action === 'undo-import') {
    const candidate = undoLastImport(model.state);
    await saveCandidate(candidate);
    model.dialog = null;
    refreshImportPreview({ resetConfirmation: true });
    resetExportSelection();
    notice('notices.importUndone');
  } else if (action === 'clear' || action === 'reset') {
    const settings = { ...model.state.settings };
    let candidate = createAppState({ uiLanguage: settings.uiLanguage });
    candidate.settings = settings;
    if (action === 'reset') {
      let document;
      model.busy = true;
      render();
      try { document = await loadDemoDocument(); }
      finally { model.busy = false; }
      candidate = prepareImport(candidate, document, {
        startDate: model.today, fileName: 'meal-plan-it.diet', dateConfirmed: true,
      }).state;
    }
    // Back/Forward may run during the demo fetch, before saveCandidate starts
    // tracking route changes. Carry that latest route into the saved candidate.
    if (routeRevision !== routeAtStart) candidate.ui = { ...model.state.ui };
    else candidate = withRoute(candidate, 'today');
    await saveCandidate(candidate, { clearRecovery: true });
    model.dialog = null;
    model.mealMoveDraft = null;
    model.importDraft = null;
    model.backupDraft = null;
    clearManualDraft();
    resetExportSelection();
    if (routeRevision === routeAtStart) routeTo('today');
    notice(action === 'clear' ? 'notices.cleared' : 'notices.demoReset');
  } else return;
  render({ focus: '#page-title', top: true });
}

/** Move one occurrence, preserving its source and all destination meals. */
async function moveMeal(form) {
  const entryId = form.dataset.entryId;
  const date = String(new FormData(form).get('date') ?? '');
  const routeAtStart = routeRevision;
  model.mealMoveDraft = { entryId, date, error: null };
  try {
    const row = findEntry(model.state, entryId);
    if (!row) throw Object.assign(new Error('Missing entry'), { code: 'SESSION_ENTRY_NOT_FOUND' });
    if (!validDate(date)) throw Object.assign(new Error('Invalid date'), { code: 'SESSION_INVALID_DATE' });
    if (row.date === date) { render({ focus: '#meal-date' }); return; }
    const candidate = withRoute(reconcileShopping(setEntryDate(model.state, entryId, date)), 'calendar', date);
    await saveCandidate(candidate);
    // The destination is selected by the same commit as the move. A newer
    // browser-history navigation still wins and must not reopen this dialog.
    if (routeRevision === routeAtStart) routeTo('calendar', date);
    model.mealMoveDraft = model.dialog?.kind === 'meal' && model.dialog.entryId === entryId
      ? { entryId, date, error: null } : null;
    refreshImportPreview({ resetConfirmation: true });
    notice('notices.mealMoved', { date: formatDate(date, model.state.settings.uiLanguage) });
    render({ focus: model.dialog ? '#meal-date' : '#page-title' });
  } catch (error) {
    const key = errorKey(error);
    if (model.dialog?.kind === 'meal' && model.dialog.entryId === entryId) {
      model.mealMoveDraft = { entryId, date, error: key };
    }
    notice(key, {}, 'error');
    render({ focus: model.dialog ? '#meal-date' : '#page-title' });
  }
}

/** Preserve native input/button focus while editing a move destination. */
function refreshMealMoveForm(field) {
  const form = field.closest('[data-form="move-meal"]');
  if (!form) return;
  const row = findEntry(model.state, field.dataset.entryId);
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = model.busy || model.storage.status !== 'ready'
    || !row || !validDate(field.value) || field.value === row.date;
  if (model.mealMoveDraft?.error) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  const feedback = form.querySelector('#meal-move-feedback');
  if (feedback) feedback.innerHTML = renderMealMoveFeedback(model);
}

const mutationActions = new Set(['change-servings', 'confirm-import', 'request-restore',
  'clear-session', 'reset-demo', 'confirm-action', 'undo-last-import', 'remove-manual']);

/** Late optional-browser results must not recreate a form opened meanwhile. */
function presentPwaResult(context, key, type = 'success') {
  if (context.route !== routeRevision || context.dialog !== model.dialog || model.busy) return;
  if (key) notice(key, {}, type);
  render();
}

root.addEventListener('click', async (event) => {
  if (event.target.closest('.skip-link')) {
    event.preventDefault();
    root.querySelector('#main')?.focus();
    return;
  }
  const control = event.target.closest('[data-action]');
  if (!control) return;
  event.preventDefault();
  const { action, entryId } = control.dataset;
  if (action === 'change-servings' && !control.disabled) {
    await changePeople(entryId, { delta: Number(control.dataset.delta) }); return;
  }
  if (control.disabled) return;
  if (model.viewSaving && !['navigate', 'select-date', 'go-today', 'step-day', 'open-meal', 'open-recipe', 'close-dialog'].includes(action)) {
    while (activeWrite) await activeWrite;
  }
  if (model.busy && !model.viewSaving) return;
  const actionContext = { route: routeRevision, dialog: model.dialog };
  if (mutationActions.has(action) && model.storage.status !== 'ready') return;
  try {
    if (action === 'open-update') {
      if (model.pwa.updateAvailable) openDialog({ kind: 'app-update' });
    } else if (action === 'apply-app-update') {
      await applyAppUpdate();
    } else if (action === 'install-app') {
      const result = await pwa.promptInstall();
      if (result === 'error') presentPwaResult(actionContext, 'pwa.errors.install', 'error');
      else if (model.pwa.installMode === 'installed') presentPwaResult(actionContext, 'notices.appInstalled');
    } else if (action === 'request-persistence') {
      const result = await pwa.requestPersistence();
      if (result === 'error') presentPwaResult(actionContext, 'pwa.errors.persistence', 'error');
      else if (result === 'granted') presentPwaResult(actionContext, 'notices.persistenceGranted');
      else if (result === 'not-granted') presentPwaResult(actionContext, 'notices.persistenceNotGranted');
    } else if (action === 'check-update') {
      const result = await pwa.checkForUpdate();
      if (result.checked && !result.available) presentPwaResult(actionContext, 'notices.noUpdates');
    } else if (action === 'retry-offline') {
      await pwa.repair();
    } else if (action === 'download-stored-backup') {
      if (model.rawBackup) {
        downloadJSON(model.rawBackup, 'meal-planner-original-archive-' + model.today + '.json');
        notice('notices.storedBackupDownloaded'); render();
      }
    } else if (action === 'navigate') {
      model.notice = null;
      routeTo(control.dataset.view);
      render({ focus: '#page-title', top: true });
      await rememberView();
    } else if (action === 'select-date' || action === 'go-today') {
      selectDate(action === 'go-today' ? todayISO() : control.dataset.date);
      await rememberView();
    } else if (action === 'step-day') {
      const currentDate = todayISO();
      const current = model.state.ui.view === 'today' ? currentDate : getSelectedCalendarDate(model.state.ui, currentDate);
      selectDate(addDays(current, Number(control.dataset.offset)));
      await rememberView();
    } else if (action === 'open-meal') {
      if (!findEntry(model.state, entryId)) throw Object.assign(new Error('Missing entry'), { code: 'SESSION_ENTRY_NOT_FOUND' });
      openDialog({ kind: 'meal', entryId });
    } else if (action === 'close-dialog') closeDialog();
    else if (action === 'open-recipe') {
      openDialog({ kind: 'recipe', recipeKey: control.dataset.recipeKey });
    } else if (action === 'open-recipe-occurrence') {
      const row = findEntry(model.state, entryId);
      if (!row) return;
      model.dialog = null;
      selectDate(row.date);
      openDialog({ kind: 'meal', entryId });
      await rememberView();
    } else if (action === 'clear-recipe-filters' || action === 'search-ingredient') {
      model.recipeFilters = { ...DEFAULT_RECIPE_FILTERS };
      if (action === 'search-ingredient') Object.assign(model.recipeFilters, { query: control.dataset.ingredientName, searchIn: 'ingredients' });
      render({ focus: '#recipe-query' });
    } else if (action === 'load-demo-import') {
      model.busy = true; render();
      try { previewPlan(await loadDemoDocument(), 'meal-plan-it.diet'); }
      finally { model.busy = false; }
      render({ focus: '#import-start' });
    } else if (action === 'cancel-import') {
      model.importDraft = null;
      model.notice = null;
      render({ focus: '#diet-file' });
    } else if (action === 'confirm-import') {
      refreshImportPreview();
      const draft = model.importDraft;
      if (!draft?.preview || !draft.dateConfirmed) {
        notice('errors.dateConfirmation', {}, 'error'); render(); return;
      }
      if (draft.preview.duplicate && !draft.preview.noOp && !draft.duplicateConfirmed) {
        notice('errors.duplicateConfirmation', {}, 'error'); render(); return;
      }
      if (draft.preview.overlaps.length && !draft.preview.noOp) openDialog({ kind: 'confirm', action: 'import' });
      else await applyImport(false);
    } else if (action === 'request-restore' && model.backupDraft) openDialog({ kind: 'confirm', action: 'restore' });
    else if (action === 'cancel-restore') {
      model.backupDraft = null;
      model.notice = null;
      render({ focus: '#backup-file' });
    } else if (action === 'undo-last-import' && model.state.lastImportUndo) openDialog({ kind: 'confirm', action: 'undo-import' });
    else if (action === 'clear-session' || action === 'reset-demo') openDialog({ kind: 'confirm', action: action === 'clear-session' ? 'clear' : 'reset' });
    else if (action === 'confirm-action') await confirmAction(model.dialog?.action);
    else if (action === 'download-backup') {
      downloadJSON(createBackup(model.state), 'meal-planner-backup-' + model.today + '.json');
      notice('notices.backupDownloaded'); render();
    } else if (action === 'download-recovery') {
      const recovery = await readStoredBackup({ record: 'recovery' });
      if (!recovery) { model.storage.recoveryAvailable = false; render(); return; }
      downloadJSON(recovery, 'meal-planner-previous-archive-' + model.today + '.json');
      notice('notices.recoveryDownloaded'); render();
    } else if (action === 'retry-storage') await reconnectStorage();
    else if (action === 'export-plan' || action === 'export-original') {
      const document = action === 'export-original' ? exportSourceDiet(model.state, model.exportSourceId)
        : exportCalendarDiet(model.state, { sourceId: model.exportSourceId, ...model.exportRange });
      downloadJSON(document, exportFileName(document, action === 'export-original' ? 'original' : 'calendar'));
      notice(action === 'export-original' ? 'notices.originalDownloaded' : 'notices.calendarExported');
      render();
    } else if (action === 'copy-shopping') {
      await copyShoppingList();
    } else if (action === 'download-shopping') {
      // The fallback dialog downloads the same snapshot shown in its textarea,
      // even if a preceding archive update completed while clipboard access waited.
      const payload = model.dialog?.kind === 'shopping-copy' && model.shoppingCopyText
        ? { text: model.shoppingCopyText, fileName: model.shoppingCopyFileName }
        : shoppingExport();
      downloadContent(payload.text, payload.fileName, 'text/plain;charset=utf-8');
      notice('notices.shoppingDownloaded'); render();
    } else if (action === 'select-shopping-text') {
      const field = root.querySelector('#shopping-copy-text');
      field?.focus();
      field?.select();
    } else if (action === 'remove-manual') {
      if (model.storage.status !== 'ready') return;
      const candidate = removeManualItem(model.state, control.dataset.itemId);
      await saveCandidate(candidate);
      notice('notices.itemRemoved'); render({ focus: '#manual-name' });
    } else if (action === 'dismiss-notice') {
      model.notice = null; render({ focus: '#page-title' });
    }
  } catch (error) {
    notice(errorKey(error, action === 'load-demo-import' ? 'errors.loadDemo' : 'errors.generic'), {}, 'error');
    render();
  }
});

const transientControls = new Set(['selected-date', 'diet-file', 'backup-file',
  'import-start', 'import-date-confirmed', 'import-duplicate-confirmed',
  'export-source', 'export-start', 'export-end']);

root.addEventListener('change', async (event) => {
  const control = event.target;
  if (!(control instanceof HTMLElement)) return;
  if (control.dataset.control === 'meal-servings') {
    await changePeople(control.dataset.entryId, { value: Number(control.value) }); return;
  }
  if (model.viewSaving) { while (activeWrite) await activeWrite; }
  if (model.busy) return;
  if (control.closest('[data-form="manual-item"]') && control.name === 'unit') {
    model.manualDraft.unit = control.value;
    render({ focus: control.value === 'custom' ? '#manual-custom-unit' : '#manual-unit' });
    return;
  }
  const name = control.dataset.control;
  if (!name) return;
  if (name.startsWith('recipe-')) {
    const key = name.slice(7);
    if (Object.hasOwn(DEFAULT_RECIPE_FILTERS, key)) { model.recipeFilters[key] = control.value; refreshRecipeResults(); }
    return;
  }
  if (!transientControls.has(name) && model.storage.status !== 'ready') return;
  try {
    if (name === 'diet-file' || name === 'backup-file') {
      await readFile(control.files?.[0], name === 'diet-file' ? 'diet' : 'backup'); return;
    }
    if (name === 'selected-date') {
      selectDate(control.value); await rememberView(); return;
    }
    if (name === 'meal-date') {
      model.mealMoveDraft = {
        entryId: control.dataset.entryId, date: control.value,
        error: validDate(control.value) ? null : 'errors.invalidDate',
      };
      refreshMealMoveForm(control); return;
    }
    if (name === 'import-start') {
      if (model.importDraft) {
        model.importDraft.startDate = control.value;
        refreshImportPreview({ resetConfirmation: true });
      }
      render(); return;
    }
    if (name === 'import-date-confirmed' || name === 'import-duplicate-confirmed') {
      if (model.importDraft) model.importDraft[name === 'import-date-confirmed' ? 'dateConfirmed' : 'duplicateConfirmed'] = control.checked;
      render(); return;
    }
    if (name === 'export-source') { resetExportSelection(control.value); render(); return; }
    if (name === 'export-start' || name === 'export-end') {
      model.exportRange[name === 'export-start' ? 'startDate' : 'endDate'] = control.value;
      render(); return;
    }
    let candidate = cloneStateSnapshot(model.state);
    let success = null;
    if (name === 'language') candidate.settings.uiLanguage = control.value === 'en' ? 'en' : 'it';
    else if (name === 'reduced-motion') candidate.settings.reducedMotion = control.checked;
    else if (name === 'week-starts') candidate.settings.weekStartsOn = control.value === '0' ? 0 : 1;
    else if (name === 'shopping-start' || name === 'shopping-end') {
      if (!validDate(control.value)) throw Object.assign(new Error('Invalid date'), { code: 'SESSION_INVALID_DATE' });
      const range = { ...model.state.shopping.range };
      if (name === 'shopping-start') {
        range.startDate = control.value;
        if (!range.endDate || range.endDate < range.startDate) range.endDate = range.startDate;
      } else {
        range.endDate = control.value;
        if (!range.startDate || range.startDate > range.endDate) range.startDate = range.endDate;
      }
      candidate = setShoppingRange(model.state, range);
    } else if (name === 'shopping-mode') {
      if (!['one', 'two', 'advanced'].includes(control.value)) return;
      candidate = setShoppingMode(model.state, control.value);
    } else if (name === 'meal-time') {
      candidate = setEntryTime(model.state, control.dataset.entryId, control.value);
      success = ['notices.timeUpdated', {}];
    } else if (name === 'meal-servings') {
      candidate = setEntryServings(model.state, control.dataset.entryId, Number(control.value));
      success = ['notices.peopleUpdated', { count: Number(control.value) }];
    } else if (name === 'shopping-check') {
      candidate = setShoppingItemChecked(model.state, control.dataset.key, control.checked);
    } else if (name === 'manual-check') {
      candidate = setManualItemChecked(model.state, control.dataset.itemId, control.checked);
    } else return;
    if (name === 'meal-servings') {
      candidate = reconcileShopping(candidate);
    }
    candidate.meta.updatedAt = new Date().toISOString();
    await saveCandidate(candidate);
    if (success) notice(...success);
    render();
  } catch (error) {
    notice(errorKey(error), {}, 'error'); render();
  }
});

root.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (['move-meal', 'manual-item'].includes(form.dataset.form) && model.viewSaving) {
    event.preventDefault();
    while (activeWrite) await activeWrite;
  }
  if (form.dataset.form === 'move-meal') {
    event.preventDefault();
    if (!model.busy && model.storage.status === 'ready') await moveMeal(form);
    return;
  }
  if (form.dataset.form !== 'manual-item') return;
  event.preventDefault();
  if (model.busy || model.storage.status !== 'ready' || !form.reportValidity()) return;
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const rawQuantity = String(data.get('quantity') ?? '').trim();
  const quantity = rawQuantity === '' ? NaN : Number(rawQuantity);
  if (!name) { notice('errors.emptyItem', {}, 'error'); render({ focus: '#manual-name' }); return; }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    notice('errors.invalidManualQuantity', {}, 'error'); render({ focus: '#manual-quantity' }); return;
  }
  const selectedUnit = String(data.get('unit') ?? 'unit');
  const unit = String(selectedUnit === 'custom' ? data.get('customUnit') ?? '' : selectedUnit).trim();
  if (!unit) { notice('errors.emptyUnit', {}, 'error'); render({ focus: '#manual-custom-unit' }); return; }
  try {
    const candidate = addManualItem(model.state, {
      name, quantity, unit, category: String(data.get('category') ?? 'other'),
    });
    await saveCandidate(candidate);
    clearManualDraft();
    notice('notices.itemAdded'); render({ focus: '#manual-name' });
  } catch (error) {
    notice(errorKey(error), {}, 'error'); render();
  }
});

function refreshRecipeResults() {
  const slot = root.querySelector('[data-recipe-results]');
  if (!slot) return;
  slot.innerHTML = renderRecipeResults(model);
  motion.sync({ reducedMotion: model.state.settings.reducedMotion });
}

root.addEventListener('input', (event) => {
  const field = event.target;
  if (field.dataset.control === 'recipe-query') {
    model.recipeFilters.query = field.value; refreshRecipeResults(); return;
  }
  if (field.closest('[data-form="manual-item"]') && ['name', 'quantity', 'unit', 'customUnit', 'category'].includes(field.name)) {
    model.manualDraft[field.name] = field.value;
  }
  if (field.dataset.control === 'meal-date') {
    // Refresh only feedback and submit state: recreating the form on blur
    // could otherwise discard the user's first click on the move button.
    model.mealMoveDraft = { entryId: field.dataset.entryId, date: field.value, error: null };
    refreshMealMoveForm(field);
  }
});

root.addEventListener('cancel', (event) => {
  if (event.target instanceof HTMLDialogElement) {
    event.preventDefault();
    if (!model.busy || model.viewSaving) closeDialog();
  }
}, true);

root.addEventListener('keydown', async (event) => {
  const dateButton = event.target.closest('[data-action="select-date"]');
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!dateButton || !Object.hasOwn(offsets, event.key) || (model.busy && !model.viewSaving)) return;
  event.preventDefault();
  try {
    selectDate(addDays(dateButton.dataset.date, offsets[event.key]));
    await rememberView();
    [...root.querySelectorAll('[data-action="select-date"][data-date="' + model.state.ui.selectedDate + '"]')]
      .find(button => button.getClientRects().length > 0)?.focus({ preventScroll: true });
  } catch (error) {
    notice(errorKey(error, 'errors.invalidDate'), {}, 'error'); render();
  }
});

root.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-dropzone="diet"]')) event.preventDefault();
});
root.addEventListener('drop', async (event) => {
  if (!event.target.closest('[data-dropzone="diet"]')) return;
  event.preventDefault();
  if (!model.busy) await readFile(event.dataTransfer?.files?.[0], 'diet');
});

function handleHistory() {
  model.dialog = null;
  model.mealMoveDraft = null;
  model.notice = null;
  readRoute();
  render({ focus: '#page-title', top: true });
}
window.addEventListener('popstate', handleHistory);
window.addEventListener('hashchange', handleHistory);
window.addEventListener('focus', () => {
  const current = todayISO();
  if (current === model.today) return;
  model.today = current;
  render();
});

render();
// Cache preparation and storage-permission requests run independently of
// IndexedDB. No network result is required to open or edit the local archive.
void pwa.start();
await reconnectStorage({ initial: true });
