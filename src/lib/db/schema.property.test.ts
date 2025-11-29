/**
 * Property-based tests for database schema constraints
 * 
 * **Feature: daily-task-planner, Property 36: Data Persistence Round Trip**
 * **Validates: Requirements 23.1, 23.2**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from './schema';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

beforeAll(() => {
  // Create in-memory database for testing
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });
  
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
    
    CREATE TABLE labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
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
  `);
});

afterAll(() => {
  sqlite.close();
});


beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM labels');
  sqlite.exec('DELETE FROM lists');
});

// Arbitraries for generating test data
const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const optionalString = fc.option(nonEmptyString, { nil: undefined });

const hexColor = fc.array(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`);

const optionalColor = fc.option(hexColor, { nil: undefined });

const emoji = fc.constantFrom('📝', '🎯', '💼', '🏠', '🎨', '📚', '🔧', '⭐');
const optionalEmoji = fc.option(emoji, { nil: undefined });

const priority = fc.constantFrom('high', 'medium', 'low', 'none');

const timestamp = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31')
}).filter(d => !isNaN(d.getTime()));

const optionalTimestamp = fc.option(timestamp, { nil: undefined });

describe('Property 36: Data Persistence Round Trip', () => {
  /**
   * **Feature: daily-task-planner, Property 36: Data Persistence Round Trip**
   * **Validates: Requirements 23.1, 23.2**
   * 
   * For any list created, the entity SHALL be retrievable from the database
   * with all properties intact.
   */
  test('List round trip: created lists are retrievable with all properties intact', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        optionalColor,
        optionalEmoji,
        fc.boolean(),
        (name, color, emojiIcon, isInbox) => {
          const id = uuidv4();
          const now = new Date();
          
          // Insert list
          testDb.insert(schema.lists).values({
            id,
            name,
            color,
            emoji: emojiIcon,
            isInbox,
            createdAt: now,
            updatedAt: now,
          }).run();
          
          // Retrieve list
          const [retrieved] = testDb
            .select()
            .from(schema.lists)
            .where(eq(schema.lists.id, id))
            .all();
          
          // Verify all properties match
          expect(retrieved).toBeDefined();
          expect(retrieved.id).toBe(id);
          expect(retrieved.name).toBe(name);
          expect(retrieved.color).toBe(color ?? null);
          expect(retrieved.emoji).toBe(emojiIcon ?? null);
          expect(retrieved.isInbox).toBe(isInbox);
          // SQLite stores timestamps as seconds, so we compare with second precision
          expect(Math.floor(retrieved.createdAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          expect(Math.floor(retrieved.updatedAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          
          // Cleanup for next iteration
          testDb.delete(schema.lists).where(eq(schema.lists.id, id)).run();
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * **Feature: daily-task-planner, Property 36: Data Persistence Round Trip**
   * **Validates: Requirements 23.1, 23.2**
   * 
   * For any label created, the entity SHALL be retrievable from the database
   * with all properties intact.
   */
  test('Label round trip: created labels are retrievable with all properties intact', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        optionalString,
        (name, icon) => {
          const id = uuidv4();
          const now = new Date();
          
          // Insert label
          testDb.insert(schema.labels).values({
            id,
            name,
            icon,
            createdAt: now,
            updatedAt: now,
          }).run();
          
          // Retrieve label
          const [retrieved] = testDb
            .select()
            .from(schema.labels)
            .where(eq(schema.labels.id, id))
            .all();
          
          // Verify all properties match
          expect(retrieved).toBeDefined();
          expect(retrieved.id).toBe(id);
          expect(retrieved.name).toBe(name);
          expect(retrieved.icon).toBe(icon ?? null);
          // SQLite stores timestamps as seconds, so we compare with second precision
          expect(Math.floor(retrieved.createdAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          expect(Math.floor(retrieved.updatedAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          
          // Cleanup for next iteration
          testDb.delete(schema.labels).where(eq(schema.labels.id, id)).run();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: daily-task-planner, Property 36: Data Persistence Round Trip**
   * **Validates: Requirements 23.1, 23.2**
   * 
   * For any task created, the entity SHALL be retrievable from the database
   * with all properties intact.
   */
  test('Task round trip: created tasks are retrievable with all properties intact', () => {
    // First create a list to reference
    const listId = uuidv4();
    const listNow = new Date();
    testDb.insert(schema.lists).values({
      id: listId,
      name: 'Test List',
      isInbox: false,
      createdAt: listNow,
      updatedAt: listNow,
    }).run();

    fc.assert(
      fc.property(
        nonEmptyString,
        optionalString,
        optionalTimestamp,
        optionalTimestamp,
        fc.option(fc.integer({ min: 1, max: 480 }), { nil: undefined }),
        fc.option(fc.integer({ min: 1, max: 480 }), { nil: undefined }),
        priority,
        fc.boolean(),
        (name, description, date, deadline, estimate, actualTime, taskPriority, completed) => {
          const id = uuidv4();
          const now = new Date();
          const completedAt = completed ? now : undefined;
          
          // Insert task
          testDb.insert(schema.tasks).values({
            id,
            name,
            description,
            listId,
            date,
            deadline,
            estimate,
            actualTime,
            priority: taskPriority,
            completed,
            completedAt,
            createdAt: now,
            updatedAt: now,
          }).run();
          
          // Retrieve task
          const [retrieved] = testDb
            .select()
            .from(schema.tasks)
            .where(eq(schema.tasks.id, id))
            .all();
          
          // Verify all properties match
          expect(retrieved).toBeDefined();
          expect(retrieved.id).toBe(id);
          expect(retrieved.name).toBe(name);
          expect(retrieved.description).toBe(description ?? null);
          expect(retrieved.listId).toBe(listId);
          // Compare dates with second precision (SQLite stores as seconds)
          if (date) {
            expect(Math.floor(retrieved.date!.getTime() / 1000)).toBe(Math.floor(date.getTime() / 1000));
          } else {
            expect(retrieved.date).toBeNull();
          }
          if (deadline) {
            expect(Math.floor(retrieved.deadline!.getTime() / 1000)).toBe(Math.floor(deadline.getTime() / 1000));
          } else {
            expect(retrieved.deadline).toBeNull();
          }
          expect(retrieved.estimate).toBe(estimate ?? null);
          expect(retrieved.actualTime).toBe(actualTime ?? null);
          expect(retrieved.priority).toBe(taskPriority);
          expect(retrieved.completed).toBe(completed);
          expect(Math.floor(retrieved.createdAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          expect(Math.floor(retrieved.updatedAt.getTime() / 1000)).toBe(Math.floor(now.getTime() / 1000));
          
          // Cleanup for next iteration
          testDb.delete(schema.tasks).where(eq(schema.tasks.id, id)).run();
        }
      ),
      { numRuns: 100 }
    );
    
    // Cleanup list
    testDb.delete(schema.lists).where(eq(schema.lists.id, listId)).run();
  });
});
