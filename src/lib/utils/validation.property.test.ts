/**
 * Property-based tests for validation utilities
 * 
 * Tests Properties 7, 8, 14, 15, 18 from the design document
 * **Validates: Requirements 3.1, 3.3, 4.4, 7.1, 7.2, 8.1, 9.1, 9.3, 24.1**
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  validateCreateTask,
  validateUpdateTask,
  validateCreateList,
  validateUpdateList,
  validateCreateLabel,
  validateUpdateLabel,
  validateTimeFormat,
  isValidPriority,
  isValidTimeFormat,
  isNonEmptyString,
  parseTimeToMinutes,
  formatMinutesToTime,
  VALID_PRIORITIES,
  DEFAULT_PRIORITY,
} from './validation';
import type { Priority, CreateTaskInput, CreateListInput, CreateLabelInput } from '@/types';

// Arbitraries for generating test data

// Non-empty strings (valid names)
const validName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// Empty or whitespace-only strings (invalid names)
const invalidName = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  \t  '),
  fc.constant('\n\r\t')
);

// Valid priority values
const validPriority = fc.constantFrom<Priority>('high', 'medium', 'low', 'none');

// Invalid priority values (strings that are not valid priorities)
const invalidPriority = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => !VALID_PRIORITIES.includes(s as Priority));

// Valid time format HH:mm
const validTimeString = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

// Also allow single-digit hours (e.g., "9:30")
const validTimeStringSingleDigitHour = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${h}:${m.toString().padStart(2, '0')}`);

// Invalid time formats
const invalidTimeString = fc.oneof(
  fc.constant('25:00'),      // Invalid hour
  fc.constant('12:60'),      // Invalid minute
  fc.constant('12:5'),       // Missing leading zero in minutes
  fc.constant('1230'),       // Missing colon
  fc.constant('12-30'),      // Wrong separator
  fc.constant('abc'),        // Non-numeric
  fc.constant(''),           // Empty
  fc.constant('12:30:00'),   // Too many parts
  fc.constant('-1:30'),      // Negative hour
  fc.constant('12:-30'),     // Negative minute
);

// Positive numbers for estimate/actualTime
const positiveMinutes = fc.integer({ min: 0, max: 1440 }); // 0 to 24 hours

// Negative numbers (invalid for time)
const negativeNumber = fc.integer({ min: -1000, max: -1 });

describe('Property 7: Task Name Validation and Priority Default', () => {
  /**
   * **Feature: daily-task-planner, Property 7: Task Name Validation and Priority Default**
   * **Validates: Requirements 3.1, 9.3**
   * 
   * For any task creation, if the name is empty the operation SHALL fail;
   * if priority is not specified, it SHALL default to "none".
   */
  test('Task creation with empty name fails validation', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const input: CreateTaskInput = { name };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.errors.name.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Task creation with valid name passes validation', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const input: CreateTaskInput = { name };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  test('Default priority is "none"', () => {
    expect(DEFAULT_PRIORITY).toBe('none');
  });
});


describe('Property 8: Task Validation Rejection', () => {
  /**
   * **Feature: daily-task-planner, Property 8: Task Validation Rejection**
   * **Validates: Requirements 3.3, 4.4, 24.1**
   * 
   * For any task with invalid data (empty name, invalid priority value, invalid time format),
   * creation or update SHALL fail with specific validation errors.
   */
  test('Task with empty name is rejected with specific error', () => {
    fc.assert(
      fc.property(invalidName, validPriority, (name, priority) => {
        const input: CreateTaskInput = { name, priority };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.errors.name.some(e => e.toLowerCase().includes('name'))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Task with invalid priority is rejected with specific error', () => {
    fc.assert(
      fc.property(validName, invalidPriority, (name, priority) => {
        const input = { name, priority: priority as Priority };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.priority).toBeDefined();
        expect(result.errors.priority.some(e => e.toLowerCase().includes('priority'))).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Task with negative estimate is rejected with specific error', () => {
    fc.assert(
      fc.property(validName, negativeNumber, (name, estimate) => {
        const input: CreateTaskInput = { name, estimate };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.estimate).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Task with negative actualTime is rejected with specific error', () => {
    fc.assert(
      fc.property(validName, negativeNumber, (name, actualTime) => {
        const input: CreateTaskInput = { name, actualTime };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.actualTime).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Task update with empty name is rejected', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const result = validateUpdateTask({ name });
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Task update with invalid priority is rejected', () => {
    fc.assert(
      fc.property(invalidPriority, (priority) => {
        const result = validateUpdateTask({ priority: priority as Priority });
        
        expect(result.valid).toBe(false);
        expect(result.errors.priority).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Valid task data passes validation', () => {
    fc.assert(
      fc.property(
        validName,
        validPriority,
        positiveMinutes,
        positiveMinutes,
        (name, priority, estimate, actualTime) => {
          const input: CreateTaskInput = { name, priority, estimate, actualTime };
          const result = validateCreateTask(input);
          
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 14: Time Format Validation', () => {
  /**
   * **Feature: daily-task-planner, Property 14: Time Format Validation**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * For any estimate or actualTime value, the system SHALL accept valid HH:mm format
   * strings and reject invalid formats.
   */
  test('Valid HH:mm format is accepted', () => {
    fc.assert(
      fc.property(validTimeString, (time) => {
        expect(isValidTimeFormat(time)).toBe(true);
        
        const result = validateTimeFormat(time);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Valid single-digit hour format is accepted (e.g., 9:30)', () => {
    fc.assert(
      fc.property(validTimeStringSingleDigitHour, (time) => {
        expect(isValidTimeFormat(time)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Invalid time formats are rejected', () => {
    fc.assert(
      fc.property(invalidTimeString, (time) => {
        expect(isValidTimeFormat(time)).toBe(false);
        
        const result = validateTimeFormat(time);
        expect(result.valid).toBe(false);
        expect(result.errors.time).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Time parsing round trip: parse then format returns equivalent time', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes) => {
          const totalMinutes = hours * 60 + minutes;
          const formatted = formatMinutesToTime(totalMinutes);
          const parsed = parseTimeToMinutes(formatted);
          
          expect(parsed).toBe(totalMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Invalid time format returns null when parsed', () => {
    fc.assert(
      fc.property(invalidTimeString, (time) => {
        const parsed = parseTimeToMinutes(time);
        expect(parsed).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 15: Label Name Validation', () => {
  /**
   * **Feature: daily-task-planner, Property 15: Label Name Validation**
   * **Validates: Requirements 8.1**
   * 
   * For any label creation, if the name is empty, the operation SHALL fail
   * with a validation error.
   */
  test('Label creation with empty name fails validation', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const input: CreateLabelInput = { name };
        const result = validateCreateLabel(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.errors.name.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('Label creation with valid name passes validation', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const input: CreateLabelInput = { name };
        const result = validateCreateLabel(input);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  test('Label update with empty name fails validation', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const result = validateUpdateLabel({ name });
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('Label update with valid name passes validation', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const result = validateUpdateLabel({ name });
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  test('Label update with undefined name passes validation (no change)', () => {
    const result = validateUpdateLabel({});
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe('Property 18: Priority Enum Validation', () => {
  /**
   * **Feature: daily-task-planner, Property 18: Priority Enum Validation**
   * **Validates: Requirements 9.1**
   * 
   * For any priority value, only "high", "medium", "low", or "none" SHALL be accepted;
   * other values SHALL be rejected.
   */
  test('Valid priority values are accepted', () => {
    fc.assert(
      fc.property(validPriority, (priority) => {
        expect(isValidPriority(priority)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Invalid priority values are rejected', () => {
    fc.assert(
      fc.property(invalidPriority, (priority) => {
        expect(isValidPriority(priority)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('All four valid priorities are in VALID_PRIORITIES', () => {
    expect(VALID_PRIORITIES).toContain('high');
    expect(VALID_PRIORITIES).toContain('medium');
    expect(VALID_PRIORITIES).toContain('low');
    expect(VALID_PRIORITIES).toContain('none');
    expect(VALID_PRIORITIES.length).toBe(4);
  });

  test('Non-string values are rejected as priorities', () => {
    expect(isValidPriority(null)).toBe(false);
    expect(isValidPriority(undefined)).toBe(false);
    expect(isValidPriority(123)).toBe(false);
    expect(isValidPriority({})).toBe(false);
    expect(isValidPriority([])).toBe(false);
  });

  test('Task creation with valid priority passes', () => {
    fc.assert(
      fc.property(validName, validPriority, (name, priority) => {
        const input: CreateTaskInput = { name, priority };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Task creation with invalid priority fails', () => {
    fc.assert(
      fc.property(validName, invalidPriority, (name, priority) => {
        const input = { name, priority: priority as Priority };
        const result = validateCreateTask(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.priority).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

describe('List Validation', () => {
  /**
   * Additional tests for list validation
   * **Validates: Requirements 2.1**
   */
  test('List creation with empty name fails validation', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const input: CreateListInput = { name };
        const result = validateCreateList(input);
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('List creation with valid name passes validation', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const input: CreateListInput = { name };
        const result = validateCreateList(input);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  test('List update with empty name fails validation', () => {
    fc.assert(
      fc.property(invalidName, (name) => {
        const result = validateUpdateList({ name });
        
        expect(result.valid).toBe(false);
        expect(result.errors.name).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  test('List update with valid name passes validation', () => {
    fc.assert(
      fc.property(validName, (name) => {
        const result = validateUpdateList({ name });
        
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('isNonEmptyString utility', () => {
  test('Non-empty strings return true', () => {
    fc.assert(
      fc.property(validName, (str) => {
        expect(isNonEmptyString(str)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  test('Empty or whitespace strings return false', () => {
    fc.assert(
      fc.property(invalidName, (str) => {
        expect(isNonEmptyString(str)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  test('Non-string values return false', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
    expect(isNonEmptyString([])).toBe(false);
  });
});
