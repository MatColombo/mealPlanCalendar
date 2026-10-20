import it from './locales/it.js';
import en from './locales/en.js';

export const messages = { it, en };
export const getMessages = language => messages[language] || messages.it;

/** Get interface copy by dotted key; substitutions remain plain text. */
export function t(language, key, params = {}) {
  const resolve = dictionary => key.split('.').reduce((value, part) => value?.[part], dictionary);
  const singularKey = typeof params.count === 'number' && params.count === 1 ? key + 'One' : null;
  const singular = singularKey ? singularKey.split('.').reduce((value, part) => value?.[part], getMessages(language)) : null;
  const value = singular ?? resolve(getMessages(language)) ?? resolve(it);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

export const formatNumber = (value, language) => new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'it-IT', {
  maximumFractionDigits: 2,
}).format(value);

/** Civil dates use noon UTC only for formatting; no timezone-driven date shift. */
export function formatDate(iso, language, options = {}) {
  if (!iso) return '';
  const value = new Date(iso + 'T12:00:00Z');
  if (!Number.isFinite(value.getTime())) return String(iso);
  const style = {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...options, timeZone: 'UTC',
  };
  // ISO year 0000 is 1 BCE in the civil calendar; do not silently label it year 1.
  if (style.year && value.getUTCFullYear() === 0) style.era = 'short';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', style).format(value);
}

export function formatTime(time, language) {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return time || '';
  const [hour, minute] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function formatUnit(unit, language) {
  const dictionary = getMessages(language).units;
  return Object.hasOwn(dictionary, unit) ? dictionary[unit] : unit || '';
}

export function formatAmount(quantity, unit, language) {
  return [typeof quantity === 'number' && Number.isFinite(quantity) ? formatNumber(quantity, language) : '—',
    formatUnit(unit, language)].filter(Boolean).join(' ');
}

/** Shopping display only: preserve small nonzero amounts without changing data. */
export function formatShoppingAmount(quantity, unit, language) {
  let amount = '—';
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    const absolute = Math.abs(quantity);
    amount = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'it-IT', {
      maximumSignificantDigits: 12,
      notation: absolute > 0 && (absolute < 0.001 || absolute >= 1e9) ? 'scientific' : 'standard',
    }).format(quantity === 0 ? 0 : quantity);
  }
  return [amount, formatUnit(unit, language)].filter(Boolean).join(' ');
}

/** Open codes fall back to their supplied value instead of inventing a translation. */
export function codeLabel(group, value, language) {
  const dictionary = getMessages(language)[group];
  return dictionary && Object.hasOwn(dictionary, value) ? dictionary[value] : value || '';
}

export function planLanguageLabel(value, language) {
  try { return new Intl.DisplayNames([language], { type: 'language' }).of(value) || value; }
  catch { return value || ''; }
}
