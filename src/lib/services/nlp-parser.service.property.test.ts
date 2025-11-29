/**
 * Property-based tests for NLP Parser service
 * 
 * Tests Properties 40, 41, 42, 43 from the design document
 * **Validates: Requirements 28.1, 28.2, 28.3, 28.5**
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { parse } from './nlp-parser.service';

// Reference date for consistent testing
const REFERENCE_DATE = new Date('2025-11-29T10:00:00');

// Priority keywords that should be detected
const HIGH_PRIORITY_KEYWORDS = ['urgent', 'asap', 'critical', 'high priority', 'high-priority'];
const MEDIUM_PRIORITY_KEYWORDS = ['important', 'medium priority', 'medium-priority'];
const LOW_PRIORITY_KEYWORDS = ['low priority', 'low-priority', 'whenever', 'someday'];

// Date/time phrases that chrono-node should parse
const DATE_PHRASES = [
  'tomorrow',
  'today',
  'next monday',
  'next week',
  'in 3 days',
  'next friday',
];

const TIME_PHRASES = [
  'at 3 PM',
  'at 9:30 AM',
  'at 14:00',
  'at noon',
  'at 5pm',
];

// List reference patterns
const LIST_PATTERNS = [
  { input: 'in Work', expected: 'Work' },
  { input: 'in #Personal', expected: 'Personal' },
  { input: '#Home', expected: 'Home' },
  { input: 'in My-List', expected: 'My-List' },
];

// Arbitraries for generating test data
// Generate realistic task names (alphanumeric with spaces)
const taskNameArb = fc.array(
  fc.constantFrom(
    'Buy', 'Call', 'Review', 'Write', 'Send', 'Fix', 'Update', 'Check',
    'Meet', 'Prepare', 'Schedule', 'Complete', 'Finish', 'Start', 'Plan',
    'groceries', 'report', 'email', 'code', 'document', 'meeting', 'task',
    'project', 'presentation', 'proposal', 'invoice', 'contract', 'design',
    'the', 'a', 'my', 'new', 'old', 'final', 'draft', 'weekly', 'monthly'
  ),
  { minLength: 1, maxLength: 4 }
).map(words => words.join(' '));

const highPriorityKeyword = fc.constantFrom(...HIGH_PRIORITY_KEYWORDS);
const mediumPriorityKeyword = fc.constantFrom(...MEDIUM_PRIORITY_KEYWORDS);
const lowPriorityKeyword = fc.constantFrom(...LOW_PRIORITY_KEYWORDS);

const datePhrase = fc.constantFrom(...DATE_PHRASES);
const timePhrase = fc.constantFrom(...TIME_PHRASES);




describe('Property 40: Natural Language Date Extraction', () => {
  /**
   * **Feature: daily-task-planner, Property 40: Natural Language Date Extraction**
   * **Validates: Requirements 28.1**
   * 
   * For any natural language input containing date/time references 
   * (e.g., "tomorrow", "next Monday", "at 3 PM"), the parser SHALL 
   * extract the correct date and time.
   */
  test('Date phrases are extracted correctly', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        datePhrase,
        (taskName, datePhr) => {
          const input = `${taskName} ${datePhr}`;
          const result = parse(input, REFERENCE_DATE);
          
          // Date should be extracted
          expect(result.date).toBeDefined();
          expect(result.date).toBeInstanceOf(Date);
          
          // The extracted date should be in the future relative to reference
          if (datePhr !== 'today') {
            expect(result.date!.getTime()).toBeGreaterThan(REFERENCE_DATE.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Time phrases extract time correctly', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        timePhrase,
        (taskName, timePhr) => {
          const input = `${taskName} ${timePhr}`;
          const result = parse(input, REFERENCE_DATE);
          
          // Time should be extracted
          expect(result.time).toBeDefined();
          expect(result.time).toMatch(/^\d{2}:\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined date and time phrases are extracted', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        datePhrase,
        timePhrase,
        (taskName, datePhr, timePhr) => {
          const input = `${taskName} ${datePhr} ${timePhr}`;
          const result = parse(input, REFERENCE_DATE);
          
          // Both date and time should be extracted
          expect(result.date).toBeDefined();
          expect(result.time).toBeDefined();
          expect(result.time).toMatch(/^\d{2}:\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('"tomorrow" extracts the next day', () => {
    const result = parse('Meeting tomorrow', REFERENCE_DATE);
    
    expect(result.date).toBeDefined();
    const expectedDate = new Date(REFERENCE_DATE);
    expectedDate.setDate(expectedDate.getDate() + 1);
    
    // Compare just the date parts
    expect(result.date!.getFullYear()).toBe(expectedDate.getFullYear());
    expect(result.date!.getMonth()).toBe(expectedDate.getMonth());
    expect(result.date!.getDate()).toBe(expectedDate.getDate());
  });

  test('"today" extracts the current day', () => {
    const result = parse('Meeting today', REFERENCE_DATE);
    
    expect(result.date).toBeDefined();
    expect(result.date!.getFullYear()).toBe(REFERENCE_DATE.getFullYear());
    expect(result.date!.getMonth()).toBe(REFERENCE_DATE.getMonth());
    expect(result.date!.getDate()).toBe(REFERENCE_DATE.getDate());
  });

  test('Specific time extracts correct hours and minutes', () => {
    const testCases = [
      { input: 'Meeting at 3 PM', expectedHour: 15, expectedMinute: 0 },
      { input: 'Call at 9:30 AM', expectedHour: 9, expectedMinute: 30 },
      { input: 'Lunch at noon', expectedHour: 12, expectedMinute: 0 },
    ];

    for (const { input, expectedHour, expectedMinute } of testCases) {
      const result = parse(input, REFERENCE_DATE);
      
      expect(result.time).toBeDefined();
      const [hours, minutes] = result.time!.split(':').map(Number);
      expect(hours).toBe(expectedHour);
      expect(minutes).toBe(expectedMinute);
    }
  });
});


describe('Property 41: Natural Language Priority Extraction', () => {
  /**
   * **Feature: daily-task-planner, Property 41: Natural Language Priority Extraction**
   * **Validates: Requirements 28.2**
   * 
   * For any natural language input containing priority indicators 
   * ("urgent", "high priority", "important"), the parser SHALL set 
   * the appropriate priority level.
   */
  test('High priority keywords set priority to high', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        highPriorityKeyword,
        (taskName, keyword) => {
          const input = `${keyword} ${taskName}`;
          const result = parse(input, REFERENCE_DATE);
          
          expect(result.priority).toBe('high');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Medium priority keywords set priority to medium', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        mediumPriorityKeyword,
        (taskName, keyword) => {
          const input = `${keyword} ${taskName}`;
          const result = parse(input, REFERENCE_DATE);
          
          expect(result.priority).toBe('medium');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Low priority keywords set priority to low', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        lowPriorityKeyword,
        (taskName, keyword) => {
          const input = `${keyword} ${taskName}`;
          const result = parse(input, REFERENCE_DATE);
          
          expect(result.priority).toBe('low');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Priority keywords are removed from task name', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        highPriorityKeyword,
        (taskName, keyword) => {
          const input = `${keyword} ${taskName}`;
          const result = parse(input, REFERENCE_DATE);
          
          // The keyword should not appear in the task name
          expect(result.name.toLowerCase()).not.toContain(keyword.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Priority keywords work case-insensitively', () => {
    const testCases = [
      { input: 'URGENT task', expected: 'high' },
      { input: 'Urgent task', expected: 'high' },
      { input: 'IMPORTANT meeting', expected: 'medium' },
      { input: 'Important meeting', expected: 'medium' },
    ];

    for (const { input, expected } of testCases) {
      const result = parse(input, REFERENCE_DATE);
      expect(result.priority).toBe(expected);
    }
  });

  test('Input without priority keywords has no priority set', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        (taskName) => {
          // Ensure the task name doesn't contain any priority keywords
          const cleanName = taskName
            .replace(/urgent|asap|critical|important|whenever|someday/gi, '')
            .replace(/high.?priority|medium.?priority|low.?priority/gi, '')
            .trim();
          
          if (cleanName.length === 0) return; // Skip empty names
          
          const result = parse(cleanName, REFERENCE_DATE);
          expect(result.priority).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 42: Natural Language List Extraction', () => {
  /**
   * **Feature: daily-task-planner, Property 42: Natural Language List Extraction**
   * **Validates: Requirements 28.3**
   * 
   * For any natural language input containing list references 
   * ("in Work", "#Personal"), the parser SHALL identify the target list.
   */
  test('List references with "in" prefix are extracted', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        fc.constantFrom('Work', 'Personal', 'Home', 'Shopping'),
        (taskName, listName) => {
          const input = `${taskName} in ${listName}`;
          const result = parse(input, REFERENCE_DATE);
          
          expect(result.listName).toBe(listName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('List references with hashtag are extracted', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        fc.constantFrom('Work', 'Personal', 'Home', 'Shopping'),
        (taskName, listName) => {
          const input = `${taskName} #${listName}`;
          const result = parse(input, REFERENCE_DATE);
          
          expect(result.listName).toBe(listName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('List references are removed from task name', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        fc.constantFrom('Work', 'Personal', 'Home'),
        (taskName, listName) => {
          const input = `${taskName} in ${listName}`;
          const result = parse(input, REFERENCE_DATE);
          
          // The list reference should not appear in the task name
          expect(result.name).not.toContain(`in ${listName}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Specific list patterns are extracted correctly', () => {
    for (const { input: pattern, expected } of LIST_PATTERNS) {
      const input = `Buy groceries ${pattern}`;
      const result = parse(input, REFERENCE_DATE);
      
      expect(result.listName).toBe(expected);
    }
  });

  test('Input without list reference has no listName set', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        (taskName) => {
          // Ensure the task name doesn't contain list patterns
          const cleanName = taskName
            .replace(/\bin\s+\w+/gi, '')
            .replace(/#\w+/g, '')
            .trim();
          
          if (cleanName.length === 0) return; // Skip empty names
          
          const result = parse(cleanName, REFERENCE_DATE);
          expect(result.listName).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Property 43: Natural Language Fallback', () => {
  /**
   * **Feature: daily-task-planner, Property 43: Natural Language Fallback**
   * **Validates: Requirements 28.5**
   * 
   * For any natural language input that cannot be parsed into structured data, 
   * the entire input SHALL be used as the task name.
   */
  test('Plain text without special patterns uses entire input as name', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        (taskName) => {
          // Ensure the task name doesn't contain any parseable patterns
          const cleanName = taskName
            .replace(/tomorrow|today|next|at\s+\d/gi, '')
            .replace(/urgent|asap|critical|important|whenever|someday/gi, '')
            .replace(/high.?priority|medium.?priority|low.?priority/gi, '')
            .replace(/\bin\s+\w+/gi, '')
            .replace(/#\w+/g, '')
            .trim();
          
          if (cleanName.length === 0) return; // Skip empty names
          
          const result = parse(cleanName, REFERENCE_DATE);
          
          // The name should be the cleaned input
          expect(result.name).toBe(cleanName);
          
          // No other fields should be set
          expect(result.date).toBeUndefined();
          expect(result.time).toBeUndefined();
          expect(result.priority).toBeUndefined();
          expect(result.listName).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Empty input returns empty name', () => {
    const result = parse('', REFERENCE_DATE);
    expect(result.name).toBe('');
  });

  test('Whitespace-only input returns empty name', () => {
    const whitespaceInputs = ['   ', '\t\t', '\n\n', '  \t  \n  '];
    
    for (const whitespace of whitespaceInputs) {
      const result = parse(whitespace, REFERENCE_DATE);
      expect(result.name).toBe('');
    }
  });

  test('Input with only date/time still has a name', () => {
    // When input is just a date phrase, chrono might consume it all
    // The fallback should use the original input as the name
    const result = parse('tomorrow', REFERENCE_DATE);
    
    // Should have a date
    expect(result.date).toBeDefined();
    
    // Name should be the original input since nothing else remains
    expect(result.name).toBe('tomorrow');
  });

  test('Complex input extracts all components', () => {
    const input = 'urgent Review PR in Work tomorrow at 3 PM';
    const result = parse(input, REFERENCE_DATE);
    
    // All components should be extracted
    expect(result.priority).toBe('high');
    expect(result.listName).toBe('Work');
    expect(result.date).toBeDefined();
    expect(result.time).toBe('15:00');
    
    // Name should be the remaining text
    expect(result.name).toContain('Review PR');
    expect(result.name).not.toContain('urgent');
    expect(result.name).not.toContain('in Work');
  });

  test('Fallback preserves original input when all parsing fails', () => {
    // Input that looks like it might have patterns but doesn't
    const inputs = [
      'Buy milk',
      'Call mom',
      'Fix the bug',
      'Write documentation',
    ];

    for (const input of inputs) {
      const result = parse(input, REFERENCE_DATE);
      expect(result.name).toBe(input);
    }
  });
});


describe('NLP Parser Integration', () => {
  /**
   * Integration tests combining multiple extraction features
   */
  test('All features work together', () => {
    fc.assert(
      fc.property(
        taskNameArb,
        highPriorityKeyword,
        fc.constantFrom('Work', 'Personal'),
        datePhrase,
        (taskName, priority, listName, datePhr) => {
          const input = `${priority} ${taskName} in ${listName} ${datePhr}`;
          const result = parse(input, REFERENCE_DATE);
          
          // Priority should be extracted
          expect(result.priority).toBe('high');
          
          // List should be extracted
          expect(result.listName).toBe(listName);
          
          // Date should be extracted
          expect(result.date).toBeDefined();
          
          // Name should not contain the extracted parts
          expect(result.name.toLowerCase()).not.toContain(priority.toLowerCase());
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Order of components does not matter', () => {
    const variations = [
      'urgent Buy groceries in Work tomorrow',
      'Buy groceries urgent in Work tomorrow',
      'Buy groceries in Work urgent tomorrow',
      'Buy groceries in Work tomorrow urgent',
    ];

    for (const input of variations) {
      const result = parse(input, REFERENCE_DATE);
      
      expect(result.priority).toBe('high');
      expect(result.listName).toBe('Work');
      expect(result.date).toBeDefined();
      expect(result.name).toContain('Buy groceries');
    }
  });
});
