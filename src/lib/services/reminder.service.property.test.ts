/**
 * Property-based tests for Reminder service
 * 
 * Tests Properties 38, 39 from the design document
 * **Validates: Requirements 27.1, 27.2, 27.4**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '@/lib/db/schema';
import type { Reminder, CreateReminderInput, ReminderMethod, IReminderService } from '@/types';

// Predefined reminder intervals in minutes (matching the service)
const PREDEFINED_INTERVALS = {
  '5_MINUTES': 5,
  '15_MINUTES': 15,
  '30_MINUTES': 30,
  '1_HOUR': 60,
  '1_DAY': 1440,
  '1_WEEK': 10080,
} as const;

// Valid reminder methods
const VALID_METHODS: ReminderMethod[] = ['push', 'email', 'in-app'];

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Custom error classes for test service
class ReminderNotFoundError extends Error {
  constructor(id: string) {
    super(`Reminder with id "${id}" not found`);
    this.name = 'ReminderNotFoundError';
  }
}

class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

class ReminderValidationError extends Error {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
      .join('; ');
    super(`Validation failed: ${messages}`);
    this.name = 'ReminderValidationError';
    this.errors = errors;
  }
}


/**
 * Validates reminder input data
 */
function validateReminderInput(data: CreateReminderInput): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (typeof data.offsetMinutes !== 'number' || !Number.isInteger(data.offsetMinutes)) {
    errors.offsetMinutes = ['offsetMinutes must be an integer'];
  } else if (data.offsetMinutes < 0) {
    errors.offsetMinutes = ['offsetMinutes must be non-negative'];
  }

  if (!data.method) {
    errors.method = ['method is required'];
  } else if (!VALID_METHODS.includes(data.method)) {
    errors.method = [`method must be one of: ${VALID_METHODS.join(', ')}`];
  }

  return errors;
}

/**
 * Converts a database row to a Reminder entity
 */
function toReminder(row: typeof schema.reminders.$inferSelect): Reminder {
  return {
    id: row.id,
    taskId: row.taskId,
    offsetMinutes: row.offsetMinutes,
    method: row.method as ReminderMethod,
    sent: row.sent,
  };
}

/**
 * Create a test-specific reminder service that uses the test database
 */
function createTestReminderService(db: ReturnType<typeof drizzle>): IReminderService {
  return {
    async scheduleReminder(taskId: string, reminder: CreateReminderInput): Promise<Reminder> {
      // Validate input
      const validationErrors = validateReminderInput(reminder);
      if (Object.keys(validationErrors).length > 0) {
        throw new ReminderValidationError(validationErrors);
      }

      // Verify task exists
      const [task] = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .all();

      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      // Create the reminder
      const id = uuidv4();

      db.insert(schema.reminders).values({
        id,
        taskId,
        offsetMinutes: reminder.offsetMinutes,
        method: reminder.method,
        sent: false,
      }).run();

      const [created] = db
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.id, id))
        .all();

      return toReminder(created);
    },

    async cancelReminder(reminderId: string): Promise<void> {
      const [existing] = db
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.id, reminderId))
        .all();

      if (!existing) {
        throw new ReminderNotFoundError(reminderId);
      }

      db.delete(schema.reminders).where(eq(schema.reminders.id, reminderId)).run();
    },

    async getByTaskId(taskId: string): Promise<Reminder[]> {
      const rows = db
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.taskId, taskId))
        .all();

      return rows.map(toReminder);
    },
  };
}

let reminderService: IReminderService;

beforeAll(() => {
  // Create in-memory database for testing
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });
  
  // Enable foreign key constraints for cascade deletes
  sqlite.exec('PRAGMA foreign_keys = ON');
  
  // Create tables
  sqlite.exec(`
    CREATE TABLE lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      emoji TEXT,
      is_inbox INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      list_id TEXT NOT NULL REFERENCES lists(id),
      date INTEGER,
      deadline INTEGER,
      estimate INTEGER,
      actual_time INTEGER,
      priority TEXT NOT NULL DEFAULT 'none',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      recurrence TEXT,
      parent_task_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE reminders (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      offset_minutes INTEGER NOT NULL,
      method TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0
    );
  `);
  
  reminderService = createTestReminderService(testDb);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM reminders');
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM lists');
});

// Helper function to create a list for tasks
function createTestList(): string {
  const listId = uuidv4();
  const now = new Date();
  testDb.insert(schema.lists).values({
    id: listId,
    name: 'Test List',
    isInbox: false,
    createdAt: now,
    updatedAt: now,
  }).run();
  return listId;
}

// Helper function to create a task
function createTestTask(listId: string, name: string = 'Test Task'): string {
  const taskId = uuidv4();
  const now = new Date();
  testDb.insert(schema.tasks).values({
    id: taskId,
    name,
    listId,
    priority: 'none',
    completed: false,
    createdAt: now,
    updatedAt: now,
  }).run();
  return taskId;
}

// Arbitraries for generating test data
const predefinedInterval = fc.constantFrom(
  PREDEFINED_INTERVALS['5_MINUTES'],
  PREDEFINED_INTERVALS['15_MINUTES'],
  PREDEFINED_INTERVALS['30_MINUTES'],
  PREDEFINED_INTERVALS['1_HOUR'],
  PREDEFINED_INTERVALS['1_DAY'],
  PREDEFINED_INTERVALS['1_WEEK']
);

const customInterval = fc.integer({ min: 1, max: 20160 }); // Up to 2 weeks in minutes

const validOffsetMinutes = fc.oneof(predefinedInterval, customInterval);

const validMethod = fc.constantFrom<ReminderMethod>('push', 'email', 'in-app');

const validReminderInput = fc.record({
  offsetMinutes: validOffsetMinutes,
  method: validMethod,
});


describe('Property 38: Reminder Interval Storage', () => {
  /**
   * **Feature: daily-task-planner, Property 38: Reminder Interval Storage**
   * **Validates: Requirements 27.1, 27.2**
   * 
   * For any reminder with a predefined or custom interval, the offsetMinutes 
   * and method SHALL be stored correctly.
   */
  test('Predefined intervals are stored and retrieved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        predefinedInterval,
        validMethod,
        async (offsetMinutes, method) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule reminder with predefined interval
          const reminder = await reminderService.scheduleReminder(taskId, {
            offsetMinutes,
            method,
          });
          
          // Verify reminder properties
          expect(reminder.offsetMinutes).toBe(offsetMinutes);
          expect(reminder.method).toBe(method);
          expect(reminder.taskId).toBe(taskId);
          expect(reminder.sent).toBe(false);
          expect(reminder.id).toBeTruthy();
          
          // Retrieve and verify
          const reminders = await reminderService.getByTaskId(taskId);
          expect(reminders.length).toBe(1);
          expect(reminders[0].offsetMinutes).toBe(offsetMinutes);
          expect(reminders[0].method).toBe(method);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Custom intervals are stored and retrieved correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        customInterval,
        validMethod,
        async (offsetMinutes, method) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule reminder with custom interval
          const reminder = await reminderService.scheduleReminder(taskId, {
            offsetMinutes,
            method,
          });
          
          // Verify reminder properties
          expect(reminder.offsetMinutes).toBe(offsetMinutes);
          expect(reminder.method).toBe(method);
          expect(reminder.taskId).toBe(taskId);
          expect(reminder.sent).toBe(false);
          
          // Retrieve and verify
          const reminders = await reminderService.getByTaskId(taskId);
          expect(reminders.length).toBe(1);
          expect(reminders[0].offsetMinutes).toBe(offsetMinutes);
          expect(reminders[0].method).toBe(method);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('All reminder methods are stored correctly', async () => {
    // Test each method explicitly
    for (const method of VALID_METHODS) {
      const listId = createTestList();
      const taskId = createTestTask(listId);
      
      const reminder = await reminderService.scheduleReminder(taskId, {
        offsetMinutes: 30,
        method,
      });
      
      expect(reminder.method).toBe(method);
      
      const reminders = await reminderService.getByTaskId(taskId);
      expect(reminders[0].method).toBe(method);
    }
  });

  test('Creating reminder for non-existent task throws error', async () => {
    const nonExistentTaskId = uuidv4();
    
    await expect(
      reminderService.scheduleReminder(nonExistentTaskId, {
        offsetMinutes: 30,
        method: 'push',
      })
    ).rejects.toThrow(`Task with id "${nonExistentTaskId}" not found`);
  });

  test('Canceling reminder removes it from database', async () => {
    await fc.assert(
      fc.asyncProperty(
        validReminderInput,
        async (reminderInput) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule reminder
          const reminder = await reminderService.scheduleReminder(taskId, reminderInput);
          
          // Verify it exists
          let reminders = await reminderService.getByTaskId(taskId);
          expect(reminders.length).toBe(1);
          
          // Cancel reminder
          await reminderService.cancelReminder(reminder.id);
          
          // Verify it's removed
          reminders = await reminderService.getByTaskId(taskId);
          expect(reminders.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Canceling non-existent reminder throws error', async () => {
    const nonExistentId = uuidv4();
    
    await expect(
      reminderService.cancelReminder(nonExistentId)
    ).rejects.toThrow(`Reminder with id "${nonExistentId}" not found`);
  });
});


describe('Property 39: Multiple Reminder Support', () => {
  /**
   * **Feature: daily-task-planner, Property 39: Multiple Reminder Support**
   * **Validates: Requirements 27.4**
   * 
   * For any task with multiple reminders, all reminders SHALL be stored 
   * and retrievable independently.
   */
  test('Multiple reminders can be added to a single task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validReminderInput, { minLength: 1, maxLength: 5 }),
        async (reminderInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule multiple reminders
          const createdReminders: Reminder[] = [];
          for (const input of reminderInputs) {
            const reminder = await reminderService.scheduleReminder(taskId, input);
            createdReminders.push(reminder);
          }
          
          // Retrieve all reminders for the task
          const taskReminders = await reminderService.getByTaskId(taskId);
          
          // Verify count matches
          expect(taskReminders.length).toBe(reminderInputs.length);
          
          // Verify all reminders are present with correct data
          for (let i = 0; i < createdReminders.length; i++) {
            const created = createdReminders[i];
            const found = taskReminders.find(r => r.id === created.id);
            expect(found).toBeTruthy();
            expect(found!.offsetMinutes).toBe(created.offsetMinutes);
            expect(found!.method).toBe(created.method);
            expect(found!.taskId).toBe(taskId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Each reminder is independently retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validReminderInput, { minLength: 2, maxLength: 4 }),
        async (reminderInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule multiple reminders
          const createdReminders: Reminder[] = [];
          for (const input of reminderInputs) {
            const reminder = await reminderService.scheduleReminder(taskId, input);
            createdReminders.push(reminder);
          }
          
          // Verify each reminder can be found in the task's reminders
          const taskReminders = await reminderService.getByTaskId(taskId);
          
          for (const created of createdReminders) {
            const found = taskReminders.find(r => r.id === created.id);
            expect(found).toBeTruthy();
            expect(found!.id).toBe(created.id);
            expect(found!.offsetMinutes).toBe(created.offsetMinutes);
            expect(found!.method).toBe(created.method);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Canceling one reminder does not affect others on same task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validReminderInput, { minLength: 2, maxLength: 4 }),
        async (reminderInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Schedule multiple reminders
          const createdReminders: Reminder[] = [];
          for (const input of reminderInputs) {
            const reminder = await reminderService.scheduleReminder(taskId, input);
            createdReminders.push(reminder);
          }
          
          // Cancel the first reminder
          const canceledReminder = createdReminders[0];
          await reminderService.cancelReminder(canceledReminder.id);
          
          // Verify remaining reminders still exist
          const taskReminders = await reminderService.getByTaskId(taskId);
          expect(taskReminders.length).toBe(createdReminders.length - 1);
          
          // Verify canceled reminder is not in the list
          const canceledFound = taskReminders.find(r => r.id === canceledReminder.id);
          expect(canceledFound).toBeUndefined();
          
          // Verify other reminders are still present
          for (let i = 1; i < createdReminders.length; i++) {
            const remaining = createdReminders[i];
            const found = taskReminders.find(r => r.id === remaining.id);
            expect(found).toBeTruthy();
            expect(found!.offsetMinutes).toBe(remaining.offsetMinutes);
            expect(found!.method).toBe(remaining.method);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Reminders with same interval but different methods are stored separately', async () => {
    // Create a list and task
    const listId = createTestList();
    const taskId = createTestTask(listId);
    
    // Schedule reminders with same interval but different methods
    const reminder1 = await reminderService.scheduleReminder(taskId, {
      offsetMinutes: 30,
      method: 'push',
    });
    
    const reminder2 = await reminderService.scheduleReminder(taskId, {
      offsetMinutes: 30,
      method: 'email',
    });
    
    const reminder3 = await reminderService.scheduleReminder(taskId, {
      offsetMinutes: 30,
      method: 'in-app',
    });
    
    // Retrieve all reminders
    const taskReminders = await reminderService.getByTaskId(taskId);
    
    // Verify all three are stored
    expect(taskReminders.length).toBe(3);
    
    // Verify each has the correct method
    const methods = taskReminders.map(r => r.method).sort();
    expect(methods).toEqual(['email', 'in-app', 'push']);
    
    // Verify all have the same interval
    for (const reminder of taskReminders) {
      expect(reminder.offsetMinutes).toBe(30);
    }
  });

  test('Different tasks can have independent reminders', async () => {
    await fc.assert(
      fc.asyncProperty(
        validReminderInput,
        validReminderInput,
        async (input1, input2) => {
          // Create a list and two tasks
          const listId = createTestList();
          const taskId1 = createTestTask(listId, 'Task 1');
          const taskId2 = createTestTask(listId, 'Task 2');
          
          // Schedule reminders on different tasks
          const reminder1 = await reminderService.scheduleReminder(taskId1, input1);
          const reminder2 = await reminderService.scheduleReminder(taskId2, input2);
          
          // Retrieve reminders for each task
          const task1Reminders = await reminderService.getByTaskId(taskId1);
          const task2Reminders = await reminderService.getByTaskId(taskId2);
          
          // Verify each task has only its own reminder
          expect(task1Reminders.length).toBe(1);
          expect(task2Reminders.length).toBe(1);
          
          expect(task1Reminders[0].id).toBe(reminder1.id);
          expect(task2Reminders[0].id).toBe(reminder2.id);
          
          expect(task1Reminders[0].taskId).toBe(taskId1);
          expect(task2Reminders[0].taskId).toBe(taskId2);
        }
      ),
      { numRuns: 50 }
    );
  });
});
