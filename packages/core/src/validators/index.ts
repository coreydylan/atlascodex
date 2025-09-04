/**
 * Validator Implementations for Evidence-First System
 * Based on EVIDENCE_FIRST_ADAPTIVE_EXTRACTION_PLAN_2025_09_03.md
 */

import { Validator } from '../types';

/**
 * Minimum length validator
 */
export class MinLengthValidator implements Validator {
  constructor(private minLength: number) {}

  validate(value: any): { valid: boolean; reason?: string } {
    const text = String(value || '');
    const valid = text.length >= this.minLength;
    
    return {
      valid,
      reason: valid ? undefined : `Text too short: ${text.length} < ${this.minLength}`
    };
  }
}

/**
 * Maximum length validator
 */
export class MaxLengthValidator implements Validator {
  constructor(private maxLength: number) {}

  validate(value: any): { valid: boolean; reason?: string } {
    const text = String(value || '');
    const valid = text.length <= this.maxLength;
    
    return {
      valid,
      reason: valid ? undefined : `Text too long: ${text.length} > ${this.maxLength}`
    };
  }
}

/**
 * URL format validator
 */
export class URLFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'URL is empty' };
    }
    
    try {
      new URL(String(value));
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }
}

/**
 * Email format validator
 */
export class EmailFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'Email is empty' };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = emailRegex.test(String(value));
    
    return {
      valid,
      reason: valid ? undefined : 'Invalid email format'
    };
  }
}

/**
 * Phone number format validator
 */
export class PhoneFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'Phone number is empty' };
    }
    
    const phoneText = String(value).replace(/\s+/g, '');
    
    // Basic phone number patterns
    const patterns = [
      /^\(\d{3}\)\d{3}-\d{4}$/,
      /^\d{3}-\d{3}-\d{4}$/,
      /^\d{10}$/,
      /^\+1\d{10}$/
    ];
    
    const valid = patterns.some(pattern => pattern.test(phoneText));
    
    return {
      valid,
      reason: valid ? undefined : 'Invalid phone number format'
    };
  }
}

/**
 * Required field validator
 */
export class RequiredValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    const isEmpty = value === null || 
                   value === undefined || 
                   String(value).trim() === '';
    
    return {
      valid: !isEmpty,
      reason: isEmpty ? 'Field is required but empty' : undefined
    };
  }
}

/**
 * Numeric validator
 */
export class NumericValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'Value is empty' };
    }
    
    const num = Number(value);
    const valid = !isNaN(num) && isFinite(num);
    
    return {
      valid,
      reason: valid ? undefined : 'Value is not a valid number'
    };
  }
}

/**
 * Date format validator
 */
export class DateFormatValidator implements Validator {
  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'Date is empty' };
    }
    
    const date = new Date(String(value));
    const valid = !isNaN(date.getTime());
    
    return {
      valid,
      reason: valid ? undefined : 'Invalid date format'
    };
  }
}

/**
 * Enum/choice validator
 */
export class EnumValidator implements Validator {
  constructor(private allowedValues: string[]) {}

  validate(value: any): { valid: boolean; reason?: string } {
    if (!value) {
      return { valid: false, reason: 'Value is empty' };
    }
    
    const valid = this.allowedValues.includes(String(value));
    
    return {
      valid,
      reason: valid ? undefined : `Value not in allowed list: ${this.allowedValues.join(', ')}`
    };
  }
}