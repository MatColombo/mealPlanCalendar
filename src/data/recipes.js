import { getDayEntries } from './session.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
const canonical = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key, entry[key]])) : entry);

function fingerprint(meal, language) {
  // Times, occurrence IDs and batch roles describe a scheduled serving, not a recipe.
  // Changed ingredients/instructions remain separate variants, even with one recipeId.
  return canonical({ recipeId: meal.recipeId ?? null, language, title: meal.title,
    ingredients: meal.ingredients, instructions: meal.instructions ?? [],
    nutrition: meal.nutrition ?? null, prepMinutes: meal.prepMinutes ?? null,
    notes: meal.notes ?? null, externalMeal: meal.externalMeal ?? null, structure: meal.structure ?? null });
}

function stableKey(value) {
  let hash = 14695981039346656037n;
  for (const char of value) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0))) * 1099511628211n);
  return 'recipe-' + hash.toString(36);
}

/** Local catalogue from original plans, annotated only with actual calendar occurrences. */
export function buildRecipeIndex(state) {
  const variants = new Map(), byOccurrence = new Map(), keys = new Map();
  for (const [sourceId, source] of Object.entries(state.sourcePlans).sort(([a], [b]) => a.localeCompare(b))) {
    for (const day of source.document.days) for (const meal of day.meals) {
      const identity = fingerprint(meal, source.document.language);
      let recipe = variants.get(identity);
      if (!recipe) {
        let key = stableKey(identity), suffix = 0;
        while (keys.has(key) && keys.get(key) !== identity) key = stableKey(identity) + '-' + (++suffix);
        keys.set(key, identity);
        recipe = { key, meal, language: source.document.language, sources: [], types: [], occurrences: [] };
        variants.set(identity, recipe);
      }
      if (!recipe.sources.some(item => item.sourceId === sourceId)) recipe.sources.push({ sourceId, title: source.document.title });
      if (!recipe.types.includes(meal.type)) recipe.types.push(meal.type);
      byOccurrence.set(JSON.stringify([sourceId, meal.mealId]), recipe);
    }
  }
  for (const date of Object.keys(state.calendar).sort()) for (const item of getDayEntries(state, date)) {
    const recipe = byOccurrence.get(JSON.stringify([item.entry.sourceId, item.meal.mealId]));
    recipe?.occurrences.push({ date, time: item.time, entryId: item.entry.entryId,
      type: item.meal.type, cookingServings: item.cookingServings, sourceId: item.entry.sourceId });
  }
  return [...variants.values()];
}

/** Today belongs to upcoming; comparisons use civil ISO dates without time-zone conversion. */
export function recipePeriods(recipe, today) {
  const total = [...recipe.occurrences].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return { future: total.filter(item => item.date >= today), past: total.filter(item => item.date < today).reverse(), total };
}

export const DEFAULT_RECIPE_FILTERS = Object.freeze({ query: '', searchIn: 'all', type: 'all', category: 'all', period: 'all' });

/** Text search never translates or changes original recipe content. All filters are local. */
export function searchRecipes(index, filters = {}, today) {
  const { query, searchIn, type, category, period } = { ...DEFAULT_RECIPE_FILTERS, ...filters };
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return index.filter(recipe => {
    const ingredients = recipe.meal.ingredients || [];
    const title = normalize(recipe.meal.title);
    const ingredientText = ingredients.map(item => normalize(item.name) + ' ' + normalize(item.ingredientId)).join(' ');
    const haystack = searchIn === 'recipes' ? title : searchIn === 'ingredients' ? ingredientText : title + ' ' + ingredientText;
    if (!terms.every(term => haystack.includes(term))) return false;
    if (type !== 'all' && !recipe.types.includes(type)) return false;
    if (category !== 'all' && !ingredients.some(item => (item.category || 'other') === category)) return false;
    const periods = recipePeriods(recipe, today);
    return period === 'all' || (period === 'unscheduled' ? periods.total.length === 0 : (periods[period]?.length || 0) > 0);
  }).map(recipe => ({ ...recipe, periods: recipePeriods(recipe, today), matchedIngredients: terms.length === 0 ? []
    : recipe.meal.ingredients.filter(item => terms.some(term => normalize(item.name + ' ' + item.ingredientId).includes(term))) }));
}
