class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function validateAmount(value, fieldName = 'amount') {
  const n = parseFloat(value);
  if (isNaN(n) || !isFinite(n)) throw new ValidationError(`${fieldName} must be a valid number`);
  if (n < 0) throw new ValidationError(`${fieldName} must not be negative`);
  if (n > 999999999) throw new ValidationError(`${fieldName} is too large`);
  return n;
}

function validatePositiveAmount(value, fieldName = 'amount') {
  const n = validateAmount(value, fieldName);
  if (n <= 0) throw new ValidationError(`${fieldName} must be greater than zero`);
  return n;
}

function validateTicker(value) {
  if (typeof value !== 'string') throw new ValidationError('Ticker must be a string');
  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.^-]{1,10}$/.test(ticker)) throw new ValidationError('Invalid ticker symbol');
  return ticker;
}

function validateString(value, fieldName, maxLength = 500) {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${fieldName} is required`);
  if (value.length > maxLength) throw new ValidationError(`${fieldName} is too long (max ${maxLength} chars)`);
  return value.trim();
}

function validateRate(value, fieldName = 'rate', min = 0, max = 100) {
  const n = parseFloat(value);
  if (isNaN(n) || !isFinite(n)) throw new ValidationError(`${fieldName} must be a valid number`);
  if (n < min || n > max) throw new ValidationError(`${fieldName} must be between ${min} and ${max}`);
  return n;
}

module.exports = { ValidationError, validateAmount, validatePositiveAmount, validateTicker, validateString, validateRate };
