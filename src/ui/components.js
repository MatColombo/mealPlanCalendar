import { t, formatNumber, formatAmount, formatTime, codeLabel } from './i18n.js';
import { icon, foodArt } from './icons.js';
import { totalNutritionPerPerson } from '../shopping/quantities.js';

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
  const values = totalNutritionPerPerson(meals);
  const metricKeys = ['kcal', 'proteinG', 'carbohydratesG', 'fatG'];
  return `<section class="day-summary${compact ? ' compact' : ''}" aria-label="${escape(t(language, titleKey))}"><div class="nutrition-heading"><h3>${escape(t(language, titleKey))}</h3><span class="badge">${icon('person')}${escape(t(language, 'today.person'))}</span></div><div class="nutrition-grid">${metricKeys.map(key => {
    const available = values[key] !== null;
    return `<div class="nutrition-stat nutrition-stat--${key}"><span class="nutrition-label">${escape(t(language, 'nutrition.' + key))}</span><strong>${available ? escape(formatNumber(values[key], language)) : `<span aria-label="${escape(t(language, 'app.unknown'))}">—</span>`}<small>${key === 'kcal' ? 'kcal' : 'g'}</small></strong></div>`;
  }).join('')}</div><p class="summary-note">${escape(t(language, 'today.nutritionNotice'))}${metricKeys.some(key => values[key] === null) ? ` <span>${escape(t(language, 'today.missingNutrition'))}</span>` : ''}</p></section>`;
}

export function mealCard(item, language) {
  const { meal, entry, source, time, cookingServings } = item;
  const knownType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal.type) ? meal.type : 'other';
  const planLanguage = source.document.language;
  const amount = meal.nutrition?.kcal;
  const openAttributes = { 'data-entry-id': entry.entryId };
  const ingredients = (meal.ingredients || []).slice(0, 3).map(ingredient => escape(ingredient.name)).join(' · ');
  return `<article class="meal-card meal-card--${knownType}"><div class="meal-art">${foodArt(knownType)}</div><div class="meal-card-main"><div class="meal-card-meta"><span class="meal-type">${escape(codeLabel('mealTypes', meal.type, language))}</span><time datetime="${escape(time)}">${icon('clock')}${escape(formatTime(time, language))}</time>${meal.preparation?.role === 'leftover' ? `<span class="badge leftover-badge">${icon('restore')}${escape(t(language, 'meal.leftover'))}</span>` : ''}</div><h3><button type="button" class="meal-title-button" id="meal-${escape(entry.entryId)}" data-action="open-meal" data-entry-id="${escape(entry.entryId)}" aria-label="${escape(t(language, 'today.openMeal', { title: meal.title }))}"><span lang="${escape(planLanguage)}">${escape(meal.title)}</span></button></h3><p class="ingredient-preview" lang="${escape(planLanguage)}">${ingredients}${meal.ingredients?.length > 3 ? ' …' : ''}</p><div class="meal-card-facts"><span>${icon('people')}${escape(cookingServings === 1 ? t(language, 'today.onePerson') : t(language, 'today.people', { count: formatNumber(cookingServings, language) }))}</span>${typeof meal.prepMinutes === 'number' ? `<span>${icon('clock')}${escape(t(language, 'today.prepTime', { count: formatNumber(meal.prepMinutes, language) }))}</span>` : ''}</div></div><div class="meal-card-footer"><span class="meal-energy"><strong>${typeof amount === 'number' && Number.isFinite(amount) ? escape(formatNumber(amount, language)) : '—'}</strong><span>kcal <small>${escape(t(language, 'today.person'))}</small></span></span>${iconButton('chevronRight', t(language, 'today.openMeal', { title: meal.title }), { action: 'open-meal', attrs: openAttributes })}</div></article>`;
}

export function ingredientList(ingredients, language, { baseIngredients = [], showBase = false, planLanguage = language } = {}) {
  return `<ul class="ingredient-list">${ingredients.map((ingredient, index) => `<li><div><strong lang="${escape(planLanguage)}">${escape(ingredient.name)}</strong>${ingredient.basis ? `<span class="basis">${escape(codeLabel('basis', ingredient.basis, language))}</span>` : ''}${showBase && baseIngredients[index] ? `<small>${escape(t(language, 'meal.baseAmount', { amount: formatAmount(baseIngredients[index].quantity, baseIngredients[index].unit, language) }))}</small>` : ''}</div><span class="quantity">${escape(formatAmount(ingredient.quantity, ingredient.unit, language))}</span></li>`).join('')}</ul>`;
}
