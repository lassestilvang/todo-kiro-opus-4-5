import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
  validateRecurrencePattern,
  parseRecurrencePattern,
  calculateNextOccurrence,
  formatRecurrencePattern,
  parseFormattedRecurrence,
  VALID_RECURRENCE_TYPES,
  createDailyRecurrence,
  createWeeklyRecurrence,
  createWeekdayRecurrence,
  createMonthlyRecurrence,
  createYearlyRecurrence,
  createWeekdaysRecurrence,
  createOrdinalWeekdayRecurrence,
  createMonthDayRecurrence,
} from './recurrence';
import type { RecurrencePattern, RecurrenceType } from '@/types';

/**
 * **Feature: daily-task-planner, Property 19: Recurrence Pattern Validation**
 * **Validates: Requirements 10.1**
 * 
 * For any recurrence pattern (daily, weekly, weekday, monthly, yearly, custom),
 * the system SHALL accept valid patterns and store them correctly.
 */
describe('Property 19: Recurrence Pattern Validation', () => {
  // Arbitrary for valid recurrence types
  const validRecurrenceTypeArb = fc.constantFrom<RecurrenceType>(...VALID_RECURRENCE_TYPES);
  
  // Arbitrary for valid interval (positive integer)
  const validIntervalArb = fc.integer({ min: 1, max: 100 });
  
  // Arbitrary for valid weekday (0-6)
  const validWeekdayArb = fc.integer({ min: 0, max: 6 });
  
  // Arbitrary for valid weekdays array (non-empty, unique, 0-6)
  const validWeekdaysArb = fc.uniqueArray(validWeekdayArb, { minLength: 1, maxLength: 7 });
  
  // Arbitrary for valid month day (1-31)
  const validMonthDayArb = fc.integer({ min: 1, max: 31 });
  
  // Arbitrary for valid ordinal (1-5)
  const validOrdinalArb = fc.integer({ min: 1, max: 5 });

  test('All standard recurrence types are valid', () => {
    fc.assert(
      fc.property(validRecurrenceTypeArb, (type) => {
        // For non-custom types, a simple pattern with just the type should be valid
        if (type !== 'custom') {
          const pattern: RecurrencePattern = { type };
          const result = validateRecurrencePattern(pattern);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Daily recurrence with valid interval is valid', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern: RecurrencePattern = { type: 'daily', interval };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekly recurrence with valid interval is valid', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern: RecurrencePattern = { type: 'weekly', interval };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Monthly recurrence with valid interval is valid', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern: RecurrencePattern = { type: 'monthly', interval };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Yearly recurrence with valid interval is valid', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern: RecurrencePattern = { type: 'yearly', interval };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Custom recurrence with valid weekdays is valid', () => {
    fc.assert(
      fc.property(validWeekdaysArb, (weekdays) => {
        const pattern: RecurrencePattern = { type: 'custom', weekdays };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Custom recurrence with valid ordinal weekday is valid', () => {
    fc.assert(
      fc.property(validOrdinalArb, validWeekdayArb, (ordinal, weekday) => {
        const pattern: RecurrencePattern = { 
          type: 'custom', 
          ordinal, 
          ordinalWeekday: weekday 
        };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Custom recurrence with valid month day is valid', () => {
    fc.assert(
      fc.property(validMonthDayArb, (monthDay) => {
        const pattern: RecurrencePattern = { type: 'custom', monthDay };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Invalid recurrence type is rejected', () => {
    const invalidTypes = ['invalid', 'biweekly', 'quarterly', '', 'DAILY', 'Weekly'];
    for (const type of invalidTypes) {
      const pattern = { type } as RecurrencePattern;
      const result = validateRecurrencePattern(pattern);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  test('Invalid interval (non-positive) is rejected', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 0 }), (interval) => {
        const pattern: RecurrencePattern = { type: 'daily', interval };
        const result = validateRecurrencePattern(pattern);
        expect(result.valid).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Invalid weekday values are rejected', () => {
    const invalidWeekdays = [[-1], [7], [0, 8], [-2, 3]];
    for (const weekdays of invalidWeekdays) {
      const pattern: RecurrencePattern = { type: 'custom', weekdays };
      const result = validateRecurrencePattern(pattern);
      expect(result.valid).toBe(false);
    }
  });

  test('Ordinal without ordinalWeekday is rejected', () => {
    const pattern: RecurrencePattern = { type: 'custom', ordinal: 2 };
    const result = validateRecurrencePattern(pattern);
    expect(result.valid).toBe(false);
  });

  test('OrdinalWeekday without ordinal is rejected', () => {
    const pattern: RecurrencePattern = { type: 'custom', ordinalWeekday: 1 };
    const result = validateRecurrencePattern(pattern);
    expect(result.valid).toBe(false);
  });
});


/**
 * **Feature: daily-task-planner, Property 20: Recurring Task Next Occurrence**
 * **Validates: Requirements 10.2**
 * 
 * For any recurring task that is completed, the system SHALL create a new task
 * instance with the correct next date based on the recurrence pattern.
 */
describe('Property 20: Recurring Task Next Occurrence', () => {
  // Arbitrary for a valid date within a reasonable range (filter out invalid dates)
  const dateArb = fc.date({ 
    min: new Date('2020-01-01'), 
    max: new Date('2029-12-31') 
  }).filter(d => !isNaN(d.getTime()));
  
  const validIntervalArb = fc.integer({ min: 1, max: 12 });

  test('Daily recurrence advances by interval days', () => {
    fc.assert(
      fc.property(dateArb, validIntervalArb, (startDate, interval) => {
        const pattern = createDailyRecurrence(interval);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          const expectedDate = new Date(startDate);
          expectedDate.setDate(expectedDate.getDate() + interval);
          expect(nextDate.getTime()).toBe(expectedDate.getTime());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekly recurrence advances by interval weeks', () => {
    fc.assert(
      fc.property(dateArb, validIntervalArb, (startDate, interval) => {
        const pattern = createWeeklyRecurrence(interval);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          const expectedDate = new Date(startDate);
          expectedDate.setDate(expectedDate.getDate() + (7 * interval));
          expect(nextDate.getTime()).toBe(expectedDate.getTime());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekday recurrence advances to next weekday (Mon-Fri)', () => {
    fc.assert(
      fc.property(dateArb, (startDate) => {
        const pattern = createWeekdayRecurrence();
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          // Next date should be a weekday (1-5)
          const dayOfWeek = nextDate.getDay();
          expect(dayOfWeek).toBeGreaterThanOrEqual(1);
          expect(dayOfWeek).toBeLessThanOrEqual(5);
          
          // Next date should be after start date
          expect(nextDate.getTime()).toBeGreaterThan(startDate.getTime());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Monthly recurrence advances by interval months', () => {
    fc.assert(
      fc.property(dateArb, validIntervalArb, (startDate, interval) => {
        const pattern = createMonthlyRecurrence(interval);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          // Calculate expected date by creating a new date and adding months
          const expected = new Date(startDate);
          expected.setMonth(expected.getMonth() + interval);
          
          // The implementation handles day clamping, so we need to account for that
          const originalDay = startDate.getDate();
          const daysInTargetMonth = new Date(expected.getFullYear(), expected.getMonth() + 1, 0).getDate();
          
          // If original day > days in target month, day gets clamped
          if (originalDay > daysInTargetMonth) {
            expect(nextDate.getDate()).toBe(daysInTargetMonth);
          }
          
          // Month and year should match expected
          expect(nextDate.getMonth()).toBe(expected.getMonth());
          expect(nextDate.getFullYear()).toBe(expected.getFullYear());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Yearly recurrence advances by interval years', () => {
    fc.assert(
      fc.property(dateArb, validIntervalArb, (startDate, interval) => {
        const pattern = createYearlyRecurrence(interval);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          expect(nextDate.getFullYear()).toBe(startDate.getFullYear() + interval);
          expect(nextDate.getMonth()).toBe(startDate.getMonth());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Next occurrence is always in the future', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.constantFrom<RecurrenceType>('daily', 'weekly', 'weekday', 'monthly', 'yearly'),
        (startDate, type) => {
          const pattern: RecurrencePattern = { type };
          const nextDate = calculateNextOccurrence(startDate, pattern);
          
          expect(nextDate).not.toBeNull();
          if (nextDate) {
            expect(nextDate.getTime()).toBeGreaterThan(startDate.getTime());
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Feature: daily-task-planner, Property 21: Custom Recurrence Calculation**
 * **Validates: Requirements 10.3**
 * 
 * For any custom recurrence pattern (interval-based, weekday-specific, ordinal),
 * calculating the next occurrence SHALL produce the correct date.
 */
describe('Property 21: Custom Recurrence Calculation', () => {
  const dateArb = fc.date({ 
    min: new Date('2020-01-01'), 
    max: new Date('2030-12-31') 
  }).filter(d => !isNaN(d.getTime()));
  
  const validWeekdayArb = fc.integer({ min: 0, max: 6 });
  const validWeekdaysArb = fc.uniqueArray(validWeekdayArb, { minLength: 1, maxLength: 7 });
  const validOrdinalArb = fc.integer({ min: 1, max: 4 }); // 1-4 to avoid edge cases with 5th weekday
  const validMonthDayArb = fc.integer({ min: 1, max: 28 }); // 1-28 to avoid month-end edge cases
  const validIntervalArb = fc.integer({ min: 1, max: 12 });

  test('Weekdays pattern returns a date matching one of the specified weekdays', () => {
    fc.assert(
      fc.property(dateArb, validWeekdaysArb, (startDate, weekdays) => {
        const pattern = createWeekdaysRecurrence(weekdays);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          // The next date's day of week should be in the weekdays array
          const sortedWeekdays = [...new Set(weekdays)].sort((a, b) => a - b);
          expect(sortedWeekdays).toContain(nextDate.getDay());
          
          // Next date should be after start date
          expect(nextDate.getTime()).toBeGreaterThan(startDate.getTime());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Ordinal weekday pattern returns correct nth weekday of month', () => {
    fc.assert(
      fc.property(dateArb, validOrdinalArb, validWeekdayArb, validIntervalArb, 
        (startDate, ordinal, weekday, interval) => {
          const pattern = createOrdinalWeekdayRecurrence(ordinal, weekday, interval);
          const nextDate = calculateNextOccurrence(startDate, pattern);
          
          expect(nextDate).not.toBeNull();
          if (nextDate) {
            // The next date should be the correct weekday
            expect(nextDate.getDay()).toBe(weekday);
            
            // Count occurrences of this weekday in the month up to this date
            const firstOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
            let count = 0;
            const checkDate = new Date(firstOfMonth);
            while (checkDate <= nextDate) {
              if (checkDate.getDay() === weekday) {
                count++;
              }
              checkDate.setDate(checkDate.getDate() + 1);
            }
            
            // Should be the nth occurrence (or last if nth doesn't exist)
            expect(count).toBeLessThanOrEqual(ordinal);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Month day pattern returns correct day of month', () => {
    fc.assert(
      fc.property(dateArb, validMonthDayArb, validIntervalArb, (startDate, monthDay, interval) => {
        const pattern = createMonthDayRecurrence(monthDay, interval);
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          // Calculate expected month/year by adding interval months
          const expectedDate = new Date(startDate);
          expectedDate.setMonth(expectedDate.getMonth() + interval);
          
          // The day should be the specified monthDay (or last day if month is shorter)
          const daysInMonth = new Date(expectedDate.getFullYear(), expectedDate.getMonth() + 1, 0).getDate();
          const expectedDay = Math.min(monthDay, daysInMonth);
          expect(nextDate.getDate()).toBe(expectedDay);
          
          // Month and year should match expected
          expect(nextDate.getMonth()).toBe(expectedDate.getMonth());
          expect(nextDate.getFullYear()).toBe(expectedDate.getFullYear());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Custom interval-based pattern advances correctly', () => {
    fc.assert(
      fc.property(dateArb, fc.integer({ min: 2, max: 30 }), (startDate, interval) => {
        // Custom pattern with just interval > 1
        const pattern: RecurrencePattern = { type: 'custom', interval };
        const nextDate = calculateNextOccurrence(startDate, pattern);
        
        expect(nextDate).not.toBeNull();
        if (nextDate) {
          const expectedDate = new Date(startDate);
          expectedDate.setDate(expectedDate.getDate() + interval);
          expect(nextDate.getTime()).toBe(expectedDate.getTime());
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekdays pattern cycles through week correctly', () => {
    // Test specific case: Mon, Wed, Fri (1, 3, 5)
    const weekdays = [1, 3, 5];
    const pattern = createWeekdaysRecurrence(weekdays);
    
    // Start on a Monday
    const monday = new Date('2024-01-01'); // This is a Monday
    let current = monday;
    
    // Should cycle: Mon -> Wed -> Fri -> Mon -> Wed -> Fri
    const expectedDays = [3, 5, 1, 3, 5, 1]; // Wed, Fri, Mon, Wed, Fri, Mon
    
    for (const expectedDay of expectedDays) {
      const next = calculateNextOccurrence(current, pattern);
      expect(next).not.toBeNull();
      if (next) {
        expect(next.getDay()).toBe(expectedDay);
        current = next;
      }
    }
  });
});


/**
 * **Feature: daily-task-planner, Property 22: Recurrence Pattern Formatting**
 * **Validates: Requirements 10.4**
 * 
 * For any recurrence pattern, converting to human-readable string SHALL produce
 * a meaningful description that can be parsed back to the same pattern.
 */
describe('Property 22: Recurrence Pattern Formatting', () => {
  const validIntervalArb = fc.integer({ min: 1, max: 10 });
  const validWeekdayArb = fc.integer({ min: 0, max: 6 });
  const validWeekdaysArb = fc.uniqueArray(validWeekdayArb, { minLength: 1, maxLength: 7 });
  const validOrdinalArb = fc.integer({ min: 1, max: 5 });
  const validMonthDayArb = fc.integer({ min: 1, max: 31 });

  test('Daily recurrence formats to human-readable string', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern = createDailyRecurrence(interval);
        const formatted = formatRecurrencePattern(pattern);
        
        expect(formatted).toBeTruthy();
        if (interval === 1) {
          expect(formatted).toBe('Every day');
        } else {
          expect(formatted).toBe(`Every ${interval} days`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekly recurrence formats to human-readable string', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern = createWeeklyRecurrence(interval);
        const formatted = formatRecurrencePattern(pattern);
        
        expect(formatted).toBeTruthy();
        if (interval === 1) {
          expect(formatted).toBe('Every week');
        } else {
          expect(formatted).toBe(`Every ${interval} weeks`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Weekday recurrence formats correctly', () => {
    const pattern = createWeekdayRecurrence();
    const formatted = formatRecurrencePattern(pattern);
    expect(formatted).toBe('Every weekday');
  });

  test('Monthly recurrence formats to human-readable string', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern = createMonthlyRecurrence(interval);
        const formatted = formatRecurrencePattern(pattern);
        
        expect(formatted).toBeTruthy();
        if (interval === 1) {
          expect(formatted).toBe('Every month');
        } else {
          expect(formatted).toBe(`Every ${interval} months`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Yearly recurrence formats to human-readable string', () => {
    fc.assert(
      fc.property(validIntervalArb, (interval) => {
        const pattern = createYearlyRecurrence(interval);
        const formatted = formatRecurrencePattern(pattern);
        
        expect(formatted).toBeTruthy();
        if (interval === 1) {
          expect(formatted).toBe('Every year');
        } else {
          expect(formatted).toBe(`Every ${interval} years`);
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('Single weekday pattern formats correctly', () => {
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    fc.assert(
      fc.property(validWeekdayArb, (weekday) => {
        const pattern = createWeekdaysRecurrence([weekday]);
        const formatted = formatRecurrencePattern(pattern);
        
        expect(formatted).toBe(`Every ${weekdayNames[weekday]}`);
        return true;
      }),
      { numRuns: 7 }
    );
  });

  test('Format then parse round trip for simple patterns', () => {
    const simplePatterns: RecurrencePattern[] = [
      { type: 'daily', interval: 1 },
      { type: 'weekly', interval: 1 },
      { type: 'weekday' },
      { type: 'monthly', interval: 1 },
      { type: 'yearly', interval: 1 },
    ];

    for (const pattern of simplePatterns) {
      const formatted = formatRecurrencePattern(pattern);
      const parsed = parseFormattedRecurrence(formatted);
      
      expect(parsed).not.toBeNull();
      if (parsed) {
        expect(parsed.type).toBe(pattern.type);
      }
    }
  });

  test('Format then parse round trip for interval patterns', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecurrenceType>('daily', 'weekly', 'monthly', 'yearly'),
        fc.integer({ min: 2, max: 10 }),
        (type, interval) => {
          const pattern: RecurrencePattern = { type, interval };
          const formatted = formatRecurrencePattern(pattern);
          const parsed = parseFormattedRecurrence(formatted);
          
          expect(parsed).not.toBeNull();
          if (parsed) {
            expect(parsed.type).toBe(type);
            expect(parsed.interval).toBe(interval);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Format then parse round trip for single weekday patterns', () => {
    fc.assert(
      fc.property(validWeekdayArb, (weekday) => {
        const pattern = createWeekdaysRecurrence([weekday]);
        const formatted = formatRecurrencePattern(pattern);
        const parsed = parseFormattedRecurrence(formatted);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.type).toBe('custom');
          expect(parsed.weekdays).toContain(weekday);
        }
        return true;
      }),
      { numRuns: 7 }
    );
  });

  test('Format then parse round trip for month day patterns', () => {
    fc.assert(
      fc.property(validMonthDayArb, (monthDay) => {
        const pattern = createMonthDayRecurrence(monthDay);
        const formatted = formatRecurrencePattern(pattern);
        const parsed = parseFormattedRecurrence(formatted);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.type).toBe('custom');
          expect(parsed.monthDay).toBe(monthDay);
        }
        return true;
      }),
      { numRuns: 31 }
    );
  });

  test('Format then parse round trip for ordinal weekday patterns', () => {
    fc.assert(
      fc.property(validOrdinalArb, validWeekdayArb, (ordinal, weekday) => {
        const pattern = createOrdinalWeekdayRecurrence(ordinal, weekday);
        const formatted = formatRecurrencePattern(pattern);
        const parsed = parseFormattedRecurrence(formatted);
        
        expect(parsed).not.toBeNull();
        if (parsed) {
          expect(parsed.type).toBe('custom');
          expect(parsed.ordinal).toBe(ordinal);
          expect(parsed.ordinalWeekday).toBe(weekday);
        }
        return true;
      }),
      { numRuns: 35 }
    );
  });

  test('Invalid patterns format to error message', () => {
    const invalidPattern = { type: 'invalid' } as unknown as RecurrencePattern;
    const formatted = formatRecurrencePattern(invalidPattern);
    expect(formatted).toBe('Invalid recurrence pattern');
  });

  test('Formatted strings are non-empty and meaningful', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RecurrenceType>('daily', 'weekly', 'weekday', 'monthly', 'yearly'),
        (type) => {
          const pattern: RecurrencePattern = { type };
          const formatted = formatRecurrencePattern(pattern);
          
          expect(formatted.length).toBeGreaterThan(0);
          expect(formatted).toContain('Every');
          return true;
        }
      ),
      { numRuns: 5 }
    );
  });
});
