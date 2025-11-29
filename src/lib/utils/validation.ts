import type {
  Priority,
  CreateTaskInput,
  UpdateTaskInput,
  CreateListInput,
  UpdateListInput,
  CreateLabelInput,
  UpdateLabelInput,
  ValidationResult,
} from '@/types';

// Valid priority values
export const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low', 'none'];

// Default priority when not specified
export const DEFAULT_PRIORITY: Priority = 'none';

/**
 * Validates that a string is not empty or whitespace-only
 */
export function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates that a value is a valid Priority enum value
 */
export function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && VALID_PRIORITIES.includes(value as Priority);
}

/**
 * Validates time format HH:mm (e.g., "09:30", "23:59")
 * Returns true if valid, false otherwise
 */
export function isValidTimeFormat(value: string): boolean {
  // Must match HH:mm pattern
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(value);
}

/**
 * Parses a time string in HH:mm format to minutes
 * Returns null if invalid format
 */
export function parseTimeToMinutes(value: string): number | null {
  if (!isValidTimeFormat(value)) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats minutes to HH:mm format
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}


/**
 * Creates a ValidationResult with no errors
 */
function validResult(): ValidationResult {
  return { valid: true, errors: {} };
}

/**
 * Creates a ValidationResult with errors
 */
function invalidResult(errors: Record<string, string[]>): ValidationResult {
  return { valid: false, errors };
}

/**
 * Adds an error to the errors object
 */
function addError(
  errors: Record<string, string[]>,
  field: string,
  message: string
): void {
  if (!errors[field]) {
    errors[field] = [];
  }
  errors[field].push(message);
}

/**
 * Validates task creation input
 * - Name is required and cannot be empty/whitespace
 * - Priority must be a valid enum value if provided
 * - Estimate must be a valid positive number if provided
 * - ActualTime must be a valid positive number if provided
 */
export function validateCreateTask(input: CreateTaskInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name (required)
  if (!isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name is required');
  }

  // Validate priority if provided
  if (input.priority !== undefined && !isValidPriority(input.priority)) {
    addError(errors, 'priority', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Validate estimate if provided (must be positive number)
  if (input.estimate !== undefined) {
    if (typeof input.estimate !== 'number' || input.estimate < 0) {
      addError(errors, 'estimate', 'Estimate must be a positive number (minutes)');
    }
  }

  // Validate actualTime if provided (must be positive number)
  if (input.actualTime !== undefined) {
    if (typeof input.actualTime !== 'number' || input.actualTime < 0) {
      addError(errors, 'actualTime', 'Actual time must be a positive number (minutes)');
    }
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates task update input
 * - Name cannot be empty/whitespace if provided
 * - Priority must be a valid enum value if provided
 * - Estimate must be a valid positive number if provided
 * - ActualTime must be a valid positive number if provided
 */
export function validateUpdateTask(input: UpdateTaskInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name if provided (cannot be empty)
  if (input.name !== undefined && !isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name cannot be empty');
  }

  // Validate priority if provided
  if (input.priority !== undefined && !isValidPriority(input.priority)) {
    addError(errors, 'priority', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  // Validate estimate if provided (must be positive number or null to clear)
  if (input.estimate !== undefined && input.estimate !== null) {
    if (typeof input.estimate !== 'number' || input.estimate < 0) {
      addError(errors, 'estimate', 'Estimate must be a positive number (minutes)');
    }
  }

  // Validate actualTime if provided (must be positive number or null to clear)
  if (input.actualTime !== undefined && input.actualTime !== null) {
    if (typeof input.actualTime !== 'number' || input.actualTime < 0) {
      addError(errors, 'actualTime', 'Actual time must be a positive number (minutes)');
    }
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates list creation input
 * - Name is required and cannot be empty/whitespace
 */
export function validateCreateList(input: CreateListInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name (required)
  if (!isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name is required');
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates list update input
 * - Name cannot be empty/whitespace if provided
 */
export function validateUpdateList(input: UpdateListInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name if provided (cannot be empty)
  if (input.name !== undefined && !isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name cannot be empty');
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates label creation input
 * - Name is required and cannot be empty/whitespace
 */
export function validateCreateLabel(input: CreateLabelInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name (required)
  if (!isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name is required');
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates label update input
 * - Name cannot be empty/whitespace if provided
 */
export function validateUpdateLabel(input: UpdateLabelInput): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Validate name if provided (cannot be empty)
  if (input.name !== undefined && !isNonEmptyString(input.name)) {
    addError(errors, 'name', 'Name cannot be empty');
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}

/**
 * Validates a time string in HH:mm format
 * Returns a ValidationResult
 */
export function validateTimeFormat(value: string): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!isValidTimeFormat(value)) {
    addError(errors, 'time', 'Invalid time format. Use HH:mm (e.g., 09:30, 14:00)');
  }

  return Object.keys(errors).length === 0 ? validResult() : invalidResult(errors);
}
