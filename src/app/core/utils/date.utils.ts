import { DateTime } from 'luxon';

/**
 * Date utilities for API payloads using Pakistan timezone (Asia/Karachi, UTC+5).
 * Use these instead of Date.toISOString() so the selected calendar date is sent
 * correctly (e.g. selecting March 8 sends "2025-03-08", not "2025-03-07" in UTC).
 */

const PAKISTAN_TZ = 'Asia/Karachi';

/**
 * Format a date as YYYY-MM-DD in Pakistan local time.
 * Use for date-only API fields (orderDate, requestDate, voucherDate, etc.).
 */
export function formatDateForPayload(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PAKISTAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

/**
 * Format a date as full ISO-like string in Pakistan time (e.g. 2025-03-08T00:00:00+05:00).
 * Use when the API expects a full datetime string and you want the calendar date to be correct in Pakistan.
 */
export function formatDateTimeForPayload(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const dateStr = formatDateForPayload(d);
  if (!dateStr) return null;
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PAKISTAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const hour = timeParts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = timeParts.find(p => p.type === 'minute')?.value ?? '00';
  const second = timeParts.find(p => p.type === 'second')?.value ?? '00';
  return `${dateStr}T${hour}:${minute}:${second}+05:00`;
}

/**
 * Convert a value (Date, string, or null) to payload date string (YYYY-MM-DD) in Pakistan time.
 * Returns the string as-is if it's already a string; otherwise formats the date.
 */
export function toPayloadDateString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return formatDateForPayload(value);
}

/**
 * Convert a value (Date, string, or null) to payload datetime string in Pakistan time.
 */
export function toPayloadDateTimeString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return formatDateTimeForPayload(value);
}

/**
 * Parse a date-only API string (YYYY-MM-DD or ISO) as local calendar date.
 * Avoids `new Date('2026-03-10')` UTC midnight shifting to previous day in western timezones.
 * Returns Date at local noon so datepicker/display stays on the intended day.
 */
export function parseDateOnlyLocal(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dt = new Date(y, mo, d, 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}

/**
 * Date formats for a picker that represents a whole calendar month.
 *
 * Provide alongside the app's `LuxonDateAdapter` (see app.config.ts) so the field reads
 * "August 2026" rather than a day-level date like "8/1/2026", which misrepresents a
 * value the user chose from a month grid.
 */
export const MONTH_ONLY_DATE_FORMATS = {
  parse: { dateInput: 'LLLL yyyy' },
  display: {
    dateInput: 'LLLL yyyy',
    monthYearLabel: 'LLL yyyy',
    dateA11yLabel: 'DD',
    monthYearA11yLabel: 'LLLL yyyy',
  },
};

/** Anything a Material datepicker or the API may hand us for a date or period. */
export type MonthPickerValue = Date | DateTime | string | null | undefined;

/**
 * Material datepicker value → `YYYY-MM-DD`, using the calendar day the user picked.
 *
 * The app provides `LuxonDateAdapter`, so pickers emit Luxon `DateTime`, not `Date`.
 * Reaching for `Date` methods on one throws, and gating on `instanceof Date` silently
 * drops the value — use this instead of hand-rolling the conversion per component.
 */
export function formatPickedDateForPayload(value: MonthPickerValue): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return s.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? (s || null);
  }
  if (DateTime.isDateTime(value)) {
    return value.isValid ? value.toISODate() : null;
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return `${String(value.getFullYear()).padStart(4, '0')}-${String(
      value.getMonth() + 1,
    ).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Salary periods are calendar months, exchanged with the API as `YYYY-MM`.
 *
 * The app provides `LuxonDateAdapter` (see app.config.ts), so every Material
 * datepicker emits and accepts Luxon `DateTime` — not a JS `Date`. These helpers
 * therefore accept either, plus the `YYYY-MM` string the API returns, and hand
 * `DateTime` back to the pickers so the value round-trips as one type.
 */

function monthString(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Month-picker value → `YYYY-MM`, or null when there is no usable month. */
export function formatMonthForPayload(value: MonthPickerValue): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const s = value.trim();
    return /^\d{4}-\d{2}$/.test(s) ? s : (s.match(/^(\d{4}-\d{2})-\d{2}/)?.[1] ?? null);
  }
  if (DateTime.isDateTime(value)) {
    return value.isValid ? monthString(value.year, value.month) : null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : monthString(value.getFullYear(), value.getMonth() + 1);
  }
  return null;
}

/**
 * `YYYY-MM` (or any date value) → a `DateTime` on the 1st of that month.
 * Returns the adapter's own type so it can be written straight into a picker.
 */
export function parseMonthLocal(value: MonthPickerValue): DateTime | null {
  const month = formatMonthForPayload(value);
  if (!month) return null;
  const dt = DateTime.fromISO(`${month}-01`);
  return dt.isValid ? dt : null;
}

/** `YYYY-MM` → "March 2025" for display. Falls back to the raw value when unparseable. */
export function monthPeriodLabel(value: MonthPickerValue): string {
  const d = parseMonthLocal(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : '—';
  return d.toFormat('LLLL yyyy');
}

/** `YYYY-MM` → "Mar 2025" for tight spaces like table cells. */
export function monthPeriodShortLabel(value: MonthPickerValue): string {
  const d = parseMonthLocal(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : '—';
  return d.toFormat('LLL yyyy');
}
