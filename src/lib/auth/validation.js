/**
 * Authentication Input Validation Utilities
 *
 * Provides validation and sanitization for user inputs:
 * - Email format validation (RFC 5322)
 * - Password strength validation
 * - Input sanitization (trim, lowercase, length limits)
 *
 * All functions return validation results with clear error messages.
 */

/**
 * Validate email address format
 *
 * Uses simplified RFC 5322 regex pattern.
 * Checks for basic email structure: local@domain.tld
 *
 * @param {string} email - Email address to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - True if email is valid
 * @returns {string} [result.error] - Error message if invalid
 *
 * Validation Rules:
 * - Must match email pattern (local@domain.tld)
 * - Maximum length: 255 characters
 * - Cannot be empty
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  if (email.length > 255) {
    return { valid: false, error: 'Email must be less than 255 characters' };
  }

  // RFC 5322 simplified regex
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Please provide a valid email address' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 *
 * Ensures password meets minimum security requirements:
 * - At least 8 characters long
 * - Contains at least one letter (a-z, A-Z)
 * - Contains at least one number (0-9)
 * - Maximum 128 characters (prevent bcrypt DoS)
 *
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - True if password is valid
 * @returns {string} [result.error] - Error message if invalid
 */
export function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  const MIN_LENGTH = 8;
  const MAX_LENGTH = 128;

  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_LENGTH} characters long`
    };
  }

  if (password.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Password must be less than ${MAX_LENGTH} characters (prevents DoS attacks)`
    };
  }

  // Must contain at least one letter
  const hasLetter = /[a-zA-Z]/.test(password);
  if (!hasLetter) {
    return {
      valid: false,
      error: 'Password must contain at least one letter'
    };
  }

  // Must contain at least one number
  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return {
      valid: false,
      error: 'Password must contain at least one number'
    };
  }

  return { valid: true };
}

/**
 * Sanitize email address
 *
 * Normalizes email to consistent format:
 * - Removes leading/trailing whitespace
 * - Converts to lowercase
 *
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

/**
 * Sanitize user name
 *
 * Normalizes name for storage:
 * - Removes leading/trailing whitespace
 * - Limits to 100 characters
 * - Returns null if empty after trimming
 *
 * @param {string} name - Name to sanitize
 * @returns {string|null} Sanitized name or null if empty
 */
export function sanitizeName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return null;
  }

  // Limit to 100 characters
  return trimmed.slice(0, 100);
}

/**
 * Validate and sanitize registration input
 *
 * Convenience function that validates and sanitizes all registration fields.
 *
 * @param {Object} input - Registration input
 * @param {string} input.email - Email address
 * @param {string} input.password - Password
 * @param {string} [input.name] - Optional user name
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - True if all inputs are valid
 * @returns {Object} [result.sanitized] - Sanitized inputs if valid
 * @returns {Array<string>} [result.errors] - Array of error messages if invalid
 */
export function validateRegistrationInput(input) {
  const errors = [];

  // Validate email
  const emailValidation = isValidEmail(input.email);
  if (!emailValidation.valid) {
    errors.push(emailValidation.error);
  }

  // Validate password
  const passwordValidation = isValidPassword(input.password);
  if (!passwordValidation.valid) {
    errors.push(passwordValidation.error);
  }

  // If validation failed, return errors
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize inputs
  const sanitized = {
    email: sanitizeEmail(input.email),
    password: input.password,  // Don't sanitize password (preserve exact input)
    name: sanitizeName(input.name)
  };

  return { valid: true, sanitized };
}

/**
 * Validate login input
 *
 * Basic validation for login (no password strength check).
 *
 * @param {Object} input - Login input
 * @param {string} input.email - Email address
 * @param {string} input.password - Password
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - True if inputs are valid
 * @returns {Object} [result.sanitized] - Sanitized inputs if valid
 * @returns {Array<string>} [result.errors] - Array of error messages if invalid
 */
export function validateLoginInput(input) {
  const errors = [];

  // Validate email format (basic check)
  const emailValidation = isValidEmail(input.email);
  if (!emailValidation.valid) {
    errors.push(emailValidation.error);
  }

  // Ensure password is non-empty (no strength check on login)
  if (!input.password || typeof input.password !== 'string' || input.password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Sanitize email only
  const sanitized = {
    email: sanitizeEmail(input.email),
    password: input.password  // Don't sanitize password
  };

  return { valid: true, sanitized };
}
