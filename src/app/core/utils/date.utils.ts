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
 * Salary periods are calendar months, exchanged with the API as `YYYY-MM`.
 * These helpers keep the month-picker `Date` and the API string in sync without
 * timezone drift (a month picker only ever cares about year + month).
 */

/** `Date` → `YYYY-MM`, using the local calendar month the user picked. */
export function formatMonthForPayload(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  if (typeof date === 'string') {
    const s = date.trim();
    return /^\d{4}-\d{2}$/.test(s) ? s : (s.match(/^(\d{4}-\d{2})-\d{2}/)?.[1] ?? null);
  }
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `YYYY-MM` (or any date string) → a `Date` on the 1st of that month, for month pickers. */
export function parseMonthLocal(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), 1);
  }
  const m = String(value).trim().match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const dt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1);
  return isNaN(dt.getTime()) ? null : dt;
}

/** `YYYY-MM` → "March 2025" for display. Falls back to the raw value when unparseable. */
export function monthPeriodLabel(value: string | Date | null | undefined): string {
  const d = parseMonthLocal(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : '—';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** `YYYY-MM` → "Mar 2025" for tight spaces like table cells. */
export function monthPeriodShortLabel(value: string | Date | null | undefined): string {
  const d = parseMonthLocal(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : '—';
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
