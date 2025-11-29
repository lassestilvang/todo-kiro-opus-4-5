/**
 * Property-based tests for View Filtering
 * 
 * Tests Properties 25-30 from the design document
 * **Validates: Requirements 12.1, 12.2, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 15.1, 15.2**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, desc, asc, gte, lt } from 'drizzle-orm';
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
  Priority,
  GroupedTasks,
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
    recurrence: undefined,
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

function toLabel(row: typeof schema.labels.$inferSelect): Label {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
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

/**
 * Groups tasks by their date.
 */
function groupTasksByDate(tasks: Task[]): GroupedTasks[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.date) continue;
    
    const dateKey = task.date.toISOString().split('T')[0];
    const existing = groups.get(dateKey) || [];
    existing.push(task);
    groups.set(dateKey, existing);
  }

  const result: GroupedTasks[] = [];
  for (const [dateKey, groupTasks] of groups) {
    const date = new Date(dateKey);
    date.setHours(0, 0, 0, 0);
    result.push({
      date,
      dateKey,
      tasks: groupTasks,
    });
  }

  result.sort((a, b) => a.date.getTime() - b.date.getTime());
  return result;
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


// Extended task service interface for view methods
interface IExtendedTaskService extends ITaskService {
  getNext7Days(includeCompleted?: boolean): Promise<Task[]>;
  getNext7DaysGrouped(includeCompleted?: boolean): Promise<GroupedTasks[]>;
  getUpcoming(includeCompleted?: boolean): Promise<Task[]>;
  getUpcomingGrouped(includeCompleted?: boolean): Promise<GroupedTasks[]>;
}

// Create test-specific task service with view methods
function createTestTaskService(db: ReturnType<typeof drizzle>, listService: IListService): IExtendedTaskService {
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

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined) updateData.description = data.description ?? null;
      if (data.listId !== undefined) updateData.listId = data.listId;
      if (data.date !== undefined) updateData.date = data.date ?? null;
      if (data.deadline !== undefined) updateData.deadline = data.deadline ?? null;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.completed !== undefined) {
        updateData.completed = data.completed;
        updateData.completedAt = data.completed ? now : null;
      }

      db.update(schema.tasks).set(updateData).where(eq(schema.tasks.id, id)).run();

      const [updated] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      const result = toTask(updated);
      result.labels = await getLabelsForTask(id);
      result.subtasks = await getSubtasksForTask(id);
      return result;
    },

    async delete(id: string): Promise<void> {
      const [existing] = db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).all();
      if (!existing) throw new TaskNotFoundError(id);
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
        return r.date >= start && r.date < end;
      });
      filtered.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
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

    async getNext7Days(includeCompleted = true): Promise<Task[]> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 8); // +8 because end is exclusive
      return this.getByDateRange(today, endDate, includeCompleted);
    },

    async getNext7DaysGrouped(includeCompleted = true): Promise<GroupedTasks[]> {
      const tasks = await this.getNext7Days(includeCompleted);
      return groupTasksByDate(tasks);
    },

    async getUpcoming(includeCompleted = true): Promise<Task[]> {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rows = db.select().from(schema.tasks).all();
      const filtered = rows.filter(r => {
        if (!r.date) return false;
        if (!includeCompleted && r.completed) return false;
        return r.date >= today;
      });
      filtered.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.getTime() - b.date.getTime();
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

    async getUpcomingGrouped(includeCompleted = true): Promise<GroupedTasks[]> {
      const tasks = await this.getUpcoming(includeCompleted);
      return groupTasksByDate(tasks);
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
      throw new Error('Not implemented');
    },

    async deleteSubtask(subtaskId: string): Promise<void> {
      throw new Error('Not implemented');
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
let taskService: IExtendedTaskService;

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

// Helper to create a date at midnight
function dateAtMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to add days to a date
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Arbitraries for generating test data
const validTaskName = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const validPriority = fc.constantFrom<Priority>('high', 'medium', 'low', 'none');

// Generate a date offset from today (-30 to +30 days)
const dateOffset = fc.integer({ min: -30, max: 30 });

// Generate task data with date
const taskWithDate = fc.record({
  name: validTaskName,
  priority: validPriority,
  daysFromToday: dateOffset,
  completed: fc.boolean(),
});

describe('Property 25: Today View Date Filter', () => {
  /**
   * **Feature: daily-task-planner, Property 25: Today View Date Filter**
   * **Validates: Requirements 12.1**
   * 
   * For any set of tasks with various dates, the Today view SHALL return
   * only tasks where the date equals the current date.
   */
  test('Today view returns only tasks with date matching current date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate, { minLength: 1, maxLength: 20 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks with various dates
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              priority: data.priority,
              date: taskDate,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
            
            const updatedTask = await taskService.getById(task.id);
            if (updatedTask) createdTasks.push(updatedTask);
          }
          
          // Get today's tasks (including completed)
          const todayTasks = await taskService.getToday(true);
          
          // Verify all returned tasks have today's date
          for (const task of todayTasks) {
            expect(task.date).toBeDefined();
            const taskDateMidnight = dateAtMidnight(task.date!);
            expect(taskDateMidnight.getTime()).toBe(today.getTime());
          }
          
          // Verify all tasks with today's date are returned
          const expectedTodayTasks = createdTasks.filter(t => {
            if (!t.date) return false;
            const taskDateMidnight = dateAtMidnight(t.date);
            return taskDateMidnight.getTime() === today.getTime();
          });
          
          expect(todayTasks.length).toBe(expectedTodayTasks.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});


describe('Property 26: Completed Task Toggle Filter', () => {
  /**
   * **Feature: daily-task-planner, Property 26: Completed Task Toggle Filter**
   * **Validates: Requirements 12.2, 13.3, 14.3, 15.2**
   * 
   * For any view (Today, Next 7 Days, Upcoming, All) with the completed toggle off,
   * completed tasks SHALL be excluded from results.
   */
  test('Today view excludes completed tasks when includeCompleted is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate.filter(t => t.daysFromToday === 0), { minLength: 2, maxLength: 10 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks for today
          for (const data of taskDataList) {
            const task = await taskService.create({
              name: data.name,
              date: today,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
          }
          
          // Get today's tasks excluding completed
          const todayTasksExcludeCompleted = await taskService.getToday(false);
          
          // Verify no completed tasks are returned
          for (const task of todayTasksExcludeCompleted) {
            expect(task.completed).toBe(false);
          }
          
          // Get today's tasks including completed
          const todayTasksIncludeCompleted = await taskService.getToday(true);
          
          // Verify completed tasks are included when toggle is on
          const completedCount = taskDataList.filter(t => t.completed).length;
          const incompleteCount = taskDataList.filter(t => !t.completed).length;
          
          expect(todayTasksExcludeCompleted.length).toBe(incompleteCount);
          expect(todayTasksIncludeCompleted.length).toBe(taskDataList.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Next 7 Days view excludes completed tasks when includeCompleted is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate.filter(t => t.daysFromToday >= 0 && t.daysFromToday <= 7), { minLength: 2, maxLength: 10 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
          }
          
          // Get next 7 days tasks excluding completed
          const tasksExcludeCompleted = await taskService.getNext7Days(false);
          
          // Verify no completed tasks are returned
          for (const task of tasksExcludeCompleted) {
            expect(task.completed).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Upcoming view excludes completed tasks when includeCompleted is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate.filter(t => t.daysFromToday >= 0), { minLength: 2, maxLength: 10 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
          }
          
          // Get upcoming tasks excluding completed
          const tasksExcludeCompleted = await taskService.getUpcoming(false);
          
          // Verify no completed tasks are returned
          for (const task of tasksExcludeCompleted) {
            expect(task.completed).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('All view excludes completed tasks when includeCompleted is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate, { minLength: 2, maxLength: 10 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
          }
          
          // Get all tasks excluding completed
          const tasksExcludeCompleted = await taskService.getAll(false);
          
          // Verify no completed tasks are returned
          for (const task of tasksExcludeCompleted) {
            expect(task.completed).toBe(false);
          }
          
          // Verify count matches
          const incompleteCount = taskDataList.filter(t => !t.completed).length;
          expect(tasksExcludeCompleted.length).toBe(incompleteCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});


describe('Property 27: Next 7 Days View Date Range', () => {
  /**
   * **Feature: daily-task-planner, Property 27: Next 7 Days View Date Range**
   * **Validates: Requirements 13.1**
   * 
   * For any set of tasks, the Next 7 Days view SHALL return only tasks
   * with dates from today through 7 days ahead (inclusive).
   */
  test('Next 7 Days view returns only tasks within the 7-day range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate, { minLength: 1, maxLength: 20 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          const endDate = addDays(today, 8); // Day 8 at midnight (exclusive)
          
          // Create tasks with various dates
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            createdTasks.push(task);
          }
          
          // Get next 7 days tasks
          const next7DaysTasks = await taskService.getNext7Days(true);
          
          // Verify all returned tasks are within the range
          for (const task of next7DaysTasks) {
            expect(task.date).toBeDefined();
            const taskDate = dateAtMidnight(task.date!);
            expect(taskDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
            expect(taskDate.getTime()).toBeLessThan(endDate.getTime());
          }
          
          // Verify all tasks within range are returned
          const expectedTasks = createdTasks.filter(t => {
            if (!t.date) return false;
            const taskDate = dateAtMidnight(t.date);
            return taskDate.getTime() >= today.getTime() && taskDate.getTime() < endDate.getTime();
          });
          
          expect(next7DaysTasks.length).toBe(expectedTasks.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 28: Date Grouping', () => {
  /**
   * **Feature: daily-task-planner, Property 28: Date Grouping**
   * **Validates: Requirements 13.2, 14.2**
   * 
   * For any view that groups by date (Next 7 Days, Upcoming),
   * tasks SHALL be grouped correctly by their date value.
   */
  test('Next 7 Days grouped view groups tasks correctly by date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate.filter(t => t.daysFromToday >= 0 && t.daysFromToday <= 7), { minLength: 3, maxLength: 15 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            await taskService.create({
              name: data.name,
              date: taskDate,
            });
          }
          
          // Get grouped tasks
          const groupedTasks = await taskService.getNext7DaysGrouped(true);
          
          // Verify each group has tasks with matching dates
          for (const group of groupedTasks) {
            for (const task of group.tasks) {
              expect(task.date).toBeDefined();
              const taskDateKey = task.date!.toISOString().split('T')[0];
              expect(taskDateKey).toBe(group.dateKey);
            }
          }
          
          // Verify groups are sorted by date
          for (let i = 1; i < groupedTasks.length; i++) {
            expect(groupedTasks[i].date.getTime()).toBeGreaterThan(groupedTasks[i - 1].date.getTime());
          }
          
          // Verify total task count matches
          const totalGroupedTasks = groupedTasks.reduce((sum, g) => sum + g.tasks.length, 0);
          const flatTasks = await taskService.getNext7Days(true);
          expect(totalGroupedTasks).toBe(flatTasks.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Upcoming grouped view groups tasks correctly by date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate.filter(t => t.daysFromToday >= 0), { minLength: 3, maxLength: 15 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            await taskService.create({
              name: data.name,
              date: taskDate,
            });
          }
          
          // Get grouped tasks
          const groupedTasks = await taskService.getUpcomingGrouped(true);
          
          // Verify each group has tasks with matching dates
          for (const group of groupedTasks) {
            for (const task of group.tasks) {
              expect(task.date).toBeDefined();
              const taskDateKey = task.date!.toISOString().split('T')[0];
              expect(taskDateKey).toBe(group.dateKey);
            }
          }
          
          // Verify groups are sorted by date
          for (let i = 1; i < groupedTasks.length; i++) {
            expect(groupedTasks[i].date.getTime()).toBeGreaterThan(groupedTasks[i - 1].date.getTime());
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});


describe('Property 29: Upcoming View Future Filter', () => {
  /**
   * **Feature: daily-task-planner, Property 29: Upcoming View Future Filter**
   * **Validates: Requirements 14.1**
   * 
   * For any set of tasks, the Upcoming view SHALL return only tasks
   * with dates from today onward.
   */
  test('Upcoming view returns only tasks with dates from today onward', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate, { minLength: 1, maxLength: 20 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks with various dates (past and future)
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            createdTasks.push(task);
          }
          
          // Get upcoming tasks
          const upcomingTasks = await taskService.getUpcoming(true);
          
          // Verify all returned tasks have dates from today onward
          for (const task of upcomingTasks) {
            expect(task.date).toBeDefined();
            const taskDate = dateAtMidnight(task.date!);
            expect(taskDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
          }
          
          // Verify all tasks from today onward are returned
          const expectedTasks = createdTasks.filter(t => {
            if (!t.date) return false;
            const taskDate = dateAtMidnight(t.date);
            return taskDate.getTime() >= today.getTime();
          });
          
          expect(upcomingTasks.length).toBe(expectedTasks.length);
          
          // Verify past tasks are NOT returned
          const pastTasks = createdTasks.filter(t => {
            if (!t.date) return false;
            const taskDate = dateAtMidnight(t.date);
            return taskDate.getTime() < today.getTime();
          });
          
          for (const pastTask of pastTasks) {
            const found = upcomingTasks.find(t => t.id === pastTask.id);
            expect(found).toBeUndefined();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 30: All View Completeness', () => {
  /**
   * **Feature: daily-task-planner, Property 30: All View Completeness**
   * **Validates: Requirements 15.1**
   * 
   * For any set of tasks (scheduled and unscheduled),
   * the All view SHALL return every task.
   */
  test('All view returns all tasks including scheduled and unscheduled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: validTaskName,
            hasDate: fc.boolean(),
            daysFromToday: dateOffset,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks - some with dates, some without
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const taskDate = data.hasDate ? addDays(today, data.daysFromToday) : undefined;
            const task = await taskService.create({
              name: data.name,
              date: taskDate,
            });
            createdTasks.push(task);
          }
          
          // Get all tasks
          const allTasks = await taskService.getAll(true);
          
          // Verify count matches
          expect(allTasks.length).toBe(createdTasks.length);
          
          // Verify all created tasks are returned
          for (const createdTask of createdTasks) {
            const found = allTasks.find(t => t.id === createdTask.id);
            expect(found).toBeDefined();
          }
          
          // Verify both scheduled and unscheduled tasks are included
          const scheduledTasks = allTasks.filter(t => t.date !== undefined);
          const unscheduledTasks = allTasks.filter(t => t.date === undefined);
          
          const expectedScheduled = taskDataList.filter(t => t.hasDate).length;
          const expectedUnscheduled = taskDataList.filter(t => !t.hasDate).length;
          
          expect(scheduledTasks.length).toBe(expectedScheduled);
          expect(unscheduledTasks.length).toBe(expectedUnscheduled);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('All view returns tasks regardless of date (past, present, future)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskWithDate, { minLength: 5, maxLength: 15 }),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const today = dateAtMidnight(new Date());
          
          // Create tasks with various dates
          for (const data of taskDataList) {
            const taskDate = addDays(today, data.daysFromToday);
            await taskService.create({
              name: data.name,
              date: taskDate,
            });
          }
          
          // Get all tasks
          const allTasks = await taskService.getAll(true);
          
          // Verify count matches
          expect(allTasks.length).toBe(taskDataList.length);
          
          // Verify tasks from all time periods are included
          const pastTasks = allTasks.filter(t => t.date && dateAtMidnight(t.date).getTime() < today.getTime());
          const todayTasks = allTasks.filter(t => t.date && dateAtMidnight(t.date).getTime() === today.getTime());
          const futureTasks = allTasks.filter(t => t.date && dateAtMidnight(t.date).getTime() > today.getTime());
          
          const expectedPast = taskDataList.filter(t => t.daysFromToday < 0).length;
          const expectedToday = taskDataList.filter(t => t.daysFromToday === 0).length;
          const expectedFuture = taskDataList.filter(t => t.daysFromToday > 0).length;
          
          expect(pastTasks.length).toBe(expectedPast);
          expect(todayTasks.length).toBe(expectedToday);
          expect(futureTasks.length).toBe(expectedFuture);
        }
      ),
      { numRuns: 50 }
    );
  });
});


describe('Property 31: Overdue Task Detection', () => {
  /**
   * **Feature: daily-task-planner, Property 31: Overdue Task Detection**
   * **Validates: Requirements 16.1**
   * 
   * For any incomplete task with a deadline in the past,
   * the task SHALL be marked as overdue.
   */
  test('Incomplete tasks with past deadlines are detected as overdue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: validTaskName,
            deadlineDaysFromNow: fc.integer({ min: -30, max: 30 }),
            completed: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const now = new Date();
          
          // Create tasks with various deadlines
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const deadline = addDays(now, data.deadlineDaysFromNow);
            const task = await taskService.create({
              name: data.name,
              deadline: deadline,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
            
            const updatedTask = await taskService.getById(task.id);
            if (updatedTask) createdTasks.push(updatedTask);
          }
          
          // Get overdue tasks
          const overdueTasks = await taskService.getOverdue();
          
          // Verify all returned tasks are incomplete with past deadlines
          for (const task of overdueTasks) {
            expect(task.completed).toBe(false);
            expect(task.deadline).toBeDefined();
            expect(task.deadline!.getTime()).toBeLessThan(now.getTime());
          }
          
          // Verify all incomplete tasks with past deadlines are returned
          const expectedOverdue = createdTasks.filter(t => 
            !t.completed && t.deadline && t.deadline.getTime() < now.getTime()
          );
          
          expect(overdueTasks.length).toBe(expectedOverdue.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Completed tasks are never marked as overdue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: validTaskName,
            deadlineDaysFromNow: fc.integer({ min: -30, max: -1 }), // All past deadlines
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const now = new Date();
          
          // Create tasks with past deadlines and complete them
          for (const data of taskDataList) {
            const deadline = addDays(now, data.deadlineDaysFromNow);
            const task = await taskService.create({
              name: data.name,
              deadline: deadline,
            });
            
            // Complete the task
            await taskService.toggleComplete(task.id);
          }
          
          // Get overdue tasks
          const overdueTasks = await taskService.getOverdue();
          
          // Verify no completed tasks are returned
          expect(overdueTasks.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Tasks without deadlines are never marked as overdue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validTaskName, { minLength: 1, maxLength: 10 }),
        async (taskNames) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          // Create tasks without deadlines
          for (const name of taskNames) {
            await taskService.create({ name });
          }
          
          // Get overdue tasks
          const overdueTasks = await taskService.getOverdue();
          
          // Verify no tasks without deadlines are returned
          expect(overdueTasks.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});


describe('Property 32: Overdue Count Accuracy', () => {
  /**
   * **Feature: daily-task-planner, Property 32: Overdue Count Accuracy**
   * **Validates: Requirements 16.2**
   * 
   * For any set of tasks, the overdue count SHALL equal the number
   * of incomplete tasks with past deadlines.
   */
  test('Overdue count matches the number of overdue tasks', async () => {
    // Extend task service with getOverdueCount for testing
    const getOverdueCount = async (): Promise<number> => {
      const overdueTasks = await taskService.getOverdue();
      return overdueTasks.length;
    };

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: validTaskName,
            // Use only clearly past (-30 to -1) or clearly future (1 to 30) deadlines
            // to avoid edge cases with "today" deadlines
            deadlineDaysFromNow: fc.oneof(
              fc.integer({ min: -30, max: -1 }),
              fc.integer({ min: 1, max: 30 })
            ),
            completed: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const now = new Date();
          
          // Create tasks with various deadlines
          for (const data of taskDataList) {
            const deadline = addDays(now, data.deadlineDaysFromNow);
            const task = await taskService.create({
              name: data.name,
              deadline: deadline,
            });
            
            if (data.completed) {
              await taskService.toggleComplete(task.id);
            }
          }
          
          // Get overdue count
          const overdueCount = await getOverdueCount();
          
          // Get overdue tasks list
          const overdueTasks = await taskService.getOverdue();
          
          // Verify count matches list length
          expect(overdueCount).toBe(overdueTasks.length);
          
          // Verify count matches expected (past deadlines that are not completed)
          const expectedCount = taskDataList.filter(t => 
            !t.completed && t.deadlineDaysFromNow < 0
          ).length;
          
          expect(overdueCount).toBe(expectedCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 33: Overdue Completion Clearing', () => {
  /**
   * **Feature: daily-task-planner, Property 33: Overdue Completion Clearing**
   * **Validates: Requirements 16.3**
   * 
   * For any overdue task that is marked complete,
   * the task SHALL no longer be considered overdue.
   */
  test('Completing an overdue task removes it from overdue list', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: validTaskName,
            deadlineDaysFromNow: fc.integer({ min: -30, max: -1 }), // All past deadlines
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (taskDataList) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const now = new Date();
          
          // Create overdue tasks
          const createdTasks: Task[] = [];
          for (const data of taskDataList) {
            const deadline = addDays(now, data.deadlineDaysFromNow);
            const task = await taskService.create({
              name: data.name,
              deadline: deadline,
            });
            createdTasks.push(task);
          }
          
          // Verify all tasks are initially overdue
          let overdueTasks = await taskService.getOverdue();
          expect(overdueTasks.length).toBe(createdTasks.length);
          
          // Complete each task and verify it's removed from overdue list
          for (let i = 0; i < createdTasks.length; i++) {
            await taskService.toggleComplete(createdTasks[i].id);
            
            overdueTasks = await taskService.getOverdue();
            
            // Verify the completed task is no longer in overdue list
            const foundCompleted = overdueTasks.find(t => t.id === createdTasks[i].id);
            expect(foundCompleted).toBeUndefined();
            
            // Verify remaining overdue count
            expect(overdueTasks.length).toBe(createdTasks.length - (i + 1));
          }
          
          // Verify no overdue tasks remain
          overdueTasks = await taskService.getOverdue();
          expect(overdueTasks.length).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Uncompleting a task with past deadline makes it overdue again', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTaskName,
        fc.integer({ min: -30, max: -1 }),
        async (taskName, deadlineDaysFromNow) => {
          // Clean up
          sqlite.exec('DELETE FROM task_history');
          sqlite.exec('DELETE FROM tasks');
          sqlite.exec('DELETE FROM lists');
          
          await listService.ensureInboxExists();
          
          const now = new Date();
          const deadline = addDays(now, deadlineDaysFromNow);
          
          // Create an overdue task
          const task = await taskService.create({
            name: taskName,
            deadline: deadline,
          });
          
          // Verify it's overdue
          let overdueTasks = await taskService.getOverdue();
          expect(overdueTasks.length).toBe(1);
          expect(overdueTasks[0].id).toBe(task.id);
          
          // Complete the task
          await taskService.toggleComplete(task.id);
          
          // Verify it's no longer overdue
          overdueTasks = await taskService.getOverdue();
          expect(overdueTasks.length).toBe(0);
          
          // Uncomplete the task
          await taskService.toggleComplete(task.id);
          
          // Verify it's overdue again
          overdueTasks = await taskService.getOverdue();
          expect(overdueTasks.length).toBe(1);
          expect(overdueTasks[0].id).toBe(task.id);
        }
      ),
      { numRuns: 50 }
    );
  });
});
