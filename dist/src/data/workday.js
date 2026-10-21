/** Explicit day metadata. No schedule is inferred from meals or free text. */
export const WORKDAY_CLASSES = Object.freeze([
  'day-shift', 'morning-shift', 'afternoon-shift', 'night-shift', 'split-shift',
  'on-call', 'remote-work', 'day-off', 'leave', 'other',
]);

const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Read the optional class and clock fields as technical metadata only.
 * Codes are open for future classes; the exported list is the UI vocabulary.
 * Missing/null metadata remains unknown, including in older version-1 files.
 */
export function assertReadableWorkday(workday) {
  if (workday === undefined || workday === null) return;
  if (!isRecord(workday) || typeof workday.class !== 'string' || !workday.class.trim()) {
    throw new TypeError('A workday must contain an explicit nonempty class.');
  }
  for (const key of ['startTime', 'endTime']) {
    if (workday[key] !== undefined && (typeof workday[key] !== 'string' || !CLOCK_TIME.test(workday[key]))) {
      throw new TypeError('Workday clock fields must use HH:mm.');
    }
  }
  if (workday.endDayOffset !== undefined && ![0, 1].includes(workday.endDayOffset)) {
    throw new TypeError('A workday end offset must be 0 or 1 calendar day.');
  }
  if (workday.label !== undefined && typeof workday.label !== 'string') {
    throw new TypeError('A workday label must be text.');
  }
}

/** Preserve an explicitly supplied value and any open metadata in isolation. */
export function copyWorkdayProperty(day) {
  if (!day || !Object.hasOwn(day, 'workday')) return {};
  assertReadableWorkday(day.workday);
  return { workday: structuredClone(day.workday) };
}
