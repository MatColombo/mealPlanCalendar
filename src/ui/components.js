import { t, formatNumber, formatAmount, formatTime, codeLabel } from './i18n.js';
import { icon, foodArt } from './icons.js';
import { NUTRITION_METRICS, resolveMealNutrition, summarizeNutrition } from '../data/nutrition.js';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

/** All attribute values are escaped; these helpers only accept application-owned names. */
export function attributes(values = {}) {
  return Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => value === true ? ` ${name}` : ` ${name}="${escape(value)}"`).join('');
}

export function button(label, { action, iconName, variant = 'secondary', attrs = {} } = {}) {
  return `<button type="button" class="button ${variant}"${attributes({ 'data-action': action, ...attrs })}>${iconName ? icon(iconName) : ''}<span>${escape(label)}</span></button>`;
}

export function iconButton(name, label, { action, attrs = {} } = {}) {
  return `<button type="button" class="icon-button"${attributes({ 'data-action': action, 'aria-label': label, title: label, ...attrs })}>${icon(name)}</button>`;
}

export function emptyState(language, { title = 'empty.title', body = 'empty.body', action = true, illustration = 'lunch' } = {}) {
  return `<section class="empty-state"><div class="empty-art">${foodArt(illustration)}</div><h2>${escape(t(language, title))}</h2><p>${escape(t(language, body))}</p>${action ? button(t(language, 'empty.action'), { action: 'navigate', iconName: 'upload', variant: 'primary', attrs: { 'data-view': 'import' } }) : ''}</section>`;
}

export function nutritionSummary(meals, language, { compact = false, titleKey = 'today.personalSummary' } = {}) {
  const { metrics } = summarizeNutrition(meals);
  const metricKeys = NUTRITION_METRICS.filter((key, index) => index < 4 || metrics[key].partialValue !== null);
  return `<section class="day-summary${compact ? ' compact' : ''}" aria-label="${escape(t(language, titleKey))}"><div class="nutrition-heading"><h3>${escape(t(language, titleKey))}</h3><span class="badge">${icon('person')}${escape(t(language, 'today.person'))}</span></div><div class="nutrition-grid">${metricKeys.map(key => {
    const metric = metrics[key];
    return `<div class="nutrition-stat nutrition-stat--${key}${metric.complete ? '' : ' nutrition-incomplete'}"><span class="nutrition-label">${escape(t(language, 'nutrition.' + key))}</span><strong>${metricValue(metric, language)}<small>${key === 'kcal' ? 'kcal' : 'g'}</small></strong>${metric.value === null && metric.partialValue !== null ? `<small class="nutrition-partial-label">${escape(t(language, 'nutrition.partial'))}</small>` : ''}</div>`;
  }).join('')}</div><p class="summary-note visually-hidden">${escape(t(language, 'today.nutritionNotice'))}${metricKeys.some(key => !metrics[key].complete) ? ` <span>${escape(t(language, 'today.missingNutrition'))}</span>` : ''}</p></section>`;
}

function metricValue(metric, language) {
  const value = metric.value ?? metric.partialValue;
  if (value === null) return `<span aria-label="${escape(t(language, 'app.unknown'))}">—</span>`;
  return escape(formatNumber(value, language)) + (metric.complete ? '' : `<span title="${escape(t(language, 'nutrition.partialHint'))}" aria-label="${escape(t(language, 'nutrition.partial'))}">*</span>`);
}

export function mealMacros(meal, language) {
  const { metrics } = resolveMealNutrition(meal);
  return `<div class="meal-macros" aria-label="${escape(t(language, 'meal.nutrition'))}">${['proteinG', 'fatG', 'carbohydratesG'].map(key => `<span title="${escape(t(language, 'nutrition.' + key))}"><abbr aria-label="${escape(t(language, 'nutrition.' + key))}">${escape(t(language, 'compact.' + key))}:</abbr> <strong>${metricValue(metrics[key], language)}<small>g</small></strong></span>`).join('')}</div>`;
}

export function peopleControl(item, language, { compact = false } = {}) {
  const { entry, meal, cookingServings } = item;
  const id = compact ? 'card-servings-' + entry.entryId : 'meal-servings';
  return `<div class="field meal-people-control${compact ? ' people-compact' : ''}" data-entry-id="${escape(entry.entryId)}"><label for="${escape(id)}">${icon('people')}<span${compact ? ' class="visually-hidden"' : ''}>${escape(t(language, compact ? 'meal.quickPeople' : 'meal.people'))}</span></label><div class="serving-control">${iconButton('minus', t(language, 'meal.lessFor', { title: meal.title }), { action: 'change-servings', attrs: { 'data-entry-id': entry.entryId, 'data-delta': -1, disabled: cookingServings <= 1, id: id + '-less' } })}<input id="${escape(id)}" type="number" inputmode="decimal" min="1" step="any" data-control="meal-servings" data-entry-id="${escape(entry.entryId)}" value="${escape(cookingServings)}" aria-label="${escape(t(language, 'meal.peopleFor', { title: meal.title }))}" required>${iconButton('plus', t(language, 'meal.moreFor', { title: meal.title }), { action: 'change-servings', attrs: { 'data-entry-id': entry.entryId, 'data-delta': 1, id: id + '-more' } })}</div>${!compact ? `<small>${escape(t(language, 'meal.peopleHint'))}</small>` : ''}<span class="visually-hidden" data-people-status data-entry-id="${escape(entry.entryId)}" role="status" aria-live="polite"></span></div>`;
}

export function mealCard(item, language, { expanded = false } = {}) {
  const { meal, entry, source, time, cookingServings } = item;
  const knownType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.type) ? meal.type : 'other';
  const planLanguage = source.document.language;
  const energy = resolveMealNutrition(meal).metrics.kcal;
  const ingredients = (meal.ingredients || []).slice(0, 3).map(ingredient => escape(ingredient.name)).join(' · ');
  const prep = typeof meal.prepMinutes === 'number' ? `<span class="card-prep" title="${escape(t(language, 'meal.preparation'))}">${icon('clock')}${escape(formatNumber(meal.prepMinutes, language))}<small>min</small></span>` : '';
  const inlineDetails = expanded ? `<div class="meal-inline-detail"><h4>${escape(t(language, 'meal.ingredients'))} <small>${icon('people')}${escape(formatNumber(cookingServings, language))}</small></h4>${ingredientList((meal.ingredients || []).map(row => ({ ...row, quantity: row.quantity * cookingServings })), language, { planLanguage })}${meal.instructions?.length ? `<h4>${escape(t(language, 'meal.preparation'))}</h4><ol class="instructions" lang="${escape(planLanguage)}">${meal.instructions.map(step => `<li>${escape(step)}</li>`).join('')}</ol>` : ''}${meal.notes ? `<p class="small" lang="${escape(planLanguage)}">${escape(meal.notes)}</p>` : ''}</div>` : '';
  return `<article class="meal-card meal-card--${knownType} compact-meal${expanded ? ' meal-expanded' : ''}" data-meal-entry="${escape(entry.entryId)}"><div class="meal-side"><div class="meal-art">${foodArt(knownType)}</div>${peopleControl(item, language, { compact: true })}${prep}</div><div class="meal-card-main"><div class="meal-card-meta"><span class="meal-type">${escape(codeLabel('mealTypes', meal.type, language))}</span><time datetime="${escape(time)}">${escape(formatTime(time, language))}</time></div><h3><button type="button" class="meal-title-button" id="meal-${escape(entry.entryId)}" data-action="open-meal" data-entry-id="${escape(entry.entryId)}" aria-label="${escape(t(language, 'today.openMeal', { title: meal.title }))}"><span lang="${escape(planLanguage)}">${escape(meal.title)}</span></button></h3><span class="card-energy"><strong>${metricValue(energy, language)}</strong> kcal <small>${escape(t(language, 'today.person'))}</small></span>${mealMacros(meal, language)}${!expanded ? `<p class="ingredient-preview" lang="${escape(planLanguage)}">${ingredients}${meal.ingredients?.length > 3 ? ' · · ·' : ''}</p>` : ''}${externalMealInfo(meal, language)}${meal.preparation?.role === 'leftover' ? `<span class="badge">${escape(t(language, 'meal.leftover'))}</span>` : ''}</div>${inlineDetails}</article>`;
}

export function externalMealInfo(meal, language) {
  if (!meal.externalMeal) return '';
  const range = meal.externalMeal.kcalRange;
  const limits = range ? [range.min, range.max].map(value => typeof value === 'number' && Number.isFinite(value) ? formatNumber(value, language) : '—').join(' – ') : '';
  return `<p class="external-meal-note badge">${icon('work')}${escape(codeLabel('externalMealTypes', meal.externalMeal.kind, language))}${limits ? ` · ${escape(t(language, 'meal.externalRange', { range: limits }))}` : ''}</p>`;
}

export function ingredientList(ingredients, language, { baseIngredients = [], showBase = false, planLanguage = language } = {}) {
  return `<ul class="ingredient-list">${ingredients.map((ingredient, index) => {
    const nutrition = (baseIngredients[index] || ingredient).nutrition;
    const keys = NUTRITION_METRICS.filter(key => typeof nutrition?.[key] === 'number' && Number.isFinite(nutrition[key]));
    return `<li><div><strong lang="${escape(planLanguage)}">${escape(ingredient.name)}</strong>${ingredient.basis ? `<span class="basis">${escape(codeLabel('basis', ingredient.basis, language))}</span>` : ''}${showBase && baseIngredients[index] ? `<small>${escape(t(language, 'meal.baseAmount', { amount: formatAmount(baseIngredients[index].quantity, baseIngredients[index].unit, language) }))}</small>` : ''}${keys.length ? `<small class="ingredient-nutrition">${escape(t(language, 'today.person'))} · ${keys.map(key => escape(t(language, 'nutrition.' + key) + ' ' + formatNumber(nutrition[key], language) + ' ' + (key === 'kcal' ? 'kcal' : 'g'))).join(' · ')}</small>` : ''}</div><span class="quantity">${escape(formatAmount(ingredient.quantity, ingredient.unit, language))}</span></li>`;
  }).join('')}</ul>`;
}
