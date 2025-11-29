/**
 * Property-based tests for List service
 * 
 * Tests Properties 1, 3, 4, 5, 6 from the design document
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 18.1**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '@/lib/db/schema';
import type { CreateListInput, UpdateListInput, List, IListService } from '@/types';
import { validateCreateList, validateUpdateList } from '@/lib/utils/validation';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Create a test-specific list service that uses the test database
function createTestListService(db: ReturnType<typeof drizzle>): IListService {
  function toList(row: typeof schema.lists.$inferSelect): List {
    return {
      id: row.id,
      name: row.name,
      color: row.color ?? undefined,
      emoji: row.emoji ?? undefined,
      isInbox: row.isInbox,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  class ListValidationError extends Error {
    constructor(message: string, public errors: Record<string, string[]>) {
      super(message);
      this.name = 'ListValidationError';
    }
  }

  class ListNotFoundError extends Error {
    constructor(id: string) {
      super(`List with id "${id}" not found`);
      this.name = 'ListNotFoundError';
    }
  }

  class InboxProtectionError extends Error {
    constructor(operation: string) {
      super(`Cannot ${operation} the Inbox list`);
      this.name = 'InboxProtectionError';
    }
  }


  return {
    async ensureInboxExists(): Promise<List> {
      const existingInbox = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.isInbox, true))
        .limit(1)
        .all();

      if (existingInbox.length > 0) {
        return toList(existingInbox[0]);
      }

      const now = new Date();
      const inboxId = uuidv4();

      db.insert(schema.lists).values({
        id: inboxId,
        name: 'Inbox',
        isInbox: true,
        createdAt: now,
        updatedAt: now,
      }).run();

      const [inbox] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, inboxId))
        .all();

      return toList(inbox);
    },

    async getInbox(): Promise<List> {
      return this.ensureInboxExists();
    },

    async create(data: CreateListInput): Promise<List> {
      const validation = validateCreateList(data);
      if (!validation.valid) {
        throw new ListValidationError('Invalid list data', validation.errors);
      }

      const now = new Date();
      const id = uuidv4();

      db.insert(schema.lists).values({
        id,
        name: data.name.trim(),
        color: data.color ?? null,
        emoji: data.emoji ?? null,
        isInbox: false,
        createdAt: now,
        updatedAt: now,
      }).run();

      const [list] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, id))
        .all();

      return toList(list);
    },

    async update(id: string, data: UpdateListInput): Promise<List> {
      const validation = validateUpdateList(data);
      if (!validation.valid) {
        throw new ListValidationError('Invalid list data', validation.errors);
      }

      const [existing] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, id))
        .all();

      if (!existing) {
        throw new ListNotFoundError(id);
      }

      if (existing.isInbox && data.name !== undefined && data.name !== existing.name) {
        throw new InboxProtectionError('rename');
      }

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      if (data.color !== undefined) {
        updateData.color = data.color;
      }
      if (data.emoji !== undefined) {
        updateData.emoji = data.emoji;
      }

      db.update(schema.lists)
        .set(updateData)
        .where(eq(schema.lists.id, id))
        .run();

      const [updated] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, id))
        .all();

      return toList(updated);
    },

    async delete(id: string): Promise<void> {
      const [existing] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, id))
        .all();

      if (!existing) {
        throw new ListNotFoundError(id);
      }

      if (existing.isInbox) {
        throw new InboxProtectionError('delete');
      }

      const inbox = await this.getInbox();

      db.update(schema.tasks)
        .set({ listId: inbox.id, updatedAt: new Date() })
        .where(eq(schema.tasks.listId, id))
        .run();

      db.delete(schema.lists).where(eq(schema.lists.id, id)).run();
    },

    async getAll(): Promise<List[]> {
      await this.ensureInboxExists();

      const rows = db
        .select()
        .from(schema.lists)
        .all();

      const sorted = rows.sort((a, b) => {
        if (a.isInbox && !b.isInbox) return -1;
        if (!a.isInbox && b.isInbox) return 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      return sorted.map(toList);
    },

    async getById(id: string): Promise<List | null> {
      const [row] = db
        .select()
        .from(schema.lists)
        .where(eq(schema.lists.id, id))
        .all();

      return row ? toList(row) : null;
    },
  };
}

let listService: IListService;


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
  
  listService = createTestListService(testDb);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM lists');
});

// Arbitraries for generating test data
const validName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const invalidName = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  \t  ')
);

const hexColor = fc.array(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`);

const optionalColor = fc.option(hexColor, { nil: undefined });

const emoji = fc.constantFrom('📝', '🎯', '💼', '🏠', '🎨', '📚', '🔧', '⭐');
const optionalEmoji = fc.option(emoji, { nil: undefined });


describe('Property 1: Inbox Immutability', () => {
  /**
   * **Feature: daily-task-planner, Property 1: Inbox Immutability**
   * **Validates: Requirements 1.1**
   * 
   * For any attempt to delete or rename the Inbox list, the operation SHALL fail
   * and the Inbox list SHALL remain unchanged.
   */
  test('Inbox cannot be deleted', async () => {
    const inbox = await listService.ensureInboxExists();
    
    await expect(listService.delete(inbox.id)).rejects.toThrow('Cannot delete the Inbox list');
    
    // Verify Inbox still exists
    const inboxAfter = await listService.getInbox();
    expect(inboxAfter.id).toBe(inbox.id);
    expect(inboxAfter.name).toBe('Inbox');
  });

  test('Inbox cannot be renamed', async () => {
    await fc.assert(
      fc.asyncProperty(validName, async (newName) => {
        // Skip if the new name happens to be "Inbox"
        if (newName.trim() === 'Inbox') return;
        
        const inbox = await listService.ensureInboxExists();
        const originalName = inbox.name;
        
        await expect(listService.update(inbox.id, { name: newName })).rejects.toThrow('Cannot rename the Inbox list');
        
        // Verify Inbox name is unchanged
        const inboxAfter = await listService.getInbox();
        expect(inboxAfter.name).toBe(originalName);
      }),
      { numRuns: 50 }
    );
  });

  test('Inbox can have color and emoji updated', async () => {
    await fc.assert(
      fc.asyncProperty(hexColor, emoji, async (color, emojiIcon) => {
        const inbox = await listService.ensureInboxExists();
        
        // Should not throw when updating color/emoji
        const updated = await listService.update(inbox.id, { color, emoji: emojiIcon });
        
        expect(updated.name).toBe('Inbox');
        expect(updated.color).toBe(color);
        expect(updated.emoji).toBe(emojiIcon);
      }),
      { numRuns: 50 }
    );
  });
});


describe('Property 3: Inbox First Ordering', () => {
  /**
   * **Feature: daily-task-planner, Property 3: Inbox First Ordering**
   * **Validates: Requirements 1.3, 18.1**
   * 
   * For any call to retrieve all lists, the Inbox list SHALL appear first
   * in the returned collection.
   */
  test('Inbox is always first in getAll results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validName, { minLength: 0, maxLength: 10 }),
        async (listNames) => {
          // Ensure Inbox exists
          await listService.ensureInboxExists();
          
          // Create additional lists
          for (const name of listNames) {
            await listService.create({ name });
          }
          
          // Get all lists
          const allLists = await listService.getAll();
          
          // Verify Inbox is first
          expect(allLists.length).toBeGreaterThan(0);
          expect(allLists[0].isInbox).toBe(true);
          expect(allLists[0].name).toBe('Inbox');
          
          // Verify only one Inbox exists
          const inboxCount = allLists.filter(l => l.isInbox).length;
          expect(inboxCount).toBe(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Inbox is first even when created after other lists', async () => {
    // Create some lists first (before Inbox exists)
    await listService.create({ name: 'Work' });
    await listService.create({ name: 'Personal' });
    
    // Now ensure Inbox exists
    await listService.ensureInboxExists();
    
    // Get all lists
    const allLists = await listService.getAll();
    
    // Inbox should still be first
    expect(allLists[0].isInbox).toBe(true);
    expect(allLists[0].name).toBe('Inbox');
  });
});


describe('Property 4: List Name Validation', () => {
  /**
   * **Feature: daily-task-planner, Property 4: List Name Validation**
   * **Validates: Requirements 2.1**
   * 
   * For any list creation or update operation, if the name is empty or whitespace-only,
   * the operation SHALL fail with a validation error.
   */
  test('List creation with empty/whitespace name fails', async () => {
    await fc.assert(
      fc.asyncProperty(invalidName, async (name) => {
        await expect(listService.create({ name })).rejects.toThrow('Invalid list data');
      }),
      { numRuns: 50 }
    );
  });

  test('List creation with valid name succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(validName, optionalColor, optionalEmoji, async (name, color, emojiIcon) => {
        const list = await listService.create({ name, color, emoji: emojiIcon });
        
        expect(list.name).toBe(name.trim());
        expect(list.color).toBe(color);
        expect(list.emoji).toBe(emojiIcon);
        expect(list.isInbox).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  test('List update with empty/whitespace name fails', async () => {
    await fc.assert(
      fc.asyncProperty(validName, invalidName, async (originalName, newName) => {
        const list = await listService.create({ name: originalName });
        
        await expect(listService.update(list.id, { name: newName })).rejects.toThrow('Invalid list data');
        
        // Verify original name is preserved
        const listAfter = await listService.getById(list.id);
        expect(listAfter?.name).toBe(originalName.trim());
      }),
      { numRuns: 30 }
    );
  });
});


describe('Property 5: List Update Persistence', () => {
  /**
   * **Feature: daily-task-planner, Property 5: List Update Persistence**
   * **Validates: Requirements 2.2**
   * 
   * For any list and any valid update (name, color, emoji), updating then retrieving
   * the list SHALL return the updated values.
   */
  test('List updates are persisted and retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        validName,
        validName,
        optionalColor,
        optionalEmoji,
        async (originalName, newName, newColor, newEmoji) => {
          // Create a list
          const list = await listService.create({ name: originalName });
          
          // Update the list
          const updated = await listService.update(list.id, {
            name: newName,
            color: newColor,
            emoji: newEmoji,
          });
          
          // Verify update returned correct values
          expect(updated.name).toBe(newName.trim());
          expect(updated.color).toBe(newColor);
          expect(updated.emoji).toBe(newEmoji);
          
          // Retrieve and verify persistence
          const retrieved = await listService.getById(list.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.name).toBe(newName.trim());
          expect(retrieved!.color).toBe(newColor);
          expect(retrieved!.emoji).toBe(newEmoji);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Partial updates only change specified fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        validName,
        hexColor,
        emoji,
        validName,
        async (originalName, originalColor, originalEmoji, newName) => {
          // Create a list with all fields
          const list = await listService.create({
            name: originalName,
            color: originalColor,
            emoji: originalEmoji,
          });
          
          // Update only the name
          const updated = await listService.update(list.id, { name: newName });
          
          // Verify only name changed
          expect(updated.name).toBe(newName.trim());
          expect(updated.color).toBe(originalColor);
          expect(updated.emoji).toBe(originalEmoji);
        }
      ),
      { numRuns: 30 }
    );
  });
});


describe('Property 6: List Deletion Task Migration', () => {
  /**
   * **Feature: daily-task-planner, Property 6: List Deletion Task Migration**
   * **Validates: Requirements 2.3**
   * 
   * For any non-Inbox list containing tasks, deleting the list SHALL result in
   * all those tasks being assigned to the Inbox list.
   */
  test('Tasks are migrated to Inbox when list is deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validName,
        fc.array(validName, { minLength: 1, maxLength: 5 }),
        async (listName, taskNames) => {
          // Ensure Inbox exists
          const inbox = await listService.ensureInboxExists();
          
          // Create a list
          const list = await listService.create({ name: listName });
          
          // Create tasks in the list
          const taskIds: string[] = [];
          for (const taskName of taskNames) {
            const taskId = uuidv4();
            const now = new Date();
            testDb.insert(schema.tasks).values({
              id: taskId,
              name: taskName,
              listId: list.id,
              priority: 'none',
              completed: false,
              createdAt: now,
              updatedAt: now,
            }).run();
            taskIds.push(taskId);
          }
          
          // Verify tasks are in the list
          const tasksBefore = testDb
            .select()
            .from(schema.tasks)
            .where(eq(schema.tasks.listId, list.id))
            .all();
          expect(tasksBefore.length).toBe(taskNames.length);
          
          // Delete the list
          await listService.delete(list.id);
          
          // Verify list is deleted
          const listAfter = await listService.getById(list.id);
          expect(listAfter).toBeNull();
          
          // Verify all tasks are now in Inbox
          for (const taskId of taskIds) {
            const [task] = testDb
              .select()
              .from(schema.tasks)
              .where(eq(schema.tasks.id, taskId))
              .all();
            expect(task).toBeDefined();
            expect(task.listId).toBe(inbox.id);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Empty list can be deleted without issues', async () => {
    await fc.assert(
      fc.asyncProperty(validName, async (listName) => {
        // Create a list with no tasks
        const list = await listService.create({ name: listName });
        
        // Delete should succeed
        await listService.delete(list.id);
        
        // Verify list is deleted
        const listAfter = await listService.getById(list.id);
        expect(listAfter).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  test('Deleting non-existent list throws error', async () => {
    const nonExistentId = uuidv4();
    await expect(listService.delete(nonExistentId)).rejects.toThrow(`List with id "${nonExistentId}" not found`);
  });
});
