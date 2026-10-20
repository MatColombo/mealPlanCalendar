/** Recognizable Phase 3 demo initialization, with device-local calendar dates. */
import { todayISO } from './dates.js';
import { createAppState } from './state.js';
import { applySessionImport } from './session.js';

export const DEMO_DOCUMENT_URL = new URL('../../examples/phase-3/ui-demo-it.diet', import.meta.url);

/**
 * Map the first source day to the device's current civil date by default.
 * Only calendar references move; the source document and its suggested dates
 * are copied and frozen by the existing Phase 1 primitives.
 */
export function createDemoState(document, { startDate = todayISO(), uiLanguage = 'it', now } = {}) {
  const empty = createAppState({ uiLanguage, now });
  const { state, preview } = applySessionImport(empty, document, {
    startDate,
    fileName: 'ui-demo-it.diet',
    now,
  });
  state.ui = { ...state.ui, view: 'today', selectedDate: startDate };
  state.shopping.range = { startDate: preview.startDate, endDate: preview.endDate };
  return state;
}
