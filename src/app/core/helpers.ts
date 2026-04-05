import { AbstractControl, ValidationErrors } from '@angular/forms';

export class CustomValidators {

  static strongPassword(
    minLength = 6,
    maxLength = 8
  ) {
    return (control: AbstractControl): ValidationErrors | null => {
      const value: string = control.value;

      if (!value) {
        return null; // let required validator handle empty
      }

      const errors: ValidationErrors = {};

      if (value.length < minLength) {
        errors.minLength = {
          requiredLength: minLength,
          actualLength: value.length
        };
      }

      if (value.length > maxLength) {
        errors.maxLength = {
          requiredLength: maxLength,
          actualLength: value.length
        };
      }

      if (!/[A-Z]/.test(value)) {
        errors.uppercase = true;
      }

      if (!/[0-9]/.test(value)) {
        errors.number = true;
      }

      if (!/[!@#$%^&*(),.?":{}|<>_\-\\[\]\/~`+=;]/.test(value)) {
        errors.specialChar = true;
      }

      return Object.keys(errors).length ? errors : null;
    };
  }

}

export class CodeGenerator {

  private static CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  /**
   * Generates codes like:
   * CMP-A9F2KQ
   * BR-7XQ9M2
   */
  static generate(prefix: string, length = 6): string {
    if (!prefix || prefix.length < 2) {
      throw new Error('Prefix must be at least 2 characters');
    }

    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    let randomPart = '';
    for (let i = 0; i < length; i++) {
      randomPart += CodeGenerator.CHARSET[randomValues[i] % 36];
    }

    return `${prefix.toUpperCase()}-${randomPart}`;
  }
}
