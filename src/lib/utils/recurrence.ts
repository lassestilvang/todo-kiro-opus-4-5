import type { RecurrencePattern, RecurrenceType } from '@/types';

// Valid recurrence types
export const VALID_RECURRENCE_TYPES: RecurrenceType[] = [
  'daily',
  'weekly',
  'weekday',
  'monthly',
  'yearly',
  'custom',
];

// Weekday names for formatting
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Ordinal suffixes
const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd'];

/**
 * Gets the ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const v = n % 100;
  return ORDINAL_SUFFIXES[(v - 20) % 10] || ORDINAL_SUFFIXES[v] || ORDINAL_SUFFIXES[0];
}

/**
 * Formats a number with its ordinal suffix
 */
function formatOrdinal(n: number): string {
  return `${n}${getOrdinalSuffix(n)}`;
}

/**
 * Validation result for recurrence patterns
 */
export interface RecurrenceValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a recurrence pattern.
 * Checks that the type is valid and any additional fields are properly configured.
 * @param pattern - The recurrence pattern to validate
 * @returns Validation result with any errors
 */
export function validateRecurrencePattern(pattern: RecurrencePattern): RecurrenceValidationResult {
  const errors: string[] = [];

  // Validate type
  if (!VALID_RECURRENCE_TYPES.includes(pattern.type)) {
    errors.push(`Invalid recurrence type: ${pattern.type}. Must be one of: ${VALID_RECURRENCE_TYPES.join(', ')}`);
    return { valid: false, errors };
  }

  // Validate interval if provided (must be positive integer)
  if (pattern.interval !== undefined) {
    if (!Number.isInteger(pattern.interval) || pattern.interval < 1) {
      errors.push('Interval must be a positive integer');
    }
  }

  // Validate weekdays if provided
  if (pattern.weekdays !== undefined) {
    if (!Array.isArray(pattern.weekdays)) {
      errors.push('Weekdays must be an array');
    } else {
      for (const day of pattern.weekdays) {
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          errors.push(`Invalid weekday: ${day}. Must be 0-6 (Sunday-Saturday)`);
        }
      }
      if (pattern.weekdays.length === 0) {
        errors.push('Weekdays array cannot be empty when specified');
      }
    }
  }

  // Validate monthDay if provided
  if (pattern.monthDay !== undefined) {
    if (!Number.isInteger(pattern.monthDay) || pattern.monthDay < 1 || pattern.monthDay > 31) {
      errors.push(`Invalid month day: ${pattern.monthDay}. Must be 1-31`);
    }
  }

  // Validate ordinal if provided
  if (pattern.ordinal !== undefined) {
    if (!Number.isInteger(pattern.ordinal) || pattern.ordinal < 1 || pattern.ordinal > 5) {
      errors.push(`Invalid ordinal: ${pattern.ordinal}. Must be 1-5`);
    }
  }

  // Validate ordinalWeekday if provided
  if (pattern.ordinalWeekday !== undefined) {
    if (!Number.isInteger(pattern.ordinalWeekday) || pattern.ordinalWeekday < 0 || pattern.ordinalWeekday > 6) {
      errors.push(`Invalid ordinal weekday: ${pattern.ordinalWeekday}. Must be 0-6 (Sunday-Saturday)`);
    }
  }

  // Custom type validation: must have at least one custom field
  if (pattern.type === 'custom') {
    const hasCustomField = 
      (pattern.interval !== undefined && pattern.interval !== 1) ||
      pattern.weekdays !== undefined ||
      pattern.monthDay !== undefined ||
      (pattern.ordinal !== undefined && pattern.ordinalWeekday !== undefined);
    
    if (!hasCustomField) {
      errors.push('Custom recurrence must specify at least one of: interval > 1, weekdays, monthDay, or ordinal with ordinalWeekday');
    }
  }

  // Ordinal and ordinalWeekday must be used together
  if ((pattern.ordinal !== undefined) !== (pattern.ordinalWeekday !== undefined)) {
    errors.push('Ordinal and ordinalWeekday must be specified together');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parses and validates a recurrence pattern.
 * Returns the pattern if valid, throws an error if invalid.
 * @param pattern - The recurrence pattern to parse
 * @returns The validated pattern
 * @throws Error if the pattern is invalid
 */
export function parseRecurrencePattern(pattern: RecurrencePattern): RecurrencePattern {
  const validation = validateRecurrencePattern(pattern);
  if (!validation.valid) {
    throw new Error(`Invalid recurrence pattern: ${validation.errors.join('; ')}`);
  }

  // Normalize the pattern
  const normalized: RecurrencePattern = {
    type: pattern.type,
  };

  // Only include interval if it's not the default (1)
  if (pattern.interval !== undefined && pattern.interval !== 1) {
    normalized.interval = pattern.interval;
  } else if (pattern.type !== 'custom' && pattern.type !== 'weekday') {
    // For non-custom types, default interval is 1
    normalized.interval = pattern.interval ?? 1;
  }

  // Include weekdays if specified (sorted and deduplicated)
  if (pattern.weekdays !== undefined && pattern.weekdays.length > 0) {
    normalized.weekdays = [...new Set(pattern.weekdays)].sort((a, b) => a - b);
  }

  // Include monthDay if specified
  if (pattern.monthDay !== undefined) {
    normalized.monthDay = pattern.monthDay;
  }

  // Include ordinal fields if specified
  if (pattern.ordinal !== undefined && pattern.ordinalWeekday !== undefined) {
    normalized.ordinal = pattern.ordinal;
    normalized.ordinalWeekday = pattern.ordinalWeekday;
  }

  return normalized;
}


/**
 * Gets the number of days in a month.
 * @param year - The year
 * @param month - The month (0-11)
 * @returns Number of days in the month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculates the next occurrence date for a recurring task.
 * @param currentDate - The current task date
 * @param recurrence - The recurrence pattern
 * @returns The next occurrence date or null if cannot be calculated
 */
export function calculateNextOccurrence(currentDate: Date, recurrence: RecurrencePattern): Date | null {
  // Validate the pattern first
  const validation = validateRecurrencePattern(recurrence);
  if (!validation.valid) {
    return null;
  }

  const date = new Date(currentDate);
  const interval = recurrence.interval ?? 1;

  switch (recurrence.type) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      return date;

    case 'weekly':
      date.setDate(date.getDate() + (7 * interval));
      return date;

    case 'weekday':
      // Move to next weekday (Mon-Fri)
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      return date;

    case 'monthly':
      return calculateMonthlyRecurrence(date, interval);

    case 'yearly':
      return calculateYearlyRecurrence(date, interval);

    case 'custom':
      return calculateCustomRecurrence(date, recurrence);

    default:
      return null;
  }
}

/**
 * Calculates the next monthly occurrence.
 * Handles edge cases like months with fewer days.
 */
function calculateMonthlyRecurrence(currentDate: Date, interval: number): Date {
  const date = new Date(currentDate);
  const originalDay = date.getDate();
  
  // Move to next month(s)
  date.setMonth(date.getMonth() + interval);
  
  // Handle months with fewer days (e.g., Jan 31 -> Feb 28)
  const daysInNewMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
  if (originalDay > daysInNewMonth) {
    date.setDate(daysInNewMonth);
  }
  
  return date;
}

/**
 * Calculates the next yearly occurrence.
 * Handles leap year edge cases (Feb 29).
 */
function calculateYearlyRecurrence(currentDate: Date, interval: number): Date {
  const date = new Date(currentDate);
  const originalMonth = date.getMonth();
  const originalDay = date.getDate();
  
  // Move to next year(s)
  date.setFullYear(date.getFullYear() + interval);
  
  // Handle Feb 29 in non-leap years
  if (originalMonth === 1 && originalDay === 29) {
    const daysInFeb = getDaysInMonth(date.getFullYear(), 1);
    if (daysInFeb < 29) {
      date.setDate(28);
    }
  }
  
  return date;
}

/**
 * Calculates the next occurrence for custom recurrence patterns.
 * Supports: interval-based, specific weekdays, ordinal weekday, specific month day.
 */
function calculateCustomRecurrence(currentDate: Date, recurrence: RecurrencePattern): Date | null {
  const date = new Date(currentDate);
  const interval = recurrence.interval ?? 1;

  // Handle specific weekdays pattern (e.g., Mon, Wed, Fri)
  if (recurrence.weekdays && recurrence.weekdays.length > 0) {
    return calculateWeekdaysRecurrence(date, recurrence.weekdays);
  }

  // Handle ordinal weekday pattern (e.g., 3rd Monday of each month)
  if (recurrence.ordinal !== undefined && recurrence.ordinalWeekday !== undefined) {
    return calculateOrdinalWeekdayRecurrence(date, recurrence.ordinal, recurrence.ordinalWeekday, interval);
  }

  // Handle specific day of month
  if (recurrence.monthDay !== undefined) {
    return calculateMonthDayRecurrence(date, recurrence.monthDay, interval);
  }

  // Default: just add interval days
  date.setDate(date.getDate() + interval);
  return date;
}

/**
 * Calculates the next occurrence for specific weekdays pattern.
 * E.g., every Mon, Wed, Fri
 */
function calculateWeekdaysRecurrence(currentDate: Date, weekdays: number[]): Date {
  const date = new Date(currentDate);
  const sortedWeekdays = [...weekdays].sort((a, b) => a - b);
  const currentDay = date.getDay();
  
  // Find the next weekday in the pattern
  const nextDay = sortedWeekdays.find(d => d > currentDay);
  
  if (nextDay !== undefined) {
    // Found a day later this week
    date.setDate(date.getDate() + (nextDay - currentDay));
  } else {
    // Move to next week and use the first day in the pattern
    const daysUntilNextWeek = 7 - currentDay + sortedWeekdays[0];
    date.setDate(date.getDate() + daysUntilNextWeek);
  }
  
  return date;
}

/**
 * Calculates the next occurrence for ordinal weekday pattern.
 * E.g., 3rd Monday of each month
 */
function calculateOrdinalWeekdayRecurrence(
  currentDate: Date,
  ordinal: number,
  weekday: number,
  interval: number
): Date {
  const date = new Date(currentDate);
  
  // Move to next month(s)
  date.setMonth(date.getMonth() + interval);
  date.setDate(1);
  
  // Find the nth occurrence of the weekday in this month
  let count = 0;
  const targetMonth = date.getMonth();
  
  while (date.getMonth() === targetMonth) {
    if (date.getDay() === weekday) {
      count++;
      if (count === ordinal) {
        return date;
      }
    }
    date.setDate(date.getDate() + 1);
  }
  
  // If the ordinal doesn't exist (e.g., 5th Monday), return the last occurrence
  // Go back to find the last occurrence
  date.setDate(date.getDate() - 1);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  
  return date;
}

/**
 * Calculates the next occurrence for specific month day pattern.
 * E.g., 15th of each month
 */
function calculateMonthDayRecurrence(currentDate: Date, monthDay: number, interval: number): Date {
  const date = new Date(currentDate);
  
  // Move to next month(s)
  date.setMonth(date.getMonth() + interval);
  
  // Set to the target day, clamped to the days in the month
  const daysInMonth = getDaysInMonth(date.getFullYear(), date.getMonth());
  date.setDate(Math.min(monthDay, daysInMonth));
  
  return date;
}


/**
 * Formats a recurrence pattern to a human-readable string.
 * @param pattern - The recurrence pattern to format
 * @returns Human-readable description of the pattern
 */
export function formatRecurrencePattern(pattern: RecurrencePattern): string {
  const validation = validateRecurrencePattern(pattern);
  if (!validation.valid) {
    return 'Invalid recurrence pattern';
  }

  const interval = pattern.interval ?? 1;

  switch (pattern.type) {
    case 'daily':
      if (interval === 1) {
        return 'Every day';
      }
      return `Every ${interval} days`;

    case 'weekly':
      if (interval === 1) {
        return 'Every week';
      }
      return `Every ${interval} weeks`;

    case 'weekday':
      return 'Every weekday';

    case 'monthly':
      if (interval === 1) {
        return 'Every month';
      }
      return `Every ${interval} months`;

    case 'yearly':
      if (interval === 1) {
        return 'Every year';
      }
      return `Every ${interval} years`;

    case 'custom':
      return formatCustomRecurrence(pattern);

    default:
      return 'Unknown recurrence';
  }
}

/**
 * Formats a custom recurrence pattern to a human-readable string.
 */
function formatCustomRecurrence(pattern: RecurrencePattern): string {
  const interval = pattern.interval ?? 1;

  // Handle specific weekdays pattern
  if (pattern.weekdays && pattern.weekdays.length > 0) {
    const dayNames = pattern.weekdays
      .sort((a, b) => a - b)
      .map(d => WEEKDAY_SHORT_NAMES[d]);
    
    if (dayNames.length === 1) {
      return `Every ${WEEKDAY_NAMES[pattern.weekdays[0]]}`;
    }
    
    if (dayNames.length === 2) {
      return `Every ${dayNames[0]} and ${dayNames[1]}`;
    }
    
    const lastDay = dayNames.pop();
    return `Every ${dayNames.join(', ')}, and ${lastDay}`;
  }

  // Handle ordinal weekday pattern
  if (pattern.ordinal !== undefined && pattern.ordinalWeekday !== undefined) {
    const ordinalStr = formatOrdinal(pattern.ordinal);
    const weekdayStr = WEEKDAY_NAMES[pattern.ordinalWeekday];
    
    if (interval === 1) {
      return `Every ${ordinalStr} ${weekdayStr} of the month`;
    }
    return `Every ${ordinalStr} ${weekdayStr} every ${interval} months`;
  }

  // Handle specific month day
  if (pattern.monthDay !== undefined) {
    const dayStr = formatOrdinal(pattern.monthDay);
    
    if (interval === 1) {
      return `Every ${dayStr} of the month`;
    }
    return `Every ${dayStr} every ${interval} months`;
  }

  // Default interval-based
  if (interval > 1) {
    return `Every ${interval} days`;
  }

  return 'Custom recurrence';
}

/**
 * Parses a human-readable recurrence string back to a RecurrencePattern.
 * This is the inverse of formatRecurrencePattern for round-trip testing.
 * @param formatted - The formatted string to parse
 * @returns The parsed RecurrencePattern or null if parsing fails
 */
export function parseFormattedRecurrence(formatted: string): RecurrencePattern | null {
  const lower = formatted.toLowerCase().trim();

  // Simple patterns
  if (lower === 'every day') {
    return { type: 'daily', interval: 1 };
  }
  if (lower === 'every week') {
    return { type: 'weekly', interval: 1 };
  }
  if (lower === 'every weekday') {
    return { type: 'weekday' };
  }
  if (lower === 'every month') {
    return { type: 'monthly', interval: 1 };
  }
  if (lower === 'every year') {
    return { type: 'yearly', interval: 1 };
  }

  // Interval patterns: "Every N days/weeks/months/years"
  const intervalMatch = lower.match(/^every (\d+) (days?|weeks?|months?|years?)$/);
  if (intervalMatch) {
    const interval = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2];
    
    if (unit.startsWith('day')) {
      return { type: 'daily', interval };
    }
    if (unit.startsWith('week')) {
      return { type: 'weekly', interval };
    }
    if (unit.startsWith('month')) {
      return { type: 'monthly', interval };
    }
    if (unit.startsWith('year')) {
      return { type: 'yearly', interval };
    }
  }

  // Single weekday: "Every Monday"
  const singleWeekdayMatch = lower.match(/^every (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (singleWeekdayMatch) {
    const weekday = WEEKDAY_NAMES.findIndex(
      name => name.toLowerCase() === singleWeekdayMatch[1]
    );
    if (weekday !== -1) {
      return { type: 'custom', weekdays: [weekday] };
    }
  }

  // Multiple weekdays: "Every Mon, Wed, and Fri" or "Every Mon and Tue"
  const multiWeekdayMatch = lower.match(/^every (.+)$/);
  if (multiWeekdayMatch) {
    const daysStr = multiWeekdayMatch[1];
    // Check if it looks like a weekday list
    const dayParts = daysStr.split(/,?\s+and\s+|,\s*/);
    const weekdays: number[] = [];
    
    for (const part of dayParts) {
      const trimmed = part.trim();
      const idx = WEEKDAY_SHORT_NAMES.findIndex(
        name => name.toLowerCase() === trimmed
      );
      if (idx !== -1) {
        weekdays.push(idx);
      } else {
        // Try full name
        const fullIdx = WEEKDAY_NAMES.findIndex(
          name => name.toLowerCase() === trimmed
        );
        if (fullIdx !== -1) {
          weekdays.push(fullIdx);
        }
      }
    }
    
    if (weekdays.length > 0 && weekdays.length === dayParts.length) {
      return { type: 'custom', weekdays: [...new Set(weekdays)].sort((a, b) => a - b) };
    }
  }

  // Ordinal weekday: "Every 3rd Monday of the month"
  const ordinalMatch = lower.match(/^every (\d+)(?:st|nd|rd|th) (sunday|monday|tuesday|wednesday|thursday|friday|saturday) of the month$/);
  if (ordinalMatch) {
    const ordinal = parseInt(ordinalMatch[1], 10);
    const weekday = WEEKDAY_NAMES.findIndex(
      name => name.toLowerCase() === ordinalMatch[2]
    );
    if (weekday !== -1 && ordinal >= 1 && ordinal <= 5) {
      return { type: 'custom', ordinal, ordinalWeekday: weekday };
    }
  }

  // Month day: "Every 15th of the month"
  const monthDayMatch = lower.match(/^every (\d+)(?:st|nd|rd|th) of the month$/);
  if (monthDayMatch) {
    const monthDay = parseInt(monthDayMatch[1], 10);
    if (monthDay >= 1 && monthDay <= 31) {
      return { type: 'custom', monthDay };
    }
  }

  return null;
}

/**
 * Creates a simple daily recurrence pattern.
 */
export function createDailyRecurrence(interval = 1): RecurrencePattern {
  return { type: 'daily', interval };
}

/**
 * Creates a simple weekly recurrence pattern.
 */
export function createWeeklyRecurrence(interval = 1): RecurrencePattern {
  return { type: 'weekly', interval };
}

/**
 * Creates a weekday (Mon-Fri) recurrence pattern.
 */
export function createWeekdayRecurrence(): RecurrencePattern {
  return { type: 'weekday' };
}

/**
 * Creates a monthly recurrence pattern.
 */
export function createMonthlyRecurrence(interval = 1): RecurrencePattern {
  return { type: 'monthly', interval };
}

/**
 * Creates a yearly recurrence pattern.
 */
export function createYearlyRecurrence(interval = 1): RecurrencePattern {
  return { type: 'yearly', interval };
}

/**
 * Creates a custom recurrence pattern for specific weekdays.
 * @param weekdays - Array of weekday numbers (0=Sunday, 6=Saturday)
 */
export function createWeekdaysRecurrence(weekdays: number[]): RecurrencePattern {
  return { type: 'custom', weekdays: [...new Set(weekdays)].sort((a, b) => a - b) };
}

/**
 * Creates a custom recurrence pattern for ordinal weekday.
 * @param ordinal - Which occurrence (1=first, 2=second, etc.)
 * @param weekday - Weekday number (0=Sunday, 6=Saturday)
 * @param interval - Month interval (default 1)
 */
export function createOrdinalWeekdayRecurrence(
  ordinal: number,
  weekday: number,
  interval = 1
): RecurrencePattern {
  return { type: 'custom', ordinal, ordinalWeekday: weekday, interval };
}

/**
 * Creates a custom recurrence pattern for specific day of month.
 * @param monthDay - Day of month (1-31)
 * @param interval - Month interval (default 1)
 */
export function createMonthDayRecurrence(monthDay: number, interval = 1): RecurrencePattern {
  return { type: 'custom', monthDay, interval };
}
