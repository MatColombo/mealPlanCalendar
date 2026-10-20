import { t, getMessages, formatDate, formatNumber, formatTime, formatAmount, formatShoppingAmount, codeLabel, planLanguageLabel } from './i18n.js';
import { escape, attributes, button, iconButton, emptyState, nutritionSummary, mealCard, ingredientList } from './components.js';
import { icon, foodArt } from './icons.js';
import { addDays } from '../data/dates.js';
import { getDayEntries, findEntry, getRangeEntries, getShoppingItems } from '../data/session.js';
import { scaleIngredients } from '../shopping/quantities.js';
import { groupShoppingItems } from './shopping-output.js';

const primaryViews = [['today', 'sun'], ['calendar', 'calendar'], ['shopping', 'basket']];
const toolViews = [['import', 'upload'], ['export', 'download'], ['settings', 'settings']];
const categories = ['produce', 'grains', 'protein', 'dairy', 'pantry', 'other'];

const storageStatus = model => model.storage?.status || 'ready';
const storageFailed = model => ['error', 'unavailable', 'conflict'].includes(storageStatus(model));
const writeBlocked = model => Boolean(model.busy || storageStatus(model) !== 'ready');

function storageActions(model, language) {
  if (!storageFailed(model)) return '';
  return `<div class="storage-actions">${button(t(language, 'storage.retry'), { action: 'retry-storage', iconName: 'restore', variant: 'secondary', attrs: { disabled: model.busy } })}${model.storage?.hasData ? button(t(language, 'export.downloadBackup'), { action: 'download-backup', iconName: 'download', variant: 'ghost' }) : ''}${model.storage?.rawBackupAvailable ? button(t(language, 'storage.downloadOriginalArchive'), { action: 'download-stored-backup', iconName: 'download', variant: 'secondary' }) : ''}</div>${model.storage?.rawBackupAvailable ? `<p class="storage-original-hint">${escape(t(language, 'storage.originalArchiveHint'))}</p>` : ''}`;
}

function storageBanner(model) {
  const language = model.state.settings.uiLanguage;
  const status = storageStatus(model);
  const failed = storageFailed(model);
  const hint = failed ? 'storage.readOnly' : 'storage.' + status + 'Hint';
  return `<section class="storage-banner${failed ? ' storage-banner--error' : ''}" data-storage-status="${escape(status)}" aria-label="${escape(t(language, 'storage.statusLabel'))}"><div class="storage-status" role="status"><span class="badge">${icon(failed ? 'warning' : status === 'ready' ? 'check' : 'clock')}${escape(t(language, 'storage.' + status))}</span><span>${escape(t(language, hint))}</span></div>${failed && model.storage?.errorKey ? `<p class="storage-error-detail">${escape(t(language, model.storage.errorKey))}</p>` : ''}${storageActions(model, language)}</section>`;
}

/** Small independent slot: connectivity never disables local app operations. */
export function renderPwaStatus(model) {
  if (!model.pwa) return '';
  const language = model.state.settings.uiLanguage;
  const pwa = model.pwa;
  const status = pwa.status || 'checking';
  return `<div class="pwa-status"><span class="pwa-network${pwa.online ? '' : ' is-offline'}" title="${escape(t(language, 'pwa.connectionHint'))}">${icon(pwa.online ? 'globe' : 'leaf')}${escape(t(language, pwa.online ? 'pwa.online' : 'pwa.offline'))}</span><span class="pwa-offline-state pwa-offline-state--${escape(status)}">${icon(status === 'ready' ? 'check' : status === 'error' ? 'info' : 'clock')}${escape(t(language, 'pwa.status.' + status))}</span></div>${pwa.updateAvailable || pwa.updating ? `<div class="pwa-update-banner"><span class="pwa-update-mark">${icon('sparkle')}</span><div class="pwa-update-copy"><strong>${escape(t(language, pwa.updating ? 'pwa.updating' : 'pwa.updateAvailable'))}</strong><p>${escape(t(language, 'pwa.updateHint'))}</p></div>${button(t(language, pwa.updating ? 'pwa.updating' : 'pwa.reviewUpdate'), { action: 'open-update', iconName: 'restore', variant: 'secondary', attrs: { disabled: Boolean(model.busy || pwa.updating) } })}</div>` : ''}`;
}

/** Independent settings slot; lifecycle updates leave other settings forms intact. */
export function renderPwaSettings(model) {
  if (!model.pwa) return '';
  const language = model.state.settings.uiLanguage;
  const pwa = model.pwa;
  const status = pwa.status || 'checking';
  const installMode = pwa.installMode || 'unavailable';
  const persistence = pwa.persistence || 'checking';
  const canPrepare = pwa.supported && pwa.secureContext;
  const busy = Boolean(model.busy || pwa.updating);
  const installInstructions = installMode === 'ios'
    ? `<ol class="pwa-install-steps">${['iosStepOne', 'iosStepTwo', 'iosStepThree'].map(key => `<li>${escape(t(language, 'pwa.' + key))}</li>`).join('')}</ol>`
    : `<p>${escape(t(language, 'pwa.installHints.' + installMode))}</p>`;
  const error = pwa.error ? `<div class="notice notice--error pwa-error" role="status">${icon('info')}<p>${escape(t(language, pwa.error))}</p></div>` : '';
  return `<div class="pwa-settings-heading"><h2>${icon('sparkle')}${escape(t(language, 'pwa.title'))}</h2><p>${escape(t(language, 'pwa.intro'))}</p></div><div class="pwa-cards">
    <section class="pwa-card"><h3>${icon('leaf')}${escape(t(language, 'pwa.offlineTitle'))}</h3><span class="badge${status === 'error' ? ' badge--warning' : ''}">${escape(t(language, 'pwa.status.' + status))}</span><p>${escape(t(language, 'pwa.offlineHints.' + status))}</p>${!pwa.secureContext ? `<p class="pwa-context-hint">${escape(t(language, 'pwa.insecureHint'))}</p>` : ''}<p class="muted small">${escape(t(language, 'pwa.connectionHint'))}</p>${canPrepare && status === 'error' ? button(t(language, 'pwa.retryOffline'), { action: 'retry-offline', iconName: 'restore', variant: 'secondary', attrs: { disabled: busy } }) : ''}</section>
    <section class="pwa-card"><h3>${icon('download')}${escape(t(language, 'pwa.installTitle'))}</h3><span class="badge">${icon(installMode === 'installed' ? 'check' : 'plus')}${escape(t(language, 'pwa.installStates.' + installMode))}</span>${installInstructions}${installMode === 'prompt' ? button(t(language, 'pwa.installButton'), { action: 'install-app', iconName: 'plus', variant: 'primary', attrs: { disabled: busy } }) : ''}</section>
    <section class="pwa-card"><h3>${icon('heart')}${escape(t(language, 'pwa.persistenceTitle'))}</h3><span class="badge badge--neutral">${escape(t(language, 'pwa.persistenceStates.' + persistence))}</span><p>${escape(t(language, 'pwa.persistenceIntro'))}</p><p class="muted small">${escape(t(language, 'pwa.persistenceHints.' + persistence))}</p>${['not-granted', 'error'].includes(persistence) ? button(t(language, 'pwa.requestPersistence'), { action: 'request-persistence', iconName: 'heart', variant: 'secondary', attrs: { disabled: busy } }) : ''}</section>
  </div>${error}<div class="pwa-settings-footer"><div><h3>${escape(t(language, 'pwa.updatesTitle'))}</h3>${pwa.version ? `<p class="muted small">${escape(t(language, 'pwa.version', { version: pwa.version }))}</p>` : ''}</div><div class="pwa-settings-actions">${canPrepare ? button(t(language, pwa.checkingUpdate ? 'pwa.checkingUpdate' : 'pwa.checkUpdate'), { action: 'check-update', iconName: 'restore', variant: 'secondary', attrs: { disabled: Boolean(busy || pwa.checkingUpdate || ['checking', 'preparing'].includes(status)) } }) : ''}${pwa.updateAvailable ? button(t(language, 'pwa.reviewUpdate'), { action: 'open-update', iconName: 'sparkle', variant: 'primary', attrs: { disabled: busy } }) : ''}</div></div><p class="pwa-backup-hint">${icon('file')}<span>${escape(t(language, 'pwa.backupHint'))}</span></p>`;
}

function formatTimestamp(value, language) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return value || '';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(timestamp);
}

function stateSummary(state) {
  const calendarDays = Object.values(state.calendar);
  return {
    plans: Object.keys(state.sourcePlans).length,
    days: calendarDays.length,
    meals: calendarDays.reduce((count, day) => count + day.meals.length, 0),
    manualItems: state.shopping.manualItems.length,
    checkedItems: Object.values(state.shopping.checked).filter(item => item.checked).length
      + state.shopping.manualItems.filter(item => item.checked).length,
    imports: state.imports.length,
  };
}

function replacementSummary(model, language) {
  if (!model.backupDraft) return '';
  const current = model.currentSummary || stateSummary(model.state);
  const incoming = model.backupDraft.summary || stateSummary(model.backupDraft.state);
  const fields = ['plans', 'days', 'meals', 'manualItems', 'checkedItems', 'imports'];
  return `<table class="replacement-table"><caption>${escape(t(language, 'settings.replacement'))}</caption><thead><tr><th scope="col"><span class="visually-hidden">${escape(t(language, 'settings.session'))}</span></th><th scope="col">${escape(t(language, 'settings.currentData'))}</th><th scope="col">${escape(t(language, 'settings.incomingData'))}</th></tr></thead><tbody>${fields.map(key => `<tr><th scope="row">${escape(t(language, 'settings.' + key))}</th><td>${escape(formatNumber(current[key] ?? 0, language))}</td><td>${escape(formatNumber(incoming[key] ?? 0, language))}</td></tr>`).join('')}</tbody></table><p class="muted small">${escape(t(language, 'settings.incomingLanguage', { language: t(language, 'languages.' + model.backupDraft.state.settings.uiLanguage) }))}</p>`;
}

function undoAvailable(model) {
  return Boolean(model.state.lastImportUndo?.importId);
}

function undoButton(model, language) {
  return undoAvailable(model) ? button(t(language, 'import.undo'), {
    action: 'undo-last-import', iconName: 'restore', variant: 'secondary', attrs: { disabled: writeBlocked(model) },
  }) : '';
}

function importHistory(model, language) {
  const records = [...model.state.imports].reverse().sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt));
  return `<section class="panel import-history"><div class="section-heading"><div><h2>${escape(t(language, 'import.history'))}</h2><p class="muted small">${escape(t(language, 'import.historyHint'))}</p></div>${undoButton(model, language)}</div>${undoAvailable(model) ? `<p class="muted small">${escape(t(language, 'import.undoHint'))}</p>` : ''}${records.length ? `<ol class="history-list">${records.map(record => {
    const source = model.state.sourcePlans[record.sourceId];
    const document = source?.document;
    const dates = (record.dayMappings || []).map(day => day.assignedDate).filter(Boolean).sort();
    const startDate = record.startDate || dates[0];
    const endDate = record.endDate || dates.at(-1) || startDate;
    const undone = record.status === 'undone' || Boolean(record.undoneAt);
    return `<li class="history-entry"><div class="history-entry-main"><strong${document?.language ? ` lang="${escape(document.language)}"` : ''}>${escape(document?.title || record.fileName || t(language, 'import.unknownPlan'))}</strong><span class="history-dates">${escape(formatDate(startDate, language, { weekday: undefined }))}${endDate && endDate !== startDate ? ' – ' + escape(formatDate(endDate, language, { weekday: undefined })) : ''}</span><time datetime="${escape(record.importedAt)}">${escape(t(language, 'import.historyImportedAt', { date: formatTimestamp(record.importedAt, language) }))}</time>${record.fileName || source?.fileName ? `<span class="history-file">${escape(record.fileName || source.fileName)}</span>` : ''}${undone && record.undoneAt ? `<span>${escape(t(language, 'import.historyUndoneAt', { date: formatTimestamp(record.undoneAt, language) }))}</span>` : ''}</div><span class="badge${undone ? ' history-undone' : ''}">${icon(undone ? 'restore' : 'check')}${escape(t(language, undone ? 'import.historyUndone' : 'import.historyApplied'))}</span></li>`;
  }).join('')}</ol>` : `<p class="muted">${escape(t(language, 'import.historyEmpty'))}</p>`}</section>`;
}

function localeSelect(language, id) {
  return `<label class="visually-hidden" for="${id}">${escape(t(language, 'settings.language'))}</label><select id="${id}" data-control="language" aria-label="${escape(t(language, 'settings.language'))}">${['it', 'en'].map(value => `<option value="${value}"${value === language ? ' selected' : ''}>${value.toUpperCase()} · ${escape(t(language, 'languages.' + value))}</option>`).join('')}</select>`;
}

function navigation(language, view, mobile = false) {
  return `<nav class="${mobile ? 'bottom-nav' : 'desktop-nav'}" aria-label="${escape(t(language, 'nav.primary'))}">${primaryViews.map(([route, glyph]) => `<a href="#${route}" class="nav-pill${route === view ? ' is-active' : ''}" data-action="navigate" data-view="${route}"${route === view ? ' aria-current="page"' : ''}>${icon(glyph)}<span>${escape(t(language, 'nav.' + route))}</span></a>`).join('')}</nav>`;
}

function pageIntro(language, view, { illustrated = true } = {}) {
  return `<section class="page-intro"><div><p class="eyebrow">${escape(t(language, view + '.eyebrow'))}</p><h1 class="hero-heading" id="page-title" tabindex="-1">${escape(t(language, view + '.title'))}</h1><p class="page-description">${escape(t(language, view + '.intro'))}</p></div>${illustrated ? '<div class="hero-art" aria-hidden="true"><img src="./public/assets/meal-bowl.svg" width="250" height="190" alt=""></div>' : ''}</section>`;
}

function dayNavigation(date, language, { showToday = false, today } = {}) {
  return `<div class="day-navigation">${iconButton('chevronLeft', t(language, 'today.previousDay'), { action: 'step-day', attrs: { 'data-offset': -1 } })}<span class="day-navigation-date">${escape(formatDate(date, language, { year: undefined }))}</span>${iconButton('chevronRight', t(language, 'today.nextDay'), { action: 'step-day', attrs: { 'data-offset': 1 } })}${showToday && date !== today ? button(t(language, 'calendar.today'), { action: 'go-today', variant: 'ghost' }) : ''}</div>`;
}

function dayContent(model, date, { calendar = false } = {}) {
  const language = model.state.settings.uiLanguage;
  const entries = getDayEntries(model.state, date);
  const title = calendar ? formatDate(date, language, { year: undefined }) : t(language, 'today.mealsTitle');
  return `<section class="day-content" aria-labelledby="day-heading"><div class="section-heading"><div><p class="eyebrow">${escape(calendar ? t(language, 'calendar.showing') : formatDate(date, language, { year: undefined }))}</p><h2 id="day-heading" tabindex="-1">${escape(title)}</h2></div>${calendar ? dayNavigation(date, language, { showToday: true, today: model.today }) : button(t(language, 'today.openCalendar'), { action: 'navigate', iconName: 'calendar', variant: 'ghost', attrs: { 'data-view': 'calendar' } })}</div><p class="visually-hidden" role="status">${escape(t(language, 'calendar.dayLoaded', { date: formatDate(date, language), count: entries.length }))}</p>${entries.length ? `${nutritionSummary(entries.map(item => item.meal), language)}<div class="meal-list">${entries.map(item => mealCard(item, language)).join('')}</div>` : emptyState(language, { title: 'today.noMealsTitle', body: 'today.noMeals' })}</section>`;
}

function todayView(model) {
  const language = model.state.settings.uiLanguage;
  return pageIntro(language, 'today') + dayContent(model, model.today);
}

function weekDates(date, startsOn) {
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  const offset = (weekday - startsOn + 7) % 7;
  return Array.from({ length: 7 }, (_, index) => {
    try { return addDays(date, index - offset); } catch { return null; }
  }).filter(Boolean);
}

function dateButton(model, date, language, mobile = false) {
  const selected = date === (model.state.ui.selectedDate || model.today);
  const isToday = date === model.today;
  const hasMeals = (model.state.calendar[date]?.meals?.length || 0) > 0;
  const status = [hasMeals ? t(language, 'calendar.hasMeals') : t(language, 'calendar.noMeals'),
    isToday ? t(language, 'calendar.today') : '', selected ? t(language, 'calendar.selected') : ''].filter(Boolean).join(', ');
  return `<button type="button" id="${mobile ? 'strip' : 'calendar'}-date-${date}" class="calendar-day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}" data-action="select-date" data-date="${date}" aria-pressed="${selected}" aria-label="${escape(t(language, 'calendar.dayLabel', { date: formatDate(date, language), status }))}"${isToday ? ' aria-current="date"' : ''}><span class="calendar-day-number">${escape(formatDate(date, language, { weekday: undefined, month: undefined, year: undefined, day: 'numeric' }))}</span><span class="calendar-day-label">${escape(formatDate(date, language, { weekday: mobile ? 'short' : 'long', month: undefined, year: undefined, day: undefined }))}</span><span class="day-dot${hasMeals ? ' has-meals' : ''}" aria-hidden="true"></span></button>`;
}

function calendarView(model) {
  const language = model.state.settings.uiLanguage;
  const date = model.state.ui.selectedDate || model.today;
  const week = weekDates(date, model.state.settings.weekStartsOn);
  return `${pageIntro(language, 'calendar', { illustrated: false })}<div class="calendar-layout"><aside class="calendar-rail" aria-label="${escape(t(language, 'calendar.selectDay'))}"><div class="month-navigation">${iconButton('chevronLeft', t(language, 'calendar.previousWeek'), { action: 'step-day', attrs: { 'data-offset': -7 } })}<strong>${escape(formatDate(date, language, { weekday: undefined, day: undefined, month: 'short' }))}</strong>${iconButton('chevronRight', t(language, 'calendar.nextWeek'), { action: 'step-day', attrs: { 'data-offset': 7 } })}</div><div class="calendar-grid" aria-label="${escape(t(language, 'calendar.browseDays'))}">${week.map(day => dateButton(model, day, language)).join('')}</div><div class="mobile-date-strip" aria-label="${escape(t(language, 'calendar.browseDays'))}">${week.map(day => dateButton(model, day, language, true)).join('')}</div><div class="calendar-jump field"><label for="selected-date">${escape(t(language, 'calendar.jumpDate'))}</label><input id="selected-date" type="date" data-control="selected-date" value="${escape(date)}"></div><p class="calendar-legend"><span class="day-dot has-meals" aria-hidden="true"></span>${escape(t(language, 'calendar.legend'))}</p></aside><div class="calendar-content">${dayContent(model, date, { calendar: true })}</div></div>`;
}

function shoppingFilters(model, language) {
  const { mode, range } = model.state.shopping;
  return `<section class="panel filter-card"><h2>${escape(t(language, 'shopping.period'))}</h2><div class="date-range"><div class="field"><label for="shopping-start">${escape(t(language, 'shopping.from'))}</label><input type="date" id="shopping-start" data-control="shopping-start" value="${escape(range.startDate || '')}"></div><div class="field"><label for="shopping-end">${escape(t(language, 'shopping.to'))}</label><input type="date" id="shopping-end" data-control="shopping-end" value="${escape(range.endDate || '')}"></div></div><p class="muted small">${escape(t(language, 'shopping.included'))}</p><p class="muted small shopping-period-hint">${escape(t(language, 'shopping.periodHint'))}</p><fieldset class="mode-switch"><legend>${escape(t(language, 'shopping.mode'))}</legend>${['one', 'two', 'advanced'].map(value => `<label class="mode-option${mode === value ? ' is-selected' : ''}"><input type="radio" name="shopping-mode" data-control="shopping-mode" value="${value}"${mode === value ? ' checked' : ''}><span>${icon(value === 'one' ? 'person' : value === 'two' ? 'people' : 'settings')}<strong>${escape(t(language, 'shopping.modes.' + value))}</strong><small>${escape(t(language, 'shopping.modeHints.' + value))}</small></span></label>`).join('')}</fieldset><p class="muted small">${escape(t(language, 'shopping.modeHint'))}</p><p class="muted small">${escape(t(language, 'shopping.listHint'))}</p></section>`;
}

function isShoppingChecked(item, state) {
  return !item.reopened && Boolean(item.checked ?? state.shopping.checked[item.key]?.checked);
}

function shoppingRow(item, language, state, index, { manual = false } = {}) {
  const reopened = !manual && Boolean(item.reopened);
  const checked = manual ? Boolean(item.checked) : isShoppingChecked(item, state);
  const id = manual ? 'manual-check-' + item.itemId : 'shopping-check-' + encodeURIComponent(item.key);
  const controlAttributes = manual ? { 'data-control': 'manual-check', 'data-item-id': item.itemId } : { 'data-control': 'shopping-check', 'data-key': item.key };
  const quantity = item.quantity == null ? '—' : formatShoppingAmount(item.quantity, item.unit, language);
  const previous = typeof item.previousQuantity === 'number' && Number.isFinite(item.previousQuantity)
    ? formatShoppingAmount(item.previousQuantity, item.unit, language) : null;
  return `<li class="shopping-row${checked ? ' is-checked' : ''}${reopened ? ' is-reopened' : ''}"><label for="${escape(id)}" class="shopping-check-label"><input type="checkbox" id="${escape(id)}"${attributes(controlAttributes)}${checked ? ' checked' : ''}><span class="shopping-item-name">${escape(item.name)}${manual ? `<small>${escape(codeLabel('categories', item.category || 'other', language))}</small>${item.quantity == null ? `<small>${escape(t(language, 'shopping.legacyQuantity'))}</small>` : ''}` : ''}${item.basis ? `<small>${escape(codeLabel('basis', item.basis, language))}</small>` : ''}${reopened ? `<span class="shopping-reopened-badge">${icon('plus')}${escape(t(language, 'shopping.reopenedTitle'))}</span><small class="shopping-reopened-detail">${escape(previous ? t(language, 'shopping.reopenedDetail', { previous, required: quantity }) : t(language, 'shopping.reopenedHint'))}</small>` : ''}</span><span class="quantity"${item.quantity == null ? ` aria-label="${escape(t(language, 'shopping.legacyQuantity'))}" title="${escape(t(language, 'shopping.legacyQuantity'))}"` : ''}>${escape(quantity)}</span></label>${manual ? iconButton('trash', t(language, 'shopping.remove', { name: item.name }), { action: 'remove-manual', attrs: { 'data-item-id': item.itemId } }) : ''}</li>`;
}

function manualItems(model, language) {
  const items = groupShoppingItems(model.state.shopping.manualItems, language).flatMap(group => group.items);
  const draft = model.manualDraft || { name: '', quantity: '', unit: 'unit', category: 'other', customUnit: '' };
  const customUnit = draft.unit === 'custom';
  return `<section class="panel manual-panel"><div class="section-heading"><div><h2>${escape(t(language, 'shopping.manual'))}</h2><p class="muted small">${escape(t(language, 'shopping.manualHint'))}</p></div>${icon('plus')}</div>
    ${items.length ? `<ul class="shopping-items manual-items">${items.map((item, index) => shoppingRow(item, language, model.state, index, { manual: true })).join('')}</ul>` : `<p class="muted">${escape(t(language, 'shopping.manualEmpty'))}</p>`}
    <form class="manual-form" data-form="manual-item">
      <div class="field manual-name"><label for="manual-name">${escape(t(language, 'shopping.name'))}</label><input id="manual-name" name="name" type="text" value="${escape(draft.name)}" placeholder="${escape(t(language, 'shopping.namePlaceholder'))}" autocomplete="off" required></div>
      <div class="field"><label for="manual-quantity">${escape(t(language, 'shopping.quantity'))}</label><input id="manual-quantity" name="quantity" type="number" min="0" step="any" inputmode="decimal" value="${escape(draft.quantity)}" placeholder="1" required></div>
      <div class="field"><label for="manual-unit">${escape(t(language, 'shopping.unit'))}</label><select id="manual-unit" name="unit">${['unit', 'g', 'kg', 'ml', 'l'].map(value => `<option value="${value}"${value === draft.unit ? ' selected' : ''}>${escape(codeLabel('units', value, language))}</option>`).join('')}<option value="custom"${customUnit ? ' selected' : ''}>${escape(t(language, 'shopping.customUnit'))}</option></select></div>
      <div class="field manual-category"><label for="manual-category">${escape(t(language, 'shopping.category'))}</label><select id="manual-category" name="category">${categories.map(value => `<option value="${value}"${value === draft.category ? ' selected' : ''}>${escape(codeLabel('categories', value, language))}</option>`).join('')}</select></div>
      <div class="field manual-custom-unit"${customUnit ? '' : ' hidden'}><label for="manual-custom-unit">${escape(t(language, 'shopping.customUnitLabel'))}</label><input id="manual-custom-unit" name="customUnit" type="text" value="${escape(draft.customUnit || '')}" placeholder="${escape(t(language, 'shopping.customUnitPlaceholder'))}"${customUnit ? ' required' : ' disabled'}></div>
      <p class="muted small manual-quantity-hint">${escape(t(language, 'shopping.quantityHint'))}</p>
      <button class="button primary" type="submit"${writeBlocked(model) ? ' disabled' : ''}>${icon('plus')}<span>${escape(t(language, 'shopping.add'))}</span></button>
    </form>
  </section>`;
}

function shoppingPresentation(model) {
  const { startDate, endDate } = model.state.shopping.range;
  const ready = Boolean(startDate && endDate && endDate >= startDate);
  let error = model.shoppingError || (startDate && endDate && endDate < startDate ? 'shopping.invalidRange' : null);
  let items = [], mealCount = 0;
  if (!error) {
    try {
      items = model.shoppingRows ?? (ready ? getShoppingItems(model.state).map(item => ({
        ...item, checked: Boolean(model.state.shopping.checked[item.key]?.checked), reopened: false,
      })) : []);
      mealCount = model.shoppingSummary?.mealCount ?? (ready ? getRangeEntries(model.state, startDate, endDate).length : 0);
    } catch {
      error = 'errors.shoppingCalculation';
      items = [];
    }
  }
  const manual = model.state.shopping.manualItems;
  const defaults = {
    mealCount, generatedCount: items.length, manualCount: manual.length,
    checkedCount: items.filter(item => isShoppingChecked(item, model.state)).length + manual.filter(item => item.checked).length,
    totalCount: items.length + manual.length, reopenedCount: items.filter(item => item.reopened).length,
  };
  return { items, error, ready, summary: error ? defaults : { ...defaults, ...model.shoppingSummary } };
}

function shoppingToolbar(model, language, presentation) {
  const { summary, ready, error } = presentation;
  const { startDate, endDate } = model.state.shopping.range;
  const unavailable = Boolean(error || summary.totalCount === 0);
  const period = ready ? t(language, 'shopping.selectedDates', {
    start: formatDate(startDate, language, { weekday: undefined }),
    end: formatDate(endDate, language, { weekday: undefined }),
  }) : t(language, 'shopping.rangeUnselected');
  return `<section class="panel shopping-toolbar"><div class="shopping-toolbar-heading"><div><h2>${escape(t(language, 'shopping.exportTitle'))}</h2><p class="shopping-toolbar-period">${icon('calendar')}${escape(period)}</p></div><div class="shopping-export-actions">
      ${button(t(language, 'shopping.copy'), { action: 'copy-shopping', iconName: 'file', variant: 'primary', attrs: { disabled: unavailable } })}
      ${button(t(language, 'shopping.download'), { action: 'download-shopping', iconName: 'download', variant: 'secondary', attrs: { disabled: unavailable } })}
    </div></div><p class="muted small">${escape(t(language, 'shopping.exportHint'))}</p>
    <div class="shopping-summary"><div class="shopping-counts">${!error ? `<span class="badge">${escape(t(language, 'shopping.generatedCount', { count: summary.generatedCount }))}</span>` : ''}<span class="badge">${escape(t(language, 'shopping.manualCount', { count: summary.manualCount }))}</span></div>${!error ? `<strong>${escape(t(language, 'shopping.progress', { checked: summary.checkedCount, total: summary.totalCount }))}</strong>` : ''}</div>
    ${summary.totalCount > 0 && !error ? `<div class="shopping-progress" role="progressbar" aria-label="${escape(t(language, 'shopping.list'))}" aria-valuemin="0" aria-valuemax="${summary.totalCount}" aria-valuenow="${summary.checkedCount}" aria-valuetext="${escape(t(language, 'shopping.progress', { checked: summary.checkedCount, total: summary.totalCount }))}"><span style="width:${Math.round(summary.checkedCount / summary.totalCount * 100)}%"></span></div><p class="muted small">${escape(t(language, 'shopping.progressHint'))}</p>` : ''}
  </section>`;
}

function shoppingView(model) {
  const language = model.state.settings.uiLanguage;
  const { startDate, endDate } = model.state.shopping.range;
  const presentation = shoppingPresentation(model);
  const { items, error, summary } = presentation;
  const groups = groupShoppingItems(items, language);
  const list = error
    ? `<section class="panel shopping-error" role="alert">${icon('warning')}<h2>${escape(t(language, 'shopping.calculationErrorTitle'))}</h2><p>${escape(t(language, error))}</p></section>`
    : items.length ? `<div class="section-heading"><div><h2>${escape(t(language, 'shopping.generated'))}</h2><p class="muted small">${escape(t(language, 'shopping.selectedMeals', { count: summary.mealCount }))}</p></div></div>
      ${summary.reopenedCount ? `<div class="notice notice--warning shopping-reopened-summary" role="status">${icon('warning')}<p>${escape(t(language, 'shopping.reopenedSummary', { count: summary.reopenedCount }))}</p></div>` : ''}
      ${groups.map(group => `<section class="shopping-group"><h3>${icon(group.category === 'produce' ? 'leaf' : group.category === 'pantry' ? 'basket' : 'bowl')}${escape(group.label)}<span>${group.items.length}</span></h3><ul class="shopping-items">${group.items.map((item, index) => shoppingRow(item, language, model.state, index)).join('')}</ul></section>`).join('')}`
      : emptyState(language, { title: 'shopping.emptyTitle', body: !startDate || !endDate ? 'shopping.noRange' : 'shopping.empty', action: false, illustration: 'snack' });
  return `${pageIntro(language, 'shopping', { illustrated: false })}${shoppingToolbar(model, language, presentation)}<div class="shopping-layout"><aside>${shoppingFilters(model, language)}</aside><div class="shopping-content"><section class="shopping-list-panel">${list}</section>${manualItems(model, language)}</div></div>`;
}

function planSummary(document, language) {
  const count = document.days.reduce((sum, day) => sum + day.meals.length, 0);
  return `<div class="plan-summary"><span class="plan-symbol">${icon('file')}</span><div><h2 lang="${escape(document.language)}">${escape(document.title)}</h2><div class="plan-badges"><span class="badge">${escape(t(language, 'app.days', { count: document.days.length }))}</span><span class="badge">${escape(t(language, 'app.meals', { count }))}</span><span class="badge">${icon('globe')}${escape(planLanguageLabel(document.language, language))}</span></div></div></div>`;
}

function assignmentDates(dates, language, key) {
  if (!dates?.length) return `<p class="muted small">${escape(t(language, 'import.noAssignments'))}</p>`;
  return `<details class="mapping-details"><summary>${escape(t(language, key))}</summary><ul class="assignment-dates">${dates.map(date => `<li>${escape(formatDate(date, language, { weekday: undefined }))}</li>`).join('')}</ul></details>`;
}

function duplicatePreview(draft, language) {
  const mapping = draft.preview;
  if (!mapping) return '';
  if (mapping.noOp) {
    return `<div class="notice notice--info"><div><p>${escape(t(language, 'import.alreadyAssigned'))}</p>${button(t(language, 'import.openAssigned'), { action: 'select-date', iconName: 'calendar', variant: 'ghost', attrs: { 'data-date': mapping.startDate } })}</div></div>`;
  }
  if (mapping.duplicate) {
    return `<div class="duplicate-notice"><h3>${icon('file')}${escape(t(language, 'import.duplicateTitle'))}</h3><p>${escape(t(language, 'import.duplicateHint'))}</p>${assignmentDates(mapping.existingAssignmentDates, language, 'import.existingAssignments')}<label class="confirmation-check" for="import-duplicate-confirmed"><input type="checkbox" id="import-duplicate-confirmed" data-control="import-duplicate-confirmed"${draft.duplicateConfirmed ? ' checked' : ''}><span>${escape(t(language, 'import.duplicateConfirm'))}</span></label></div>`;
  }
  return mapping.revision ? `<div class="duplicate-notice"><h3>${icon('file')}${escape(t(language, 'import.revisionTitle'))}</h3><p>${escape(t(language, 'import.revisionHint'))}</p>${assignmentDates(mapping.samePlanAssignmentDates, language, 'import.previousAssignments')}</div>` : '';
}

function importView(model) {
  const language = model.state.settings.uiLanguage;
  const draft = model.importDraft;
  const picker = `<section class="panel import-picker" data-dropzone="diet" aria-label="${escape(t(language, 'import.choose'))}">
    <div class="upload-illustration">${icon('upload')}</div><h2>${escape(t(language, 'import.drop'))}</h2>
    <p class="muted">${escape(t(language, 'import.accepted'))}</p>
    <div class="file-picker"><input class="visually-hidden" type="file" id="diet-file" data-control="diet-file" accept=".diet,.json,application/json"><label for="diet-file" class="button primary">${icon('file')}<span>${escape(t(language, 'import.choose'))}</span></label></div>
    <p class="muted small">${escape(t(language, 'import.local'))}</p><span class="picker-divider">${escape(t(language, 'import.divider'))}</span>
    ${button(t(language, 'import.tryDemo'), { action: 'load-demo-import', iconName: 'sparkle', variant: 'secondary', attrs: { disabled: model.busy } })}
  </section>`;
  let preview = emptyState(language, { title: 'import.emptyTitle', body: 'import.emptyHint', action: false });
  if (draft?.error && !draft.document) {
    preview = `<section class="panel import-error" role="alert">${icon('warning')}<h2>${escape(t(language, 'errors.invalidDiet'))}</h2><p>${escape(t(language, draft.error))}</p>${draft.fileName ? `<p class="muted">${escape(draft.fileName)}</p>` : ''}${button(t(language, 'import.cancel'), { action: 'cancel-import', variant: 'ghost' })}</section>`;
  } else if (draft?.document) {
    const document = draft.document, mapping = draft.preview;
    const canImport = Boolean(mapping && !draft.error && draft.dateConfirmed
      && (!mapping.duplicate || draft.duplicateConfirmed) && !mapping.noOp && !writeBlocked(model));
    preview = `<section class="panel import-preview">
      ${draft.error ? `<p class="notice notice--error" role="alert">${icon('warning')}${escape(t(language, draft.error))}</p>` : ''}
      <p class="eyebrow">${escape(t(language, 'import.preview'))}</p>${planSummary(document, language)}
      <p class="muted small">${escape(t(language, 'import.perPerson'))}</p>
      <dl class="detail-pairs"><div><dt>${escape(t(language, 'import.file'))}</dt><dd>${escape(draft.fileName || '')}</dd></div><div><dt>${escape(t(language, 'import.suggestedDate'))}</dt><dd>${escape(formatDate(document.suggestedStartDate, language, { weekday: undefined }))}</dd></div></dl>
      <div class="field import-start-field"><label for="import-start">${escape(t(language, 'import.startDate'))}</label><input id="import-start" type="date" data-control="import-start" value="${escape(draft.startDate ?? document.suggestedStartDate)}" aria-describedby="import-date-hint" required><small id="import-date-hint">${escape(t(language, 'import.confirmDateHint'))}</small></div>
      ${mapping ? `<div class="import-date-summary">${icon('calendar')}<div><span>${escape(t(language, 'import.assigned'))}</span><strong>${escape(formatDate(mapping.startDate, language, { weekday: undefined }))} – ${escape(formatDate(mapping.endDate, language, { weekday: undefined }))}</strong></div></div>
      <label class="confirmation-check" for="import-date-confirmed"><input type="checkbox" id="import-date-confirmed" data-control="import-date-confirmed"${draft.dateConfirmed ? ' checked' : ''}><span>${escape(t(language, 'import.confirmDate', { date: formatDate(mapping.startDate, language, { weekday: undefined }) }))}</span></label>
      <details class="mapping-details"><summary>${escape(t(language, 'import.mapping'))}</summary><table class="mapping-table"><thead><tr><th scope="col">${escape(t(language, 'import.originalDate'))}</th><th scope="col">${escape(t(language, 'import.assignedDate'))}</th></tr></thead><tbody>${mapping.dayMappings.map(day => `<tr><td>${escape(formatDate(day.sourceDate, language, { weekday: undefined, year: undefined }))}</td><td>${escape(formatDate(day.assignedDate, language, { weekday: undefined, year: undefined }))}</td></tr>`).join('')}</tbody></table></details>
      ${duplicatePreview(draft, language)}
      ${mapping.overlaps.length && !mapping.noOp ? `<div class="overlap-warning" role="note"><h3>${icon('warning')}${escape(t(language, 'import.overlapTitle'))}</h3><p>${escape(t(language, 'import.overlapHint'))}</p><ul>${mapping.overlaps.map(date => `<li>${escape(formatDate(date, language, { year: undefined }))}</li>`).join('')}</ul></div>` : !mapping.noOp ? `<p class="ready-message">${icon('check')}${escape(t(language, 'import.ready'))}</p>` : ''}` : ''}
      <div class="panel-actions">${button(t(language, 'import.confirm'), { action: 'confirm-import', iconName: 'calendar', variant: 'primary', attrs: { disabled: !canImport } })}${button(t(language, 'import.cancel'), { action: 'cancel-import', variant: 'ghost' })}</div>
    </section>`;
  }
  return `${pageIntro(language, 'import', { illustrated: false })}<div class="import-layout">${picker}${preview}</div>${importHistory(model, language)}`;
}

function backupCard(model, language) {
  const summary = model.currentSummary || stateSummary(model.state);
  return `<section class="panel export-card backup-card"><span class="export-art">${icon('restore')}</span><span class="badge">${escape(t(language, 'export.backupBadge'))}</span><h2>${escape(t(language, 'export.backup'))}</h2><p>${escape(t(language, 'export.backupHint'))}</p><p class="muted">${escape(t(language, 'export.backupStats', summary))}</p><p class="muted small">${escape(t(language, 'export.backupVersion'))}</p>${button(t(language, 'export.downloadBackup'), { action: 'download-backup', iconName: 'download', variant: 'primary' })}</section>`;
}

function exportView(model) {
  const language = model.state.settings.uiLanguage;
  const sources = Object.values(model.state.sourcePlans);
  const selected = sources.find(source => source.sourceId === model.exportSourceId) || sources[0];
  const range = model.exportRange || { startDate: null, endDate: null };
  const preview = model.exportPreview;
  const plan = selected ? `<section class="panel export-card original-card">
    <span class="export-art">${icon('file')}</span><span class="badge">${escape(t(language, 'export.calendarBadge'))}</span>
    <h2>${escape(t(language, 'export.plan'))}</h2><p>${escape(t(language, 'export.planHint'))}</p>
    <div class="field"><label for="export-source">${escape(t(language, 'export.planSelect'))}</label><select id="export-source" data-control="export-source">${sources.map(source => `<option value="${escape(source.sourceId)}" lang="${escape(source.document.language)}"${source.sourceId === selected.sourceId ? ' selected' : ''}>${escape(source.document.title)}</option>`).join('')}</select></div>
    <fieldset class="export-range"><legend>${escape(t(language, 'export.range'))}</legend><div class="date-range">
      <div class="field"><label for="export-start">${escape(t(language, 'export.from'))}</label><input id="export-start" type="date" data-control="export-start" value="${escape(range.startDate || '')}"></div>
      <div class="field"><label for="export-end">${escape(t(language, 'export.to'))}</label><input id="export-end" type="date" data-control="export-end" value="${escape(range.endDate || '')}"></div>
    </div></fieldset>
    ${model.exportError ? `<p class="notice notice--error" role="alert">${escape(t(language, model.exportError))}</p>` : preview?.mealCount ? `<div class="export-preview" role="status"><p>${escape(formatDate(preview.startDate, language, { weekday: undefined }))} – ${escape(formatDate(preview.endDate, language, { weekday: undefined }))}</p><div class="plan-badges"><span class="badge">${escape(t(language, 'app.days', { count: preview.dayCount }))}</span><span class="badge">${escape(t(language, 'app.meals', { count: preview.mealCount }))}</span></div></div>` : `<p class="muted export-empty" role="status">${escape(t(language, 'export.emptyRange'))}</p>`}
    <p class="muted small">${escape(t(language, 'export.currentCalendar'))}</p>
    ${button(t(language, 'export.downloadPlan'), { action: 'export-plan', iconName: 'download', variant: 'primary', attrs: { 'data-source-id': selected.sourceId, disabled: !preview?.mealCount || Boolean(model.exportError) } })}
    <div class="original-download"><h3>${escape(t(language, 'export.original'))}</h3><p class="muted small">${escape(t(language, 'export.originalHint'))}</p>${button(t(language, 'export.downloadOriginal'), { action: 'export-original', iconName: 'download', variant: 'ghost', attrs: { 'data-source-id': selected.sourceId } })}</div>
  </section>` : `<section class="panel export-card">${emptyState(language, { title: 'export.noPlansTitle', body: 'export.noPlans' })}</section>`;
  return `${pageIntro(language, 'export', { illustrated: false })}<div class="export-layout">${plan}${backupCard(model, language)}</div>`;
}

function settingsView(model) {
  const language = model.state.settings.uiLanguage;
  const settings = model.state.settings;
  const recovery = model.storage?.recoveryAvailable;
  return `${pageIntro(language, 'settings', { illustrated: false })}<div class="settings-layout">
    <section class="panel settings-panel"><h2>${icon('settings')}${escape(t(language, 'settings.appearance'))}</h2>
      <div class="setting-row"><div><label for="settings-language">${escape(t(language, 'settings.language'))}</label><p>${escape(t(language, 'settings.languageHint'))}</p></div><div>${localeSelect(language, 'settings-language')}</div></div>
      <div class="setting-row"><div><label for="reduced-motion">${escape(t(language, 'settings.motion'))}</label><p>${escape(t(language, 'settings.motionHint'))}</p></div><label class="switch"><input type="checkbox" id="reduced-motion" data-control="reduced-motion"${settings.reducedMotion ? ' checked' : ''}><span aria-hidden="true"></span><span class="visually-hidden">${escape(t(language, 'settings.motion'))}</span></label></div>
      <div class="setting-row"><label for="week-starts">${escape(t(language, 'settings.week'))}</label><select id="week-starts" data-control="week-starts"><option value="1"${settings.weekStartsOn === 1 ? ' selected' : ''}>${escape(t(language, 'settings.monday'))}</option><option value="0"${settings.weekStartsOn === 0 ? ' selected' : ''}>${escape(t(language, 'settings.sunday'))}</option></select></div>
    </section>
    <section class="panel settings-panel"><h2>${icon('restore')}${escape(t(language, 'settings.backups'))}</h2><p>${escape(t(language, 'settings.backupsHint'))}</p>
      <div class="backup-actions">${button(t(language, 'settings.downloadBackup'), { action: 'download-backup', iconName: 'download', variant: 'secondary' })}<div class="file-picker"><input type="file" id="backup-file" data-control="backup-file" accept=".json,application/json" class="visually-hidden"><label for="backup-file" class="button ghost">${icon('upload')}<span>${escape(t(language, 'settings.restore'))}</span></label></div></div>
      <p class="muted small">${escape(t(language, 'settings.restoreHint'))}</p>
      ${model.backupDraft ? `<div class="backup-preview"><strong>${escape(t(language, 'settings.readyToRestore', { file: model.backupDraft.fileName }))}</strong>${replacementSummary(model, language)}<p class="muted small">${escape(t(language, 'settings.restorePreserves'))}</p><div class="panel-actions">${button(t(language, 'settings.restoreNow'), { action: 'request-restore', iconName: 'restore', variant: 'primary', attrs: { disabled: writeBlocked(model) } })}${button(t(language, 'settings.cancelRestore'), { action: 'cancel-restore', variant: 'ghost' })}</div></div>` : ''}
      ${recovery ? `<div class="recovery-card"><h3>${escape(t(language, 'storage.recovery'))}</h3><p>${escape(t(language, 'storage.recoveryHint'))}</p>${button(t(language, 'storage.downloadRecovery'), { action: 'download-recovery', iconName: 'download', variant: 'secondary' })}</div>` : ''}
    </section>
    <section class="panel pwa-settings" data-pwa-settings>${renderPwaSettings(model)}</section>
    <section class="panel settings-panel session-panel"><div class="section-heading"><h2>${icon('file')}${escape(t(language, 'storage.title'))}</h2><span class="badge">${escape(t(language, 'storage.' + storageStatus(model)))}</span></div>
      <p>${escape(t(language, 'storage.localHint'))}</p>
      ${storageFailed(model) ? `<p class="storage-error-detail">${escape(t(language, model.storage?.errorKey || 'storage.readOnly'))}</p>${storageActions(model, language)}` : ''}
      ${undoAvailable(model) ? `<div class="undo-card"><p>${escape(t(language, 'import.undoHint'))}</p>${undoButton(model, language)}</div>` : ''}
      <div class="session-actions">${button(t(language, 'settings.reset'), { action: 'reset-demo', iconName: 'restore', variant: 'secondary', attrs: { disabled: writeBlocked(model) } })}${button(t(language, 'settings.clear'), { action: 'clear-session', iconName: 'trash', variant: 'danger', attrs: { disabled: writeBlocked(model) } })}</div>
    </section>
  </div>`;
}

function dialogNotice(model) {
  if (!model.notice && !storageFailed(model)) return '';
  const language = model.state.settings.uiLanguage;
  const notice = model.notice || { type: 'error', key: model.storage.errorKey || 'storage.readOnly' };
  return `<div class="notice notice--${notice.type === 'error' ? 'error' : 'success'}" role="${notice.type === 'error' ? 'alert' : 'status'}">${icon(notice.type === 'error' ? 'warning' : 'check')}<div><p>${escape(t(language, notice.key, notice.params || {}))}</p>${storageActions(model, language)}</div></div>`;
}

function shoppingCopyDialog(model) {
  const language = model.state.settings.uiLanguage;
  const text = model.shoppingCopyText || '';
  return `<dialog id="app-dialog" class="modal shopping-copy-modal" aria-labelledby="dialog-title" aria-describedby="shopping-copy-hint"><div class="modal-header"><h2 id="dialog-title">${escape(t(language, 'shopping.copyTitle'))}</h2>${iconButton('close', t(language, 'app.close'), { action: 'close-dialog' })}</div><div class="modal-body">${dialogNotice(model)}<p id="shopping-copy-hint">${escape(t(language, 'shopping.copyFallback'))}</p><label class="visually-hidden" for="shopping-copy-text">${escape(t(language, 'shopping.copyTextLabel'))}</label><textarea id="shopping-copy-text" class="shopping-copy-text" lang="${language}" aria-describedby="shopping-copy-hint" rows="14" readonly spellcheck="false" autofocus>${escape(text)}</textarea></div><div class="modal-footer">${button(t(language, 'shopping.selectText'), { action: 'select-shopping-text', variant: 'primary', attrs: { disabled: !text } })}${button(t(language, 'shopping.download'), { action: 'download-shopping', iconName: 'download', variant: 'secondary', attrs: { disabled: !text } })}${button(t(language, 'app.close'), { action: 'close-dialog', variant: 'ghost' })}</div></dialog>`;
}

function appUpdateDialog(model) {
  const language = model.state.settings.uiLanguage;
  const pwa = model.pwa || {};
  const working = Boolean(model.busy || model.loading || ['loading', 'saving'].includes(storageStatus(model)));
  const blocked = Boolean(working || pwa.updating || !pwa.updateAvailable);
  return `<dialog id="app-dialog" class="modal confirmation-modal pwa-update-modal" aria-labelledby="dialog-title" aria-describedby="pwa-update-description"><div class="modal-header"><h2 id="dialog-title">${escape(t(language, 'pwa.updateTitle'))}</h2>${iconButton('close', t(language, 'app.close'), { action: 'close-dialog' })}</div><div class="modal-body">${dialogNotice(model)}<span class="confirm-symbol pwa-update-symbol">${icon('sparkle')}</span><p id="pwa-update-description">${escape(t(language, 'pwa.updateDescription'))}</p><ul class="pwa-update-details"><li>${escape(t(language, 'pwa.updateSaved'))}</li><li>${escape(t(language, 'pwa.updateDrafts'))}</li></ul><div class="pwa-update-backup"><p>${escape(t(language, 'pwa.updateBackup'))}</p>${button(t(language, 'export.downloadBackup'), { action: 'download-backup', iconName: 'download', variant: 'secondary', attrs: { disabled: !model.storage?.hasData } })}</div>${pwa.error ? `<div class="notice notice--error" role="status">${icon('info')}<p>${escape(t(language, pwa.error))}</p></div>` : ''}<p class="pwa-update-progress" data-pwa-update-progress role="status"${pwa.updating || working || !pwa.updateAvailable ? '' : ' hidden'}>${escape(pwa.updating ? t(language, 'pwa.updating') : working ? t(language, 'pwa.updateBusy') : !pwa.updateAvailable ? t(language, 'pwa.updateMissing') : '')}</p></div><div class="modal-footer">${button(t(language, 'app.cancel'), { action: 'close-dialog', variant: 'secondary', attrs: { autofocus: true } })}${button(t(language, pwa.updating ? 'pwa.updating' : 'pwa.applyUpdate'), { action: 'apply-app-update', iconName: 'restore', variant: 'primary', attrs: { disabled: blocked } })}</div></dialog>`;
}

/** Inner HTML for the stable move preview; updating it never replaces the form. */
export function renderMealMoveFeedback(model) {
  if (model.dialog?.kind !== 'meal') return '';
  const item = findEntry(model.state, model.dialog.entryId);
  if (!item) return '';
  const language = model.state.settings.uiLanguage;
  const draft = model.mealMoveDraft?.entryId === item.entry.entryId ? model.mealMoveDraft : null;
  const targetDate = draft?.date ?? item.date;
  const otherMeals = targetDate !== item.date
    ? (model.state.calendar[targetDate]?.meals || []).filter(entry => entry.entryId !== item.entry.entryId).length : 0;
  return `${otherMeals ? `<p id="meal-move-target" class="meal-move-target">${icon('info')}${escape(t(language, 'meal.destinationOccupied', { count: otherMeals, date: formatDate(targetDate, language, { weekday: undefined }) }))}</p>` : ''}${draft?.error ? `<p id="meal-date-error" class="notice notice--error" role="alert">${escape(t(language, draft.error))}</p>` : ''}`;
}

function mealMoveForm(model, item, language) {
  const draft = model.mealMoveDraft?.entryId === item.entry.entryId ? model.mealMoveDraft : null;
  const targetDate = draft?.date ?? item.date;
  return `<form class="meal-move-form" data-form="move-meal" data-entry-id="${escape(item.entry.entryId)}" novalidate><p class="meal-current-date">${icon('calendar')}${escape(t(language, 'meal.currentDate', { date: formatDate(item.date, language, { weekday: undefined }) }))}</p><div class="field"><label for="meal-date">${escape(t(language, 'meal.date'))}</label><input id="meal-date" name="date" type="date" data-control="meal-date" data-entry-id="${escape(item.entry.entryId)}" value="${escape(targetDate)}" aria-describedby="meal-date-hint meal-move-feedback"${draft?.error ? ' aria-invalid="true"' : ''} required></div><button type="submit" class="button secondary"${writeBlocked(model) || !targetDate || targetDate === item.date ? ' disabled' : ''}>${icon('calendar')}<span>${escape(t(language, 'meal.move'))}</span></button><p id="meal-date-hint" class="muted small">${escape(t(language, 'meal.moveHint'))}</p><div id="meal-move-feedback" style="grid-column:1 / -1" aria-live="polite">${renderMealMoveFeedback(model)}</div></form>`;
}

function mealDialog(model) {
  const language = model.state.settings.uiLanguage;
  const item = findEntry(model.state, model.dialog.entryId);
  if (!item) return '';
  const { meal, source, entry, time, date, cookingServings } = item;
  const documentLanguage = source.document.language;
  let scaled;
  try { scaled = scaleIngredients(meal.ingredients, cookingServings); }
  catch (error) {
    if (error?.code !== 'SHOPPING_NONFINITE_QUANTITY') throw error;
    scaled = null;
  }
  return `<dialog id="app-dialog" class="modal meal-modal" aria-labelledby="dialog-title"><div class="modal-header"><div><span class="eyebrow">${escape(codeLabel('mealTypes', meal.type, language))} · ${escape(formatDate(date, language, { weekday: undefined, year: undefined }))}</span><h2 id="dialog-title" lang="${escape(documentLanguage)}">${escape(meal.title)}</h2></div>${iconButton('close', t(language, 'app.close'), { action: 'close-dialog', attrs: { autofocus: true } })}</div><div class="modal-body">${dialogNotice(model)}<div class="meal-detail-hero"><div class="meal-detail-art">${foodArt(meal.type)}</div><div><p class="muted small">${escape(t(language, 'meal.sourcePlan'))}</p><p lang="${escape(documentLanguage)}">${escape(source.document.title)}</p>${typeof meal.prepMinutes === 'number' ? `<span class="badge">${icon('clock')}${escape(t(language, 'meal.prepTime', { count: formatNumber(meal.prepMinutes, language) }))}</span>` : ''}</div></div>${mealMoveForm(model, item, language)}<div class="meal-controls"><div class="field"><label for="meal-time">${escape(t(language, 'meal.time'))}</label><input type="time" id="meal-time" data-control="meal-time" data-entry-id="${escape(entry.entryId)}" value="${escape(time)}" required><small>${escape(t(language, 'meal.scheduleHint'))}</small></div><div class="field"><label for="meal-servings">${escape(t(language, 'meal.people'))}</label><div class="serving-control">${iconButton('minus', t(language, 'meal.less'), { action: 'change-servings', attrs: { 'data-entry-id': entry.entryId, 'data-delta': -1, disabled: cookingServings <= 1, id: 'meal-servings-less' } })}<input id="meal-servings" type="number" inputmode="decimal" min="1" step="any" data-control="meal-servings" data-entry-id="${escape(entry.entryId)}" value="${cookingServings}" required>${iconButton('plus', t(language, 'meal.more'), { action: 'change-servings', attrs: { 'data-entry-id': entry.entryId, 'data-delta': 1, id: 'meal-servings-more' } })}</div><small>${escape(t(language, 'meal.peopleHint'))}</small></div></div><section class="meal-ingredients" aria-labelledby="meal-amounts-heading"><div class="section-heading"><h3 id="meal-amounts-heading" aria-live="polite">${icon('people')}${escape(cookingServings === 1 ? t(language, 'meal.amountsTitleOne') : t(language, 'meal.amountsTitle', { count: formatNumber(cookingServings, language) }))}</h3></div>${scaled ? `<p class="muted small">${escape(t(language, 'meal.individualAmountHint'))}</p>${ingredientList(scaled, language, { baseIngredients: meal.ingredients, showBase: true, planLanguage: documentLanguage })}` : `<p class="notice notice--error" role="alert">${escape(t(language, 'meal.amountCalculationError'))}</p>`}</section>${nutritionSummary([meal], language, { compact: true, titleKey: 'meal.nutrition' })}${meal.preparation ? `<div class="batch-note">${icon('restore')}<div><strong>${escape(t(language, meal.preparation.role === 'leftover' ? 'meal.leftover' : 'meal.batch'))}</strong><p>${escape(t(language, 'meal.batchHint'))}</p>${meal.preparation.note ? `<p lang="${escape(documentLanguage)}">${escape(meal.preparation.note)}</p>` : ''}</div></div>` : ''}<div class="meal-revision-hint">${icon('info')}<p>${escape(t(language, 'meal.chatRevisions'))}</p></div><section class="meal-instructions"><h3>${escape(t(language, 'meal.preparation'))}</h3>${meal.instructions?.length ? `<ol class="instructions" lang="${escape(documentLanguage)}">${meal.instructions.map(instruction => `<li>${escape(instruction)}</li>`).join('')}</ol>` : `<p class="muted">${escape(t(language, 'meal.instructionsMissing'))}</p>`}</section>${meal.notes || meal.nutrition?.note ? `<section class="meal-notes"><h3>${escape(t(language, 'meal.note'))}</h3>${[meal.notes, meal.nutrition?.note].filter(Boolean).map(note => `<p lang="${escape(documentLanguage)}">${escape(note)}</p>`).join('')}</section>` : ''}</div><div class="modal-footer">${button(t(language, 'meal.close'), { action: 'close-dialog', iconName: 'check', variant: 'primary' })}</div></dialog>`;
}

function movedImportDays(model, language) {
  const dates = model.undoPreview?.movedDates || [];
  if (!dates.length) return '';
  const count = model.undoPreview.movedMealCount;
  return `<section class="undo-moved-days"><h3>${escape(t(language, 'import.undoMovedTitle'))}</h3>${typeof count === 'number' ? `<span class="badge">${escape(t(language, 'app.meals', { count }))}</span>` : ''}<p>${escape(t(language, 'import.undoMovedBody'))}</p><ul class="overlap-dates">${dates.map(date => `<li>${escape(formatDate(date, language))}</li>`).join('')}</ul></section>`;
}

function confirmationDialog(model) {
  const language = model.state.settings.uiLanguage;
  const action = model.dialog.action;
  const keys = {
    import: ['import.confirmTitle', 'import.confirmBody', 'import.replace'],
    restore: ['settings.restoreTitle', 'settings.restoreBody', 'settings.restoreConfirm'],
    clear: ['settings.clearTitle', 'settings.clearBody', 'settings.clearConfirm'],
    reset: ['settings.resetTitle', 'settings.resetBody', 'settings.resetConfirm'],
    'undo-import': ['import.undoTitle', 'import.undoBody', 'import.undoConfirm'],
  }[action] || ['app.confirm', 'errors.generic', 'app.confirm'];
  const dates = action === 'import' ? model.importDraft?.preview?.overlaps || []
    : action === 'undo-import' ? model.undoPreview?.dates || Object.keys(model.state.lastImportUndo?.beforeDays || {}).sort() : [];
  const removesRecovery = ['clear', 'reset'].includes(action) && model.storage?.recoveryAvailable;
  return `<dialog id="app-dialog" class="modal confirmation-modal" aria-labelledby="dialog-title" aria-describedby="dialog-description"><div class="modal-header"><h2 id="dialog-title">${escape(t(language, keys[0]))}</h2>${iconButton('close', t(language, 'app.close'), { action: 'close-dialog' })}</div><div class="modal-body">${dialogNotice(model)}<span class="confirm-symbol">${icon(['restore', 'reset', 'undo-import'].includes(action) ? 'restore' : 'warning')}</span><p id="dialog-description">${escape(t(language, keys[1], { date: formatDate(model.today, language) }))}</p>${action === 'undo-import' && model.undoPreview?.title ? `<p class="undo-plan-title">${escape(model.undoPreview.title)}</p>` : ''}${dates.length ? `${action === 'undo-import' ? `<h3 class="undo-dates-title">${escape(t(language, 'import.undoRestoreDates'))}</h3>` : ''}<ul class="overlap-dates">${dates.map(date => `<li>${escape(formatDate(date, language))}</li>`).join('')}</ul>` : ''}${action === 'undo-import' ? movedImportDays(model, language) : ''}${action === 'restore' && model.backupDraft ? `<p class="badge">${icon('file')}${escape(model.backupDraft.fileName)}</p>${replacementSummary(model, language)}` : ''}${removesRecovery ? `<p class="recovery-removal">${escape(t(language, 'settings.clearRecovery'))}</p>` : ''}</div><div class="modal-footer">${button(t(language, 'app.cancel'), { action: 'close-dialog', variant: 'secondary', attrs: { autofocus: true } })}${button(t(language, keys[2]), { action: 'confirm-action', variant: ['clear', 'import', 'undo-import'].includes(action) ? 'danger' : 'primary', attrs: { 'data-confirm-action': action, disabled: writeBlocked(model) } })}</div></dialog>`;
}

/** Pure view composition. Plan documents and application state are never mutated. */
export function renderApp(model) {
  const language = model.state.settings.uiLanguage;
  const view = [...primaryViews, ...toolViews].some(([name]) => name === model.state.ui.view) ? model.state.ui.view : 'today';
  const renderers = { today: todayView, calendar: calendarView, shopping: shoppingView, import: importView, export: exportView, settings: settingsView };
  let content = model.loading ? `<section class="panel loading-state" role="status"><span class="loading-art">${foodArt('lunch')}</span><h1 id="page-title" tabindex="-1">${escape(t(language, 'app.loading'))}</h1></section>` : renderers[view](model);
  if (model.error) content = `<div class="notice notice--error" role="alert">${icon('warning')}<p>${escape(t(language, model.error))}</p></div>` + content;
  const notice = model.notice && !model.dialog ? `<div class="notice notice--${model.notice.type === 'error' ? 'error' : 'success'}" role="${model.notice.type === 'error' ? 'alert' : 'status'}">${icon(model.notice.type === 'error' ? 'warning' : 'check')}<p>${escape(t(language, model.notice.key, model.notice.params || {}))}</p>${['notices.imported', 'notices.importedOne'].includes(model.notice.key) ? undoButton(model, language) : ''}${iconButton('close', t(language, 'notices.dismiss'), { action: 'dismiss-notice' })}</div>` : '';
  return `<a class="skip-link" href="#main">${escape(t(language, 'app.skip'))}</a><div class="app-shell"><header class="app-header"><a class="brand" href="#today" data-action="navigate" data-view="today"><span class="brand-mark">${icon('leaf')}</span><span>${escape(t(language, 'app.name'))}<small>${escape(t(language, 'app.tagline'))}</small></span></a>${navigation(language, view)}<div class="header-actions" aria-label="${escape(t(language, 'nav.tools'))}">${toolViews.map(([route, glyph]) => `<button type="button" class="header-action${route === view ? ' is-active' : ''}" data-action="navigate" data-view="${route}" aria-label="${escape(t(language, 'nav.' + route))}"${route === view ? ' aria-current="page"' : ''}>${icon(glyph)}<span class="header-action-label">${escape(t(language, 'nav.' + route))}</span></button>`).join('')}<div class="language-control">${localeSelect(language, 'ui-language')}</div></div><div class="pwa-status-slot" data-pwa-status role="status" aria-live="polite" aria-atomic="true" aria-label="${escape(t(language, 'pwa.statusLabel'))}">${renderPwaStatus(model)}</div></header>${storageBanner(model)}<main id="main" class="app-main" tabindex="-1">${notice}<div class="view-content" data-view="${view}">${content}</div></main><footer class="app-footer"><span>${escape(t(language, 'app.footer'))}</span><span>Meal Planner · 1.0</span></footer>${navigation(language, view, true)}</div>${model.dialog ? model.dialog.kind === 'meal' ? mealDialog(model) : model.dialog.kind === 'shopping-copy' ? shoppingCopyDialog(model) : model.dialog.kind === 'app-update' ? appUpdateDialog(model) : confirmationDialog(model) : ''}`;
}
