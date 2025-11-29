import { db, schema } from '@/lib/db';
import { eq, and, desc, asc, gte, lt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  Subtask,
  Label,
  CreateTaskInput,
  UpdateTaskInput,
  TaskHistoryEntry,
  ITaskService,
  RecurrencePattern,
  GroupedTasks,
} from '@/types';
import { validateCreateTask, validateUpdateTask, DEFAULT_PRIORITY } from '@/lib/utils/validation';
import { calculateNextOccurrence } from '@/lib/utils/recurrence';
import { listService } from './list.service';

// Custom error classes for Task service
export class TaskValidationError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class SubtaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Subtask with id "${id}" not found`);
    this.name = 'SubtaskNotFoundError';
  }
}

/**
 * Converts a database row to a Task entity
 */
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


/**
 * Converts a database row to a Subtask entity
 */
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

/**
 * Converts a database row to a TaskHistoryEntry entity
 */
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

/**
 * Converts a database row to a Label entity
 */
function toLabel(row: typeof schema.labels.$inferSelect): Label {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Logs a history entry for a task field change
 */
async function logHistory(
  taskId: string,
  field: string,
  previousValue: string | null | undefined,
  newValue: string | null | undefined
): Promise<void> {
  const now = new Date();
  await db.insert(schema.taskHistory).values({
    id: uuidv4(),
    taskId,
    field,
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
    changedAt: now,
  });
}

/**
 * Serializes a value for history logging
 */
function serializeValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Fetches labels for a task
 */
async function getLabelsForTask(taskId: string): Promise<Label[]> {
  const rows = await db
    .select({
      label: schema.labels,
    })
    .from(schema.taskLabels)
    .innerJoin(schema.labels, eq(schema.taskLabels.labelId, schema.labels.id))
    .where(eq(schema.taskLabels.taskId, taskId));

  return rows.map(r => toLabel(r.label));
}

/**
 * Fetches subtasks for a task
 */
async function getSubtasksForTask(taskId: string): Promise<Subtask[]> {
  const rows = await db
    .select()
    .from(schema.subtasks)
    .where(eq(schema.subtasks.taskId, taskId))
    .orderBy(asc(schema.subtasks.order));

  return rows.map(toSubtask);
}

/**
 * Groups tasks by their date.
 * Tasks are grouped by the date portion (YYYY-MM-DD) of their date field.
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

  // Sort by date ascending
  result.sort((a, b) => a.date.getTime() - b.date.getTime());

  return result;
}

/**
 * Checks if a task is overdue.
 * A task is overdue if it's incomplete and has a deadline in the past.
 */
export function isOverdue(task: Task): boolean {
  if (task.completed) return false;
  if (!task.deadline) return false;
  return task.deadline < new Date();
}

/**
 * Creates the next occurrence of a recurring task.
 * @param task - The completed recurring task
 */
async function createNextRecurringOccurrence(task: typeof schema.tasks.$inferSelect): Promise<void> {
  if (!task.recurrence || !task.date) {
    return;
  }

  const recurrence = task.recurrence as RecurrencePattern;
  const nextDate = calculateNextOccurrence(task.date, recurrence);

  if (!nextDate) {
    return;
  }

  const now = new Date();
  const newId = uuidv4();

  await db.insert(schema.tasks).values({
    id: newId,
    name: task.name,
    description: task.description,
    listId: task.listId,
    date: nextDate,
    deadline: task.deadline ? new Date(nextDate.getTime() + (task.deadline.getTime() - task.date.getTime())) : null,
    estimate: task.estimate,
    actualTime: null,
    priority: task.priority,
    completed: false,
    completedAt: null,
    recurrence: task.recurrence,
    parentTaskId: task.id,
    createdAt: now,
    updatedAt: now,
  });

  // Copy labels to new task
  const labels = await db
    .select()
    .from(schema.taskLabels)
    .where(eq(schema.taskLabels.taskId, task.id));

  for (const label of labels) {
    await db.insert(schema.taskLabels).values({
      taskId: newId,
      labelId: label.labelId,
    });
  }

  await logHistory(newId, 'created', null, 'Recurring task occurrence created');
}

/**
 * Task Service Implementation
 * Handles all task-related operations including CRUD, subtasks, and history
 */
export const taskService: ITaskService = {

  /**
   * Creates a new task.
   * If no listId is provided, assigns to Inbox.
   * Priority defaults to 'none' if not specified.
   * @param data - The task creation data
   * @returns The created task
   * @throws TaskValidationError if validation fails
   */
  async create(data: CreateTaskInput): Promise<Task> {
    const validation = validateCreateTask(data);
    if (!validation.valid) {
      throw new TaskValidationError('Invalid task data', validation.errors);
    }

    // Get Inbox if no listId provided
    let listId = data.listId;
    if (!listId) {
      const inbox = await listService.getInbox();
      listId = inbox.id;
    }

    const now = new Date();
    const id = uuidv4();
    const priority = data.priority ?? DEFAULT_PRIORITY;

    await db.insert(schema.tasks).values({
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
    });

    // Log creation in history
    await logHistory(id, 'created', null, 'Task created');

    // Handle label assignments if provided
    if (data.labelIds && data.labelIds.length > 0) {
      for (const labelId of data.labelIds) {
        await db.insert(schema.taskLabels).values({
          taskId: id,
          labelId,
        });
      }
    }

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    const result = toTask(task);
    result.labels = await getLabelsForTask(id);
    result.subtasks = [];

    return result;
  },

  /**
   * Updates an existing task.
   * Logs all changes to task history.
   * @param id - The task ID
   * @param data - The update data
   * @returns The updated task
   * @throws TaskNotFoundError if task doesn't exist
   * @throws TaskValidationError if validation fails
   */
  async update(id: string, data: UpdateTaskInput): Promise<Task> {
    const validation = validateUpdateTask(data);
    if (!validation.valid) {
      throw new TaskValidationError('Invalid task data', validation.errors);
    }

    // Get the existing task
    const [existing] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    const now = new Date();
    const updateData: Partial<typeof schema.tasks.$inferInsert> = {
      updatedAt: now,
    };

    // Track changes for history
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

    if (data.date !== undefined) {
      const newDate = data.date ?? null;
      const existingDate = existing.date;
      if (serializeValue(newDate) !== serializeValue(existingDate)) {
        updateData.date = newDate;
        await logHistory(id, 'date', serializeValue(existingDate), serializeValue(newDate));
      }
    }

    if (data.deadline !== undefined) {
      const newDeadline = data.deadline ?? null;
      const existingDeadline = existing.deadline;
      if (serializeValue(newDeadline) !== serializeValue(existingDeadline)) {
        updateData.deadline = newDeadline;
        await logHistory(id, 'deadline', serializeValue(existingDeadline), serializeValue(newDeadline));
      }
    }

    if (data.estimate !== undefined) {
      const newEstimate = data.estimate ?? null;
      if (newEstimate !== existing.estimate) {
        updateData.estimate = newEstimate;
        await logHistory(id, 'estimate', serializeValue(existing.estimate), serializeValue(newEstimate));
      }
    }

    if (data.actualTime !== undefined) {
      const newActualTime = data.actualTime ?? null;
      if (newActualTime !== existing.actualTime) {
        updateData.actualTime = newActualTime;
        await logHistory(id, 'actualTime', serializeValue(existing.actualTime), serializeValue(newActualTime));
      }
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

    if (data.recurrence !== undefined) {
      const newRecurrence = data.recurrence ?? null;
      if (serializeValue(newRecurrence) !== serializeValue(existing.recurrence)) {
        updateData.recurrence = newRecurrence;
        await logHistory(id, 'recurrence', serializeValue(existing.recurrence), serializeValue(newRecurrence));
      }
    }

    await db
      .update(schema.tasks)
      .set(updateData)
      .where(eq(schema.tasks.id, id));

    // Handle label updates if provided
    if (data.labelIds !== undefined) {
      // Remove existing labels
      await db.delete(schema.taskLabels).where(eq(schema.taskLabels.taskId, id));
      
      // Add new labels
      for (const labelId of data.labelIds) {
        await db.insert(schema.taskLabels).values({
          taskId: id,
          labelId,
        });
      }
    }

    const [updated] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    const result = toTask(updated);
    result.labels = await getLabelsForTask(id);
    result.subtasks = await getSubtasksForTask(id);

    return result;
  },


  /**
   * Deletes a task and all associated data (subtasks, labels, attachments, reminders, history).
   * Cascade delete is handled by the database schema.
   * @param id - The task ID
   * @throws TaskNotFoundError if task doesn't exist
   */
  async delete(id: string): Promise<void> {
    // Get the existing task
    const [existing] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    // Delete the task (cascade will remove subtasks, labels, attachments, reminders, history)
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  },

  /**
   * Gets a task by ID with all relations.
   * @param id - The task ID
   * @returns The task or null if not found
   */
  async getById(id: string): Promise<Task | null> {
    const [row] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    if (!row) {
      return null;
    }

    const task = toTask(row);
    task.labels = await getLabelsForTask(id);
    task.subtasks = await getSubtasksForTask(id);

    return task;
  },

  /**
   * Gets all tasks for a specific list.
   * @param listId - The list ID
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Tasks in the list
   */
  async getByListId(listId: string, includeCompleted = true): Promise<Task[]> {
    const rows = await db
      .select()
      .from(schema.tasks)
      .where(
        includeCompleted
          ? eq(schema.tasks.listId, listId)
          : and(eq(schema.tasks.listId, listId), eq(schema.tasks.completed, false))
      )
      .orderBy(asc(schema.tasks.createdAt));
    
    const tasks: Task[] = [];
    for (const row of rows) {
      const task = toTask(row);
      task.labels = await getLabelsForTask(row.id);
      task.subtasks = await getSubtasksForTask(row.id);
      tasks.push(task);
    }

    return tasks;
  },

  /**
   * Gets tasks within a date range.
   * @param start - Start date (inclusive)
   * @param end - End date (exclusive)
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Tasks within the date range
   */
  async getByDateRange(start: Date, end: Date, includeCompleted = true): Promise<Task[]> {
    const conditions = [
      gte(schema.tasks.date, start),
      lt(schema.tasks.date, end),
    ];

    if (!includeCompleted) {
      conditions.push(eq(schema.tasks.completed, false));
    }

    const rows = await db
      .select()
      .from(schema.tasks)
      .where(and(...conditions))
      .orderBy(asc(schema.tasks.date), asc(schema.tasks.createdAt));

    const tasks: Task[] = [];
    for (const row of rows) {
      const task = toTask(row);
      task.labels = await getLabelsForTask(row.id);
      task.subtasks = await getSubtasksForTask(row.id);
      tasks.push(task);
    }

    return tasks;
  },

  /**
   * Gets tasks scheduled for today.
   * Tasks with date matching the current date (ignoring time).
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Today's tasks
   */
  async getToday(includeCompleted = true): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getByDateRange(today, tomorrow, includeCompleted);
  },

  /**
   * Gets tasks for the next 7 days (from today through 7 days ahead).
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Tasks for the next 7 days
   */
  async getNext7Days(includeCompleted = true): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 8); // +8 because end is exclusive

    return this.getByDateRange(today, endDate, includeCompleted);
  },

  /**
   * Gets tasks for the next 7 days grouped by date.
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Tasks grouped by date
   */
  async getNext7DaysGrouped(includeCompleted = true): Promise<GroupedTasks[]> {
    const tasks = await this.getNext7Days(includeCompleted);
    return groupTasksByDate(tasks);
  },

  /**
   * Gets all upcoming tasks (from today onward).
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Upcoming tasks
   */
  async getUpcoming(includeCompleted = true): Promise<Task[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const conditions = [
      gte(schema.tasks.date, today),
    ];

    if (!includeCompleted) {
      conditions.push(eq(schema.tasks.completed, false));
    }

    const rows = await db
      .select()
      .from(schema.tasks)
      .where(and(...conditions))
      .orderBy(asc(schema.tasks.date), asc(schema.tasks.createdAt));

    const tasks: Task[] = [];
    for (const row of rows) {
      const task = toTask(row);
      task.labels = await getLabelsForTask(row.id);
      task.subtasks = await getSubtasksForTask(row.id);
      tasks.push(task);
    }

    return tasks;
  },

  /**
   * Gets upcoming tasks grouped by date.
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns Tasks grouped by date
   */
  async getUpcomingGrouped(includeCompleted = true): Promise<GroupedTasks[]> {
    const tasks = await this.getUpcoming(includeCompleted);
    return groupTasksByDate(tasks);
  },

  /**
   * Gets all overdue tasks (incomplete with deadline in the past).
   * @returns Overdue tasks
   */
  async getOverdue(): Promise<Task[]> {
    const now = new Date();

    const rows = await db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.completed, false),
          lt(schema.tasks.deadline, now)
        )
      )
      .orderBy(asc(schema.tasks.deadline));

    const tasks: Task[] = [];
    for (const row of rows) {
      const task = toTask(row);
      task.labels = await getLabelsForTask(row.id);
      task.subtasks = await getSubtasksForTask(row.id);
      tasks.push(task);
    }

    return tasks;
  },

  /**
   * Gets the count of overdue tasks.
   * @returns Number of overdue tasks
   */
  async getOverdueCount(): Promise<number> {
    const now = new Date();

    const rows = await db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.completed, false),
          lt(schema.tasks.deadline, now)
        )
      );

    return rows.length;
  },

  /**
   * Gets all tasks.
   * @param includeCompleted - Whether to include completed tasks (default: true)
   * @returns All tasks
   */
  async getAll(includeCompleted = true): Promise<Task[]> {
    const rows = await db
      .select()
      .from(schema.tasks)
      .where(includeCompleted ? undefined : eq(schema.tasks.completed, false))
      .orderBy(asc(schema.tasks.createdAt));

    const tasks: Task[] = [];
    for (const row of rows) {
      const task = toTask(row);
      task.labels = await getLabelsForTask(row.id);
      task.subtasks = await getSubtasksForTask(row.id);
      tasks.push(task);
    }

    return tasks;
  },


  /**
   * Toggles the completion status of a task.
   * Logs the change to history.
   * If the task is recurring and being completed, creates the next occurrence.
   * @param id - The task ID
   * @returns The updated task
   * @throws TaskNotFoundError if task doesn't exist
   */
  async toggleComplete(id: string): Promise<Task> {
    const [existing] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    if (!existing) {
      throw new TaskNotFoundError(id);
    }

    const now = new Date();
    const newCompleted = !existing.completed;

    await db
      .update(schema.tasks)
      .set({
        completed: newCompleted,
        completedAt: newCompleted ? now : null,
        updatedAt: now,
      })
      .where(eq(schema.tasks.id, id));

    await logHistory(id, 'completed', String(existing.completed), String(newCompleted));

    // Handle recurring task - create next occurrence when completing
    if (newCompleted && existing.recurrence) {
      await createNextRecurringOccurrence(existing);
    }

    const [updated] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id));

    const result = toTask(updated);
    result.labels = await getLabelsForTask(id);
    result.subtasks = await getSubtasksForTask(id);

    return result;
  },

  /**
   * Adds a subtask to a task.
   * @param taskId - The parent task ID
   * @param name - The subtask name
   * @returns The created subtask
   * @throws TaskNotFoundError if parent task doesn't exist
   */
  async addSubtask(taskId: string, name: string): Promise<Subtask> {
    // Verify parent task exists
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Get the current max order for subtasks
    const existingSubtasks = await db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.taskId, taskId))
      .orderBy(desc(schema.subtasks.order))
      .limit(1);

    const nextOrder = existingSubtasks.length > 0 ? existingSubtasks[0].order + 1 : 0;

    const now = new Date();
    const id = uuidv4();

    await db.insert(schema.subtasks).values({
      id,
      taskId,
      name: name.trim(),
      completed: false,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    });

    const [subtask] = await db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, id));

    return toSubtask(subtask);
  },

  /**
   * Toggles the completion status of a subtask.
   * @param subtaskId - The subtask ID
   * @returns The updated subtask
   * @throws SubtaskNotFoundError if subtask doesn't exist
   */
  async toggleSubtask(subtaskId: string): Promise<Subtask> {
    const [existing] = await db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, subtaskId));

    if (!existing) {
      throw new SubtaskNotFoundError(subtaskId);
    }

    const now = new Date();

    await db
      .update(schema.subtasks)
      .set({
        completed: !existing.completed,
        updatedAt: now,
      })
      .where(eq(schema.subtasks.id, subtaskId));

    const [updated] = await db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, subtaskId));

    return toSubtask(updated);
  },

  /**
   * Deletes a subtask.
   * @param subtaskId - The subtask ID
   * @throws SubtaskNotFoundError if subtask doesn't exist
   */
  async deleteSubtask(subtaskId: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, subtaskId));

    if (!existing) {
      throw new SubtaskNotFoundError(subtaskId);
    }

    await db.delete(schema.subtasks).where(eq(schema.subtasks.id, subtaskId));
  },

  /**
   * Gets the history of changes for a task.
   * @param taskId - The task ID
   * @returns History entries ordered from most recent to oldest
   */
  async getHistory(taskId: string): Promise<TaskHistoryEntry[]> {
    const rows = await db
      .select()
      .from(schema.taskHistory)
      .where(eq(schema.taskHistory.taskId, taskId))
      .orderBy(desc(schema.taskHistory.changedAt));

    return rows.map(toHistoryEntry);
  },
};

export default taskService;
