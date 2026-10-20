/** Shared ordering and plain-text presentation of a calculated shopping list. */
import { codeLabel, formatDate, formatShoppingAmount, t } from './i18n.js';

export const SHOPPING_CATEGORIES = ['produce', 'grains', 'protein', 'dairy', 'pantry', 'other'];

/** Group by category and sort display labels without changing names or inputs. */
export function groupShoppingItems(items, language) {
  const collator = new Intl.Collator(language === 'en' ? 'en-GB' : 'it-IT');
  const groups = new Map();
  for (const item of items) {
    const category = item.category || 'other';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  const rank = category => {
    const index = SHOPPING_CATEGORIES.indexOf(category);
    return index < 0 ? SHOPPING_CATEGORIES.length : index;
  };
  return [...groups].map(([category, rows]) => ({
    category,
    label: codeLabel('categories', category, language),
    items: rows.sort((a, b) => collator.compare(a.name, b.name)),
  })).sort((a, b) => rank(a.category) - rank(b.category) || collator.compare(a.label, b.label));
}

// A supplied name or custom unit may contain newlines. Keep each exported
// checkbox on one line while retaining the user's words as plain text.
const singleLine = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

function itemLine(item, language) {
  const amount = typeof item.quantity === 'number'
    ? formatShoppingAmount(item.quantity, item.unit, language) : t(language, 'app.unknown');
  const basis = item.basis ? ` · ${singleLine(codeLabel('basis', item.basis, language))}` : '';
  const line = `${item.checked ? '[x]' : '[ ]'} ${singleLine(item.name)} — ${singleLine(amount)}${basis}`;
  if (!item.reopened || typeof item.previousQuantity !== 'number') return line;
  return line + ' · ' + singleLine(t(language, 'shopping.reopenedDetail', {
    previous: formatShoppingAmount(item.previousQuantity, item.unit, language),
    required: amount,
  }));
}

/**
 * Create a UTF-8-friendly text snapshot with the same totals/checks as the UI.
 * `list` comes from getShoppingList(state). Manual rows remain a separate
 * section with their explicit quantities; this never scales or merges them.
 */
export function createShoppingText(list, language = 'it') {
  const { range, mode, rows, manualItems } = list;
  const hasRange = Boolean(range.startDate && range.endDate);
  const lines = [
    `Meal Planner · ${t(language, 'shopping.list')}`,
    `${t(language, 'shopping.period')}: ${hasRange
      ? `${formatDate(range.startDate, language)} – ${formatDate(range.endDate, language)}`
      : t(language, 'shopping.rangeUnselected')}`,
    ...(hasRange ? [t(language, 'shopping.included')] : []),
    `${t(language, 'shopping.mode')}: ${t(language, 'shopping.modes.' + mode)}`,
    t(language, 'shopping.selectedMeals', { count: list.mealCount }),
    t(language, 'shopping.progress', { checked: list.checkedCount, total: list.totalCount }),
  ];
  for (const group of groupShoppingItems(rows, language)) {
    lines.push('', singleLine(group.label));
    lines.push(...group.items.map(item => itemLine(item, language)));
  }
  if (manualItems.length) {
    lines.push('', t(language, 'shopping.manual'), t(language, 'shopping.manualHint'));
    for (const group of groupShoppingItems(manualItems, language)) {
      lines.push('', singleLine(group.label));
      lines.push(...group.items.map(item => itemLine({ ...item, reopened: false }, language)));
    }
  }
  return lines.join('\n') + '\n';
}

/** File names use only the selected civil dates and a supported UI locale. */
export function shoppingTextFileName(list, language = 'it') {
  const { startDate, endDate } = list.range;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const period = date(startDate) && date(endDate) ? `${startDate}_${endDate}` : 'manual';
  return `meal-planner-shopping-${period}-${language === 'en' ? 'en' : 'it'}.txt`;
}
