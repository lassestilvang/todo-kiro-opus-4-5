import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Reminder, CreateReminderInput, IReminderService, ReminderMethod } from '@/types';

// Predefined reminder intervals in minutes
export const PREDEFINED_INTERVALS = {
  '5_MINUTES': 5,
  '15_MINUTES': 15,
  '30_MINUTES': 30,
  '1_HOUR': 60,
  '1_DAY': 1440,      // 24 * 60
  '1_WEEK': 10080,    // 7 * 24 * 60
} as const;

// Valid reminder methods
const VALID_METHODS: ReminderMethod[] = ['push', 'email', 'in-app'];

// Custom error classes for Reminder service
export class ReminderNotFoundError extends Error {
  constructor(id: string) {
    super(`Reminder with id "${id}" not found`);
    this.name = 'ReminderNotFoundError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class ReminderValidationError extends Error {
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
 * @param data - The reminder input to validate
 * @returns Validation errors object (empty if valid)
 */
export function validateReminderInput(data: CreateReminderInput): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  // Validate offsetMinutes
  if (typeof data.offsetMinutes !== 'number' || !Number.isInteger(data.offsetMinutes)) {
    errors.offsetMinutes = ['offsetMinutes must be an integer'];
  } else if (data.offsetMinutes < 0) {
    errors.offsetMinutes = ['offsetMinutes must be non-negative'];
  }

  // Validate method
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
 * Reminder Service Implementation
 * Handles reminder scheduling and management for tasks
 * 
 * Requirements covered:
 * - 27.1: Predefined intervals (5 min, 15 min, 30 min, 1 hour, 1 day, 1 week) or custom time
 * - 27.2: Notification method selection (push, email, in-app)
 * - 27.4: Multiple reminders per task
 * - 27.5: Display configured reminder settings
 */
export const reminderService: IReminderService = {

  /**
   * Schedules a new reminder for a task.
   * Supports predefined intervals and custom times.
   * 
   * @param taskId - The task ID to attach the reminder to
   * @param reminder - The reminder configuration (offsetMinutes and method)
   * @returns The created reminder
   * @throws TaskNotFoundError if task doesn't exist
   * @throws ReminderValidationError if input is invalid
   */
  async scheduleReminder(taskId: string, reminder: CreateReminderInput): Promise<Reminder> {
    // Validate input
    const validationErrors = validateReminderInput(reminder);
    if (Object.keys(validationErrors).length > 0) {
      throw new ReminderValidationError(validationErrors);
    }

    // Verify task exists
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Create the reminder
    const id = uuidv4();

    await db.insert(schema.reminders).values({
      id,
      taskId,
      offsetMinutes: reminder.offsetMinutes,
      method: reminder.method,
      sent: false,
    });

    const [created] = await db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.id, id));

    return toReminder(created);
  },

  /**
   * Cancels (deletes) a reminder.
   * 
   * @param reminderId - The reminder ID to cancel
   * @throws ReminderNotFoundError if reminder doesn't exist
   */
  async cancelReminder(reminderId: string): Promise<void> {
    // Check if reminder exists
    const [existing] = await db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.id, reminderId));

    if (!existing) {
      throw new ReminderNotFoundError(reminderId);
    }

    // Delete the reminder
    await db.delete(schema.reminders).where(eq(schema.reminders.id, reminderId));
  },

  /**
   * Gets all reminders for a task.
   * 
   * @param taskId - The task ID
   * @returns Array of reminders for the task
   */
  async getByTaskId(taskId: string): Promise<Reminder[]> {
    const rows = await db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.taskId, taskId));

    return rows.map(toReminder);
  },
};

/**
 * Gets a reminder by ID.
 * 
 * @param id - The reminder ID
 * @returns The reminder or null if not found
 */
export async function getReminderById(id: string): Promise<Reminder | null> {
  const [row] = await db
    .select()
    .from(schema.reminders)
    .where(eq(schema.reminders.id, id));

  return row ? toReminder(row) : null;
}

/**
 * Marks a reminder as sent.
 * 
 * @param id - The reminder ID
 * @throws ReminderNotFoundError if reminder doesn't exist
 */
export async function markReminderSent(id: string): Promise<Reminder> {
  const [existing] = await db
    .select()
    .from(schema.reminders)
    .where(eq(schema.reminders.id, id));

  if (!existing) {
    throw new ReminderNotFoundError(id);
  }

  await db
    .update(schema.reminders)
    .set({ sent: true })
    .where(eq(schema.reminders.id, id));

  const [updated] = await db
    .select()
    .from(schema.reminders)
    .where(eq(schema.reminders.id, id));

  return toReminder(updated);
}

export default reminderService;
