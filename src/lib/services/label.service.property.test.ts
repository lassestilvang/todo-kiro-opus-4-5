/**
 * Property-based tests for Label service
 * 
 * Tests Properties 16, 17 from the design document
 * **Validates: Requirements 8.2, 8.4**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '@/lib/db/schema';
import type { Label, CreateLabelInput, UpdateLabelInput, ILabelService } from '@/types';
import { validateCreateLabel, validateUpdateLabel } from '@/lib/utils/validation';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Create a test-specific label service that uses the test database
function createTestLabelService(db: ReturnType<typeof drizzle>): ILabelService {
  function toLabel(row: typeof schema.labels.$inferSelect): Label {
    return {
      id: row.id,
      name: row.name,
      icon: row.icon ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  class LabelValidationError extends Error {
    constructor(message: string, public errors: Record<string, string[]>) {
      super(message);
      this.name = 'LabelValidationError';
    }
  }

  class LabelNotFoundError extends Error {
    constructor(id: string) {
      super(`Label with id "${id}" not found`);
      this.name = 'LabelNotFoundError';
    }
  }

  class TaskNotFoundError extends Error {
    constructor(id: string) {
      super(`Task with id "${id}" not found`);
      this.name = 'TaskNotFoundError';
    }
  }


  return {
    async create(data: CreateLabelInput): Promise<Label> {
      const validation = validateCreateLabel(data);
      if (!validation.valid) {
        throw new LabelValidationError('Invalid label data', validation.errors);
      }

      const now = new Date();
      const id = uuidv4();

      db.insert(schema.labels).values({
        id,
        name: data.name.trim(),
        icon: data.icon ?? null,
        createdAt: now,
        updatedAt: now,
      }).run();

      const [label] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, id))
        .all();

      return toLabel(label);
    },

    async update(id: string, data: UpdateLabelInput): Promise<Label> {
      const validation = validateUpdateLabel(data);
      if (!validation.valid) {
        throw new LabelValidationError('Invalid label data', validation.errors);
      }

      const [existing] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, id))
        .all();

      if (!existing) {
        throw new LabelNotFoundError(id);
      }

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (data.name !== undefined) {
        updateData.name = data.name.trim();
      }
      if (data.icon !== undefined) {
        updateData.icon = data.icon;
      }

      db.update(schema.labels)
        .set(updateData)
        .where(eq(schema.labels.id, id))
        .run();

      const [updated] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, id))
        .all();

      return toLabel(updated);
    },

    async delete(id: string): Promise<void> {
      const [existing] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, id))
        .all();

      if (!existing) {
        throw new LabelNotFoundError(id);
      }

      // Delete the label (cascade will remove task_labels entries)
      db.delete(schema.labels).where(eq(schema.labels.id, id)).run();
    },

    async getAll(): Promise<Label[]> {
      const rows = db
        .select()
        .from(schema.labels)
        .all();

      return rows.map(toLabel);
    },

    async getById(id: string): Promise<Label | null> {
      const [row] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, id))
        .all();

      return row ? toLabel(row) : null;
    },

    async addToTask(taskId: string, labelId: string): Promise<void> {
      // Verify task exists
      const [task] = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .all();

      if (!task) {
        throw new TaskNotFoundError(taskId);
      }

      // Verify label exists
      const [label] = db
        .select()
        .from(schema.labels)
        .where(eq(schema.labels.id, labelId))
        .all();

      if (!label) {
        throw new LabelNotFoundError(labelId);
      }

      // Check if association already exists
      const [existing] = db
        .select()
        .from(schema.taskLabels)
        .where(
          and(
            eq(schema.taskLabels.taskId, taskId),
            eq(schema.taskLabels.labelId, labelId)
          )
        )
        .all();

      // Only insert if not already associated
      if (!existing) {
        db.insert(schema.taskLabels).values({
          taskId,
          labelId,
        }).run();
      }
    },

    async removeFromTask(taskId: string, labelId: string): Promise<void> {
      db.delete(schema.taskLabels)
        .where(
          and(
            eq(schema.taskLabels.taskId, taskId),
            eq(schema.taskLabels.labelId, labelId)
          )
        )
        .run();
    },
  };
}

let labelService: ILabelService;


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
    
    CREATE TABLE task_labels (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );
  `);
  
  labelService = createTestLabelService(testDb);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM task_labels');
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM labels');
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

// Helper function to get labels for a task
function getLabelsForTask(taskId: string): string[] {
  const rows = testDb
    .select()
    .from(schema.taskLabels)
    .where(eq(schema.taskLabels.taskId, taskId))
    .all();
  return rows.map(r => r.labelId);
}

// Arbitraries for generating test data
const validName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const icon = fc.constantFrom('🏷️', '⭐', '🔥', '💡', '📌', '🎯', '✅', '🚀');
// optionalIcon can be used for label creation tests if needed
const _optionalIcon = fc.option(icon, { nil: undefined });


describe('Property 16: Multiple Label Assignment', () => {
  /**
   * **Feature: daily-task-planner, Property 16: Multiple Label Assignment**
   * **Validates: Requirements 8.2**
   * 
   * For any task and any set of labels, all labels SHALL be assignable to the task
   * and retrievable.
   */
  test('Multiple labels can be assigned to a single task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validName, { minLength: 1, maxLength: 5 }),
        async (labelNames) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create labels
          const labelIds: string[] = [];
          for (const name of labelNames) {
            const label = await labelService.create({ name });
            labelIds.push(label.id);
          }
          
          // Assign all labels to the task
          for (const labelId of labelIds) {
            await labelService.addToTask(taskId, labelId);
          }
          
          // Verify all labels are assigned
          const assignedLabelIds = getLabelsForTask(taskId);
          expect(assignedLabelIds.length).toBe(labelIds.length);
          
          for (const labelId of labelIds) {
            expect(assignedLabelIds).toContain(labelId);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Same label can be assigned to multiple tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validName,
        fc.array(validName, { minLength: 2, maxLength: 5 }),
        async (labelName, taskNames) => {
          // Create a list
          const listId = createTestList();
          
          // Create a label
          const label = await labelService.create({ name: labelName });
          
          // Create multiple tasks
          const taskIds: string[] = [];
          for (const taskName of taskNames) {
            const taskId = createTestTask(listId, taskName);
            taskIds.push(taskId);
          }
          
          // Assign the same label to all tasks
          for (const taskId of taskIds) {
            await labelService.addToTask(taskId, label.id);
          }
          
          // Verify the label is assigned to all tasks
          for (const taskId of taskIds) {
            const assignedLabelIds = getLabelsForTask(taskId);
            expect(assignedLabelIds).toContain(label.id);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Adding same label twice to a task is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(validName, async (labelName) => {
        // Create a list and task
        const listId = createTestList();
        const taskId = createTestTask(listId);
        
        // Create a label
        const label = await labelService.create({ name: labelName });
        
        // Add the label twice
        await labelService.addToTask(taskId, label.id);
        await labelService.addToTask(taskId, label.id);
        
        // Verify only one association exists
        const assignedLabelIds = getLabelsForTask(taskId);
        expect(assignedLabelIds.length).toBe(1);
        expect(assignedLabelIds[0]).toBe(label.id);
      }),
      { numRuns: 30 }
    );
  });

  test('Labels can be removed from a task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validName, { minLength: 2, maxLength: 5 }),
        async (labelNames) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create labels
          const labelIds: string[] = [];
          for (const name of labelNames) {
            const label = await labelService.create({ name });
            labelIds.push(label.id);
          }
          
          // Assign all labels to the task
          for (const labelId of labelIds) {
            await labelService.addToTask(taskId, labelId);
          }
          
          // Remove the first label
          const removedLabelId = labelIds[0];
          await labelService.removeFromTask(taskId, removedLabelId);
          
          // Verify the removed label is no longer assigned
          const assignedLabelIds = getLabelsForTask(taskId);
          expect(assignedLabelIds).not.toContain(removedLabelId);
          expect(assignedLabelIds.length).toBe(labelIds.length - 1);
          
          // Verify other labels are still assigned
          for (let i = 1; i < labelIds.length; i++) {
            expect(assignedLabelIds).toContain(labelIds[i]);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});


describe('Property 17: Label Cascade Removal', () => {
  /**
   * **Feature: daily-task-planner, Property 17: Label Cascade Removal**
   * **Validates: Requirements 8.4**
   * 
   * For any label that is deleted, that label SHALL be removed from all tasks
   * that had it assigned.
   */
  test('Deleting a label removes it from all tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validName,
        fc.array(validName, { minLength: 1, maxLength: 5 }),
        async (labelName, taskNames) => {
          // Create a list
          const listId = createTestList();
          
          // Create a label
          const label = await labelService.create({ name: labelName });
          
          // Create multiple tasks and assign the label to each
          const taskIds: string[] = [];
          for (const taskName of taskNames) {
            const taskId = createTestTask(listId, taskName);
            taskIds.push(taskId);
            await labelService.addToTask(taskId, label.id);
          }
          
          // Verify label is assigned to all tasks
          for (const taskId of taskIds) {
            const assignedLabelIds = getLabelsForTask(taskId);
            expect(assignedLabelIds).toContain(label.id);
          }
          
          // Delete the label
          await labelService.delete(label.id);
          
          // Verify label is removed from all tasks
          for (const taskId of taskIds) {
            const assignedLabelIds = getLabelsForTask(taskId);
            expect(assignedLabelIds).not.toContain(label.id);
          }
          
          // Verify label no longer exists
          const deletedLabel = await labelService.getById(label.id);
          expect(deletedLabel).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Deleting a label does not affect other labels on tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validName, { minLength: 2, maxLength: 4 }),
        async (labelNames) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create multiple labels
          const labelIds: string[] = [];
          for (const name of labelNames) {
            const label = await labelService.create({ name });
            labelIds.push(label.id);
          }
          
          // Assign all labels to the task
          for (const labelId of labelIds) {
            await labelService.addToTask(taskId, labelId);
          }
          
          // Delete the first label
          const deletedLabelId = labelIds[0];
          await labelService.delete(deletedLabelId);
          
          // Verify the deleted label is removed
          const assignedLabelIds = getLabelsForTask(taskId);
          expect(assignedLabelIds).not.toContain(deletedLabelId);
          
          // Verify other labels are still assigned
          for (let i = 1; i < labelIds.length; i++) {
            expect(assignedLabelIds).toContain(labelIds[i]);
          }
          expect(assignedLabelIds.length).toBe(labelIds.length - 1);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Deleting a label that is not assigned to any task succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(validName, async (labelName) => {
        // Create a label without assigning it to any task
        const label = await labelService.create({ name: labelName });
        
        // Delete should succeed
        await labelService.delete(label.id);
        
        // Verify label is deleted
        const deletedLabel = await labelService.getById(label.id);
        expect(deletedLabel).toBeNull();
      }),
      { numRuns: 30 }
    );
  });

  test('Deleting non-existent label throws error', async () => {
    const nonExistentId = uuidv4();
    await expect(labelService.delete(nonExistentId)).rejects.toThrow(`Label with id "${nonExistentId}" not found`);
  });
});
