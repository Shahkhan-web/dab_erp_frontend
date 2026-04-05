import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Pakistan CNIC format: 13 digits as XXXXX-XXXX-XXX-X
 * Example: 36203-8082-023-7
 */
const CNIC_DIGITS_LEN = 13;
const CNIC_REGEX = /^\d{5}-\d{4}-\d{3}-\d{1}$/;

/**
 * Strip non-digits and cap at 13 characters.
 */
export function stripCnicDigits(value: string | null | undefined): string {
  if (value == null || value === '') return '';
  return String(value).replace(/\D/g, '').slice(0, CNIC_DIGITS_LEN);
}

/**
 * Format raw digits into Pakistan CNIC with dashes (progressive as user types).
 */
export function formatCnic(digits: string): string {
  const d = stripCnicDigits(digits);
  if (!d) return '';
  if (d.length <= 5) return d;
  if (d.length <= 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 9)}-${d.slice(9, 12)}-${d.slice(12, 13)}`;
}

/**
 * True if value is empty or a complete valid CNIC (13 digits in correct pattern).
 */
export function isValidCnic(value: string | null | undefined): boolean {
  if (value == null || String(value).trim() === '') return true;
  const formatted = formatCnic(value);
  return CNIC_REGEX.test(formatted);
}

/**
 * Normalized CNIC for API (digits only, 13 chars) or null if incomplete/invalid.
 */
export function cnicToPayload(value: string | null | undefined): string | null {
  const d = stripCnicDigits(value);
  if (d.length !== CNIC_DIGITS_LEN) return null;
  return d;
}

/**
 * Reactive-forms validator: optional field; if filled, must be complete valid CNIC.
 * Error key: `cnicInvalid`
 */
export function cnicValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (v == null || String(v).trim() === '') return null;
    if (isValidCnic(v) && stripCnicDigits(v).length === CNIC_DIGITS_LEN) return null;
    return { cnicInvalid: true };
  };
}

/**
 * Call from (input) or valueChanges to keep the control value beautified.
 * Use with emitEvent: false to avoid loops.
 */
export function beautifyCnicControlValue(control: AbstractControl): void {
  const raw = control.value;
  if (raw == null) return;
  const formatted = formatCnic(raw);
  if (formatted !== String(raw)) {
    control.setValue(formatted, { emitEvent: false });
  }
}
