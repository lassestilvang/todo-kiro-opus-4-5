/**
 * Property-based tests for Task service
 * 
 * Tests Property 2 from the design document
 * **Validates: Requirements 1.2**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '@/lib/db/schema';
import type { 
  Task, 
  Subtask, 
  Label,
  CreateTaskInput, 
  UpdateTaskInput, 
  TaskHistoryEntry,
  ITaskService,
  IListService,
  List,
  CreateListInput,
  UpdateListInput,
  RecurrencePattern,
  Priority,
} from '@/types';
import { validateCreateTask, validateUpdateTask, validateCreateList, validateUpdateList, DEFAULT_PRIORITY } from '@/lib/utils/validation';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Helper functions
function toTask(row: typeof schema.tasks.$inferSelect): Task {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    listId: row.listId,
    date: row.date ?? undefined,
    deadline: row.deadline ?? undefined,
    estimate: row.estimate ?? undefined,
    actualTime: row.actualTime ?? undefined,
    priority: row.priority as Task['priority'],
    completed: row.completed,
    completedAt: row.completedAt ?? undefined,
    recurrence: row.recurrence as RecurrencePattern | undefined,
    parentTaskId: row.parentTaskId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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


function toSubtask(row: typeof schema.subtasks.$inferSelect): Subtask {
  return {
    id: row.id,
    taskId: row.taskId,
    name: row.name,
    completed: row.completed,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toHistoryEntry(row: typeof schema.taskHistory.$inferSelect): TaskHistoryEntry {
  return {
    id: row.id,
    taskId: row.taskId,
    field: row.field,
    previousValue: row.previousValue ?? undefined,
    newValue: row.newValue ?? undefined,
    changedAt: row.changedAt,
  };
}

function toLabel(row: typeof schema.labels.$inferSelect): Label {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Error classes
class TaskValidationError extends Error {
  constructor(message: string, public errors: Record<string, string[]>) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

class SubtaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Subtask with id "${id}" not found`);
    this.name = 'SubtaskNotFoundError';
  }
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


// Create test-specific list service
function createTestListService(db: ReturnType<typeof drizzle>): IListService {
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

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.color !== undefined) updateData.color = data.color;
      if (data.emoji !== undefined) updateData.emoji = data.emoji;

      db.update(schema.lists).set(updateData).where(eq(schema.lists.id, id)).run();

      const [updated] = db.select().from(schema.lists).where(eq(schema.lists.id, id)).all();
      return toList(updated);
    },

    async delete(id: string): Promise<void> {
      const [existing] = db.select().from(schema.lists).where(eq(schema.lists.id, id)).all();
      if (!existing) throw new ListNotFoundError(id);
      if (existing.isInbox) throw new InboxProtectionError('delete');

      const inbox = await this.getInbox();
      db.update(schema.tasks).set({ listId: inbox.id, updatedAt: new Date() }).where(eq(schema.tasks.listId, id)).run();
      db.delete(schema.lists).where(eq(schema.lists.id, id)).run();
    },

    async getAll(): Promise<List[]> {
      await this.ensureInboxExists();
      const rows = db.select().from(schema.lists).all();
      const sorted = rows.sort((a, b) => {
        if (a.isInbox && !b.isInbox) return -1;
        if (!a.isInbox && b.isInbox) return 1;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
      return sorted.map(toList);
    },

    async getById(id: string): Promise<List | null> {
      const [row] = db.select().from(schema.lists).where(eq(schema.lists.id, id)).all();
      return row ? toList(row) : null;
    },
  };
}


// Create test-specific task service
function createTestTaskService(db: ReturnType<typeof drizzle>, listService: IListService): ITaskService {
  async function logHistory(
    taskId: string,
    field: string,
    previousValue: string | null | undefined,
    newValue: string | null | undefined
  ): Promise<void> {
    const now = new Date();
    db.insert(schema.taskHistory).values({
      id: uuidv4(),
      taskId,
      field,
      previousValue: previousValue ?? null,
      newValue: newValue ?? null,
      changedAt: now,
    }).run();
  }

  function serializeValue(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async function getLabelsForTask(taskId: string): Promise<Label[]> {
    const rows = db
      .select({ label: schema.labels })
      .from(schema.taskLabels)
      .innerJoin(schema.labels, eq(schema.taskLabels.labelId, schema.labels.id))
      .where(eq(schema.taskLabels.taskId, taskId))
      .all();
    return rows.map(r => toLabel(r.label));
  }

  async function getSubtasksForTask(taskId: string): Promise<Subtask[]> {
    const rows = db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.taskId, taskId))
      .orderBy(asc(schema.subtasks.order))
      .all();
    return rows.map(toSubtask);
  }

  return {
    async create(data: CreateTaskInput): Promise<Task> {
      const validation = validateCreateTask(data);
      if (!validation.valid) {
        throw new TaskValidationError('Invalid task data', validation.errors);
      }

      let listId = data.listId;
      if (!listId) {
        const inbox = await listService.getInbox();
        listId = inbox.id;
      }

      const now = new Date();
      const id = uuidv4();
      const priority = data.priority ?? DEFAULT_PRIORITY;

      db.insert(schema.tasks).values({
        id,
        name: data.name.trim(),
        description: data.description ?? null,
        listId,
        date: data.date ?? null,
        deadline: data.deadline ?? null,
        estimate: data.estimate ?? null,
        actualTime: data.actualTime ?? null,
        priority,
        completed: false,
        completedAt: null,
        recurrence: data.recurrence ?? null,
        parentTaskId: null,
        createdAt: now,
        updatedAt: now,
      }).run();

      await logHistory(id, 'created', null, 'Task created');

      if (data.labelIds && data.labelIds.length > 0) {
        for (const labelId of data.labelIds) {
          db.insert(schema.taskLabels).values({ taskId: id, labelId }).run();
        }
      }

      const [task] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      const result = toTask(task);
      result.labels = await getLabelsForTask(id);
      result.subtasks = [];
      return result;
    },

    async update(id: string, data: UpdateTaskInput): Promise<Task> {
      const validation = validateUpdateTask(data);
      if (!validation.valid) {
        throw new TaskValidationError('Invalid task data', validation.errors);
      }

      const [existing] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      if (!existing) throw new TaskNotFoundError(id);

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };

      if (data.name !== undefined && data.name !== existing.name) {
        updateData.name = data.name.trim();
        await logHistory(id, 'name', existing.name, data.name.trim());
      }
      if (data.description !== undefined && data.description !== existing.description) {
        updateData.description = data.description ?? null;
        await logHistory(id, 'description', existing.description, data.description ?? null);
      }
      if (data.listId !== undefined && data.listId !== existing.listId) {
        updateData.listId = data.listId;
        await logHistory(id, 'listId', existing.listId, data.listId);
      }
      if (data.priority !== undefined && data.priority !== existing.priority) {
        updateData.priority = data.priority;
        await logHistory(id, 'priority', existing.priority, data.priority);
      }
      if (data.completed !== undefined && data.completed !== existing.completed) {
        updateData.completed = data.completed;
        updateData.completedAt = data.completed ? now : null;
        await logHistory(id, 'completed', String(existing.completed), String(data.completed));
      }

      db.update(schema.tasks).set(updateData).where(eq(schema.tasks.id, id)).run();

      if (data.labelIds !== undefined) {
        db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, id)).run();
        for (const labelId of data.labelIds) {
          db.insert(schema.taskLabels).values({ taskId: id, labelId }).run();
        }
      }

      const [updated] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      const result = toTask(updated);
      result.labels = await getLabelsForTask(id);
      result.subtasks = await getSubtasksForTask(id);
      return result;
    },

    async delete(id: string): Promise<void> {
      const [existing] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      if (!existing) throw new TaskNotFoundError(id);
      // Manually delete related records (cascade)
      db.delete(schema.taskHistory).where(eq(schema.taskHistory.taskId, id)).run();
      db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, id)).run();
      db.delete(schema.subtasks).where(eq(schema.subtasks.taskId, id)).run();
      db.delete(schema.tasks).where(eq(schema.tasks.id, id)).run();
    },

    async getById(id: string): Promise<Task | null> {
      const [row] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      if (!row) return null;
      const task = toTask(row);
      task.labels = await getLabelsForTask(id);
      task.subtasks = await getSubtasksForTask(id);
      return task;
    },

    async getByListId(listId: string, includeCompleted = true): Promise<Task[]> {
      const rows = db.select().from(schema.tasks).where(eq(schema.tasks.listId, listId)).all();
      const filtered = includeCompleted ? rows : rows.filter(r => !r.completed);
      const tasks: Task[] = [];
      for (const row of filtered) {
        const task = toTask(row);
        task.labels = await getLabelsForTask(row.id);
        task.subtasks = await getSubtasksForTask(row.id);
        tasks.push(task);
      }
      return tasks;
    },

    async getByDateRange(start: Date, end: Date, includeCompleted = true): Promise<Task[]> {
      const rows = db.select().from(schema.tasks).all();
      const filtered = rows.filter(r => {
        if (!r.date) return false;
        if (!includeCompleted && r.completed) return false;
        return r.date >= start && r.date <= end;
      });
      const tasks: Task[] = [];
      for (const row of filtered) {
        const task = toTask(row);
        task.labels = await getLabelsForTask(row.id);
        task.subtasks = await getSubtasksForTask(row.id);
        tasks.push(task);
      }
      return tasks;
    },

    async getToday(includeCompleted = true): Promise<Task[]> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return this.getByDateRange(today, tomorrow, includeCompleted);
    },

    async getOverdue(): Promise<Task[]> {
      const now = new Date();
      const rows = db.select().from(schema.tasks).all();
      const filtered = rows.filter(r => !r.completed && r.deadline && r.deadline < now);
      const tasks: Task[] = [];
      for (const row of filtered) {
        const task = toTask(row);
        task.labels = await getLabelsForTask(row.id);
        task.subtasks = await getSubtasksForTask(row.id);
        tasks.push(task);
      }
      return tasks;
    },

    async getAll(includeCompleted = true): Promise<Task[]> {
      const rows = db.select().from(schema.tasks).all();
      const filtered = includeCompleted ? rows : rows.filter(r => !r.completed);
      const tasks: Task[] = [];
      for (const row of filtered) {
        const task = toTask(row);
        task.labels = await getLabelsForTask(row.id);
        task.subtasks = await getSubtasksForTask(row.id);
        tasks.push(task);
      }
      return tasks;
    },

    async toggleComplete(id: string): Promise<Task> {
      const [existing] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      if (!existing) throw new TaskNotFoundError(id);

      const now = new Date();
      const newCompleted = !existing.completed;

      db.update(schema.tasks).set({
        completed: newCompleted,
        completedAt: newCompleted ? now : null,
        updatedAt: now,
      }).where(eq(schema.tasks.id, id)).run();

      await logHistory(id, 'completed', String(existing.completed), String(newCompleted));

      const [updated] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      const result = toTask(updated);
      result.labels = await getLabelsForTask(id);
      result.subtasks = await getSubtasksForTask(id);
      return result;
    },

    async addSubtask(taskId: string, name: string): Promise<Subtask> {
      const [task] = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).all();
      if (!task) throw new TaskNotFoundError(taskId);

      const existingSubtasks = db.select().from(schema.subtasks)
        .where(eq(schema.subtasks.taskId, taskId))
        .orderBy(desc(schema.subtasks.order))
        .limit(1)
        .all();

      const nextOrder = existingSubtasks.length > 0 ? existingSubtasks[0].order + 1 : 0;
      const now = new Date();
      const id = uuidv4();

      db.insert(schema.subtasks).values({
        id,
        taskId,
        name: name.trim(),
        completed: false,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      }).run();

      const [subtask] = db.select().from(schema.subtasks).where(eq(schema.subtasks.id, id)).all();
      return toSubtask(subtask);
    },

    async toggleSubtask(subtaskId: string): Promise<Subtask> {
      const [existing] = db.select().from(schema.subtasks).where(eq(schema.subtasks.id, subtaskId)).all();
      if (!existing) throw new SubtaskNotFoundError(subtaskId);

      const now = new Date();
      db.update(schema.subtasks).set({
        completed: !existing.completed,
        updatedAt: now,
      }).where(eq(schema.subtasks.id, subtaskId)).run();

      const [updated] = db.select().from(schema.subtasks).where(eq(schema.subtasks.id, subtaskId)).all();
      return toSubtask(updated);
    },

    async deleteSubtask(subtaskId: string): Promise<void> {
      const [existing] = db.select().from(schema.subtasks).where(eq(schema.subtasks.id, subtaskId)).all();
      if (!existing) throw new SubtaskNotFoundError(subtaskId);
      db.delete(schema.subtasks).where(eq(schema.subtasks.id, subtaskId)).run();
    },

    async getHistory(taskId: string): Promise<TaskHistoryEntry[]> {
      const rows = db.select().from(schema.taskHistory)
        .where(eq(schema.taskHistory.taskId, taskId))
        .orderBy(desc(schema.taskHistory.changedAt))
        .all();
      return rows.map(toHistoryEntry);
    },
  };
}


let listService: IListService;
let taskService: ITaskService;

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
    
    CREATE TABLE subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE task_labels (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE
    );
    
    CREATE TABLE task_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      previous_value TEXT,
      new_value TEXT,
      changed_at INTEGER NOT NULL
    );
  `);
  
  listService = createTestListService(testDb);
  taskService = createTestTaskService(testDb, listService);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM task_history');
  sqlite.exec('DELETE FROM task_labels');
  sqlite.exec('DELETE FROM subtasks');
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM labels');
  sqlite.exec('DELETE FROM lists');
});

// Arbitraries for generating test data
const validTaskName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const validListName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const validPriority = fc.constantFrom<Priority>('high', 'medium', 'low', 'none');

const optionalDescription = fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined });

const optionalEstimate = fc.option(fc.integer({ min: 1, max: 480 }), { nil: undefined });


describe('Property 2: Default List Assignment', () => {
  /**
   * **Feature: daily-task-planner, Property 2: Default List Assignment**
   * **Validates: Requirements 1.2**
   * 
   * For any task created without specifying a listId, the task SHALL be assigned
   * to the Inbox list.
   */
  test('Task created without listId is assigned to Inbox', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, async (taskName) => {
        // Ensure Inbox exists
        const inbox = await listService.ensureInboxExists();
        
        // Create task without specifying listId
        const task = await taskService.create({ name: taskName });
        
        // Verify task is assigned to Inbox
        expect(task.listId).toBe(inbox.id);
        
        // Verify task can be retrieved from Inbox
        const inboxTasks = await taskService.getByListId(inbox.id);
        const foundTask = inboxTasks.find(t => t.id === task.id);
        expect(foundTask).toBeDefined();
        expect(foundTask!.listId).toBe(inbox.id);
      }),
      { numRuns: 100 }
    );
  });

  test('Task created with explicit listId is assigned to that list', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validListName, async (taskName, listName) => {
        // Ensure Inbox exists
        await listService.ensureInboxExists();
        
        // Create a custom list
        const customList = await listService.create({ name: listName });
        
        // Create task with explicit listId
        const task = await taskService.create({ name: taskName, listId: customList.id });
        
        // Verify task is assigned to the custom list, not Inbox
        expect(task.listId).toBe(customList.id);
        
        // Verify task can be retrieved from the custom list
        const customListTasks = await taskService.getByListId(customList.id);
        const foundTask = customListTasks.find(t => t.id === task.id);
        expect(foundTask).toBeDefined();
        expect(foundTask!.listId).toBe(customList.id);
      }),
      { numRuns: 50 }
    );
  });

  test('Multiple tasks without listId all go to Inbox', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validTaskName, { minLength: 1, maxLength: 10 }),
        async (taskNames) => {
          // Clean up before each iteration
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM task_labels');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM labels');
          sqlite.exec('DELETE FROM lists');
          
          // Ensure Inbox exists
          const inbox = await listService.ensureInboxExists();
          
          // Create multiple tasks without listId
          const createdTasks: Task[] = [];
          for (const name of taskNames) {
            const task = await taskService.create({ name });
            createdTasks.push(task);
          }
          
          // Verify all tasks are in Inbox
          for (const task of createdTasks) {
            expect(task.listId).toBe(inbox.id);
          }
          
          // Verify all tasks can be retrieved from Inbox
          const inboxTasks = await taskService.getByListId(inbox.id);
          expect(inboxTasks.length).toBe(taskNames.length);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Task with undefined listId defaults to Inbox', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        optionalDescription,
        validPriority,
        optionalEstimate,
        async (name, description, priority, estimate) => {
          // Ensure Inbox exists
          const inbox = await listService.ensureInboxExists();
          
          // Create task with various optional fields but no listId
          const task = await taskService.create({
            name,
            description,
            priority,
            estimate,
            listId: undefined,
          });
          
          // Verify task is assigned to Inbox
          expect(task.listId).toBe(inbox.id);
        }
      ),
      { numRuns: 50 }
    );
  });
});



describe('Property 9: Task History Logging', () => {
  /**
   * **Feature: daily-task-planner, Property 9: Task History Logging**
   * **Validates: Requirements 3.4, 4.1, 5.2, 22.1, 22.2**
   * 
   * For any task property modification (including creation and completion),
   * a history entry SHALL be created containing the field name, previous value,
   * new value, and timestamp.
   */
  test('Task creation logs a history entry', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, async (taskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create a task
        const task = await taskService.create({ name: taskName });
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Verify creation is logged
        expect(history.length).toBeGreaterThanOrEqual(1);
        const creationEntry = history.find(h => h.field === 'created');
        expect(creationEntry).toBeDefined();
        expect(creationEntry!.newValue).toBe('Task created');
        expect(creationEntry!.changedAt).toBeInstanceOf(Date);
      }),
      { numRuns: 50 }
    );
  });

  test('Task name update logs history with previous and new values', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validTaskName, async (originalName, newName) => {
        // Skip if names are the same after trimming
        if (originalName.trim() === newName.trim()) return;
        
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create and update task
        const task = await taskService.create({ name: originalName });
        await taskService.update(task.id, { name: newName });
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Find name change entry
        const nameEntry = history.find(h => h.field === 'name');
        expect(nameEntry).toBeDefined();
        expect(nameEntry!.previousValue).toBe(originalName.trim());
        expect(nameEntry!.newValue).toBe(newName.trim());
      }),
      { numRuns: 50 }
    );
  });

  test('Task completion logs history entry', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, async (taskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create and complete task
        const task = await taskService.create({ name: taskName });
        await taskService.toggleComplete(task.id);
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Find completion entry
        const completionEntry = history.find(h => h.field === 'completed');
        expect(completionEntry).toBeDefined();
        expect(completionEntry!.previousValue).toBe('false');
        expect(completionEntry!.newValue).toBe('true');
      }),
      { numRuns: 50 }
    );
  });

  test('Task uncomplete logs history entry', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, async (taskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create, complete, then uncomplete task
        const task = await taskService.create({ name: taskName });
        await taskService.toggleComplete(task.id);
        await taskService.toggleComplete(task.id);
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Find completion entries
        const completionEntries = history.filter(h => h.field === 'completed');
        expect(completionEntries.length).toBe(2);
        
        // Verify we have both a complete and uncomplete entry
        const hasComplete = completionEntries.some(e => e.previousValue === 'false' && e.newValue === 'true');
        const hasUncomplete = completionEntries.some(e => e.previousValue === 'true' && e.newValue === 'false');
        expect(hasComplete).toBe(true);
        expect(hasUncomplete).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  test('Task priority change logs history entry', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validPriority, async (taskName, newPriority) => {
        // Skip if priority is the default
        if (newPriority === 'none') return;
        
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create task (default priority is 'none')
        const task = await taskService.create({ name: taskName });
        await taskService.update(task.id, { priority: newPriority });
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Find priority change entry
        const priorityEntry = history.find(h => h.field === 'priority');
        expect(priorityEntry).toBeDefined();
        expect(priorityEntry!.previousValue).toBe('none');
        expect(priorityEntry!.newValue).toBe(newPriority);
      }),
      { numRuns: 50 }
    );
  });

  test('All history entries have timestamps', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validTaskName, validPriority, async (name1, name2, priority) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create task and make multiple changes
        const task = await taskService.create({ name: name1 });
        if (name1.trim() !== name2.trim()) {
          await taskService.update(task.id, { name: name2 });
        }
        if (priority !== 'none') {
          await taskService.update(task.id, { priority });
        }
        await taskService.toggleComplete(task.id);
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Verify all entries have timestamps
        for (const entry of history) {
          expect(entry.changedAt).toBeInstanceOf(Date);
          expect(entry.changedAt.getTime()).toBeGreaterThan(0);
        }
      }),
      { numRuns: 30 }
    );
  });
});


describe('Property 10: Task History Ordering', () => {
  /**
   * **Feature: daily-task-planner, Property 10: Task History Ordering**
   * **Validates: Requirements 5.3**
   * 
   * For any task with multiple history entries, retrieving history SHALL return
   * entries ordered from most recent to oldest by timestamp.
   */
  test('History entries are ordered from most recent to oldest', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 2, maxLength: 5 }),
        async (initialName, nameUpdates) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task
          const task = await taskService.create({ name: initialName });
          
          // Make multiple updates with small delays to ensure different timestamps
          let previousName = initialName.trim();
          for (const newName of nameUpdates) {
            if (newName.trim() !== previousName) {
              await taskService.update(task.id, { name: newName });
              previousName = newName.trim();
            }
          }
          
          // Get history
          const history = await taskService.getHistory(task.id);
          
          // Verify ordering (most recent first)
          for (let i = 0; i < history.length - 1; i++) {
            expect(history[i].changedAt.getTime()).toBeGreaterThanOrEqual(
              history[i + 1].changedAt.getTime()
            );
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Multiple operations create correctly ordered history', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, async (taskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create task and perform multiple operations
        const task = await taskService.create({ name: taskName });
        await taskService.update(task.id, { priority: 'high' });
        await taskService.update(task.id, { description: 'Test description' });
        await taskService.toggleComplete(task.id);
        
        // Get history
        const history = await taskService.getHistory(task.id);
        
        // Should have at least 4 entries (created, priority, description, completed)
        expect(history.length).toBeGreaterThanOrEqual(4);
        
        // Verify ordering (timestamps should be non-increasing)
        for (let i = 0; i < history.length - 1; i++) {
          expect(history[i].changedAt.getTime()).toBeGreaterThanOrEqual(
            history[i + 1].changedAt.getTime()
          );
        }
        
        // Verify all expected fields are present
        const fields = history.map(h => h.field);
        expect(fields).toContain('created');
        expect(fields).toContain('priority');
        expect(fields).toContain('description');
        expect(fields).toContain('completed');
      }),
      { numRuns: 50 }
    );
  });
});



describe('Property 11: Subtask Parent Association', () => {
  /**
   * **Feature: daily-task-planner, Property 11: Subtask Parent Association**
   * **Validates: Requirements 6.1**
   * 
   * For any subtask added to a task, the subtask SHALL be retrievable as a child
   * of that parent task.
   */
  test('Subtask is associated with parent task', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validTaskName, async (taskName, subtaskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM subtasks');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create task and add subtask
        const task = await taskService.create({ name: taskName });
        const subtask = await taskService.addSubtask(task.id, subtaskName);
        
        // Verify subtask is associated with parent
        expect(subtask.taskId).toBe(task.id);
        expect(subtask.name).toBe(subtaskName.trim());
        
        // Verify subtask is retrievable via parent task
        const retrievedTask = await taskService.getById(task.id);
        expect(retrievedTask).not.toBeNull();
        expect(retrievedTask!.subtasks).toBeDefined();
        expect(retrievedTask!.subtasks!.length).toBe(1);
        expect(retrievedTask!.subtasks![0].id).toBe(subtask.id);
        expect(retrievedTask!.subtasks![0].taskId).toBe(task.id);
      }),
      { numRuns: 50 }
    );
  });

  test('Multiple subtasks are all associated with parent task', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 1, maxLength: 5 }),
        async (taskName, subtaskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task and add multiple subtasks
          const task = await taskService.create({ name: taskName });
          const createdSubtasks: Subtask[] = [];
          
          for (const name of subtaskNames) {
            const subtask = await taskService.addSubtask(task.id, name);
            createdSubtasks.push(subtask);
          }
          
          // Verify all subtasks are associated with parent
          for (const subtask of createdSubtasks) {
            expect(subtask.taskId).toBe(task.id);
          }
          
          // Verify all subtasks are retrievable via parent task
          const retrievedTask = await taskService.getById(task.id);
          expect(retrievedTask!.subtasks!.length).toBe(subtaskNames.length);
          
          for (const subtask of retrievedTask!.subtasks!) {
            expect(subtask.taskId).toBe(task.id);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Subtasks are ordered by creation order', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 2, maxLength: 5 }),
        async (taskName, subtaskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task and add subtasks
          const task = await taskService.create({ name: taskName });
          const createdSubtasks: Subtask[] = [];
          
          for (const name of subtaskNames) {
            const subtask = await taskService.addSubtask(task.id, name);
            createdSubtasks.push(subtask);
          }
          
          // Verify subtasks are ordered by their order field
          const retrievedTask = await taskService.getById(task.id);
          const subtasks = retrievedTask!.subtasks!;
          
          for (let i = 0; i < subtasks.length - 1; i++) {
            expect(subtasks[i].order).toBeLessThan(subtasks[i + 1].order);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});


describe('Property 12: Subtask Completion Independence', () => {
  /**
   * **Feature: daily-task-planner, Property 12: Subtask Completion Independence**
   * **Validates: Requirements 6.3**
   * 
   * For any task where all subtasks are marked complete, the parent task completed
   * status SHALL remain unchanged (not automatically set to true).
   */
  test('Completing all subtasks does not auto-complete parent task', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 1, maxLength: 5 }),
        async (taskName, subtaskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task and add subtasks
          const task = await taskService.create({ name: taskName });
          const createdSubtasks: Subtask[] = [];
          
          for (const name of subtaskNames) {
            const subtask = await taskService.addSubtask(task.id, name);
            createdSubtasks.push(subtask);
          }
          
          // Complete all subtasks
          for (const subtask of createdSubtasks) {
            await taskService.toggleSubtask(subtask.id);
          }
          
          // Verify parent task is NOT completed
          const retrievedTask = await taskService.getById(task.id);
          expect(retrievedTask!.completed).toBe(false);
          
          // Verify all subtasks are completed
          for (const subtask of retrievedTask!.subtasks!) {
            expect(subtask.completed).toBe(true);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Subtask completion is independent of parent task completion', async () => {
    await fc.assert(
      fc.asyncProperty(validTaskName, validTaskName, async (taskName, subtaskName) => {
        // Clean up
        sqlite.exec('DELETE FROM task_history');
        sqlite.exec('DELETE FROM subtasks');
        sqlite.exec('DELETE FROM tasks');
        sqlite.exec('DELETE FROM lists');
        
        await listService.ensureInboxExists();
        
        // Create task and add subtask
        const task = await taskService.create({ name: taskName });
        const subtask = await taskService.addSubtask(task.id, subtaskName);
        
        // Complete parent task
        await taskService.toggleComplete(task.id);
        
        // Verify subtask is NOT completed
        const retrievedTask = await taskService.getById(task.id);
        expect(retrievedTask!.completed).toBe(true);
        expect(retrievedTask!.subtasks![0].completed).toBe(false);
        
        // Complete subtask
        await taskService.toggleSubtask(subtask.id);
        
        // Verify both are now completed independently
        const finalTask = await taskService.getById(task.id);
        expect(finalTask!.completed).toBe(true);
        expect(finalTask!.subtasks![0].completed).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});


describe('Property 13: Subtask Cascade Delete', () => {
  /**
   * **Feature: daily-task-planner, Property 13: Subtask Cascade Delete**
   * **Validates: Requirements 6.4**
   * 
   * For any task with subtasks, deleting the parent task SHALL result in all
   * subtasks being deleted.
   */
  test('Deleting parent task deletes all subtasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 1, maxLength: 5 }),
        async (taskName, subtaskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task and add subtasks
          const task = await taskService.create({ name: taskName });
          const subtaskIds: string[] = [];
          
          for (const name of subtaskNames) {
            const subtask = await taskService.addSubtask(task.id, name);
            subtaskIds.push(subtask.id);
          }
          
          // Verify subtasks exist
          const taskBefore = await taskService.getById(task.id);
          expect(taskBefore!.subtasks!.length).toBe(subtaskNames.length);
          
          // Delete parent task
          await taskService.delete(task.id);
          
          // Verify parent task is deleted
          const taskAfter = await taskService.getById(task.id);
          expect(taskAfter).toBeNull();
          
          // Verify all subtasks are deleted (check directly in DB)
          const remainingSubtasks = testDb
            .select()
            .from(schema.subtasks)
            .where(eq(schema.subtasks.taskId, task.id))
            .all();
          expect(remainingSubtasks.length).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Deleting individual subtask does not affect parent or other subtasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.array(validTaskName, { minLength: 2, maxLength: 5 }),
        async (taskName, subtaskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM subtasks');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create task and add subtasks
          const task = await taskService.create({ name: taskName });
          const createdSubtasks: Subtask[] = [];
          
          for (const name of subtaskNames) {
            const subtask = await taskService.addSubtask(task.id, name);
            createdSubtasks.push(subtask);
          }
          
          // Delete first subtask
          await taskService.deleteSubtask(createdSubtasks[0].id);
          
          // Verify parent task still exists
          const taskAfter = await taskService.getById(task.id);
          expect(taskAfter).not.toBeNull();
          
          // Verify remaining subtasks still exist
          expect(taskAfter!.subtasks!.length).toBe(subtaskNames.length - 1);
          
          // Verify deleted subtask is not in the list
          const subtaskIds = taskAfter!.subtasks!.map(s => s.id);
          expect(subtaskIds).not.toContain(createdSubtasks[0].id);
        }
      ),
      { numRuns: 30 }
    );
  });
});
