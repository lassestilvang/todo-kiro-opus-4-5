import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  Label,
  CreateLabelInput,
  UpdateLabelInput,
  ILabelService,
} from '@/types';
import { validateCreateLabel, validateUpdateLabel } from '@/lib/utils/validation';

// Custom error classes for Label service
export class LabelValidationError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'LabelValidationError';
  }
}

export class LabelNotFoundError extends Error {
  constructor(id: string) {
    super(`Label with id "${id}" not found`);
    this.name = 'LabelNotFoundError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
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
 * Label Service Implementation
 * Handles all label-related operations including CRUD and task associations
 */
export const labelService: ILabelService = {

  /**
   * Creates a new label.
   * @param data - The label creation data
   * @returns The created label
   * @throws LabelValidationError if validation fails
   */
  async create(data: CreateLabelInput): Promise<Label> {
    const validation = validateCreateLabel(data);
    if (!validation.valid) {
      throw new LabelValidationError('Invalid label data', validation.errors);
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(schema.labels).values({
      id,
      name: data.name.trim(),
      icon: data.icon ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const [label] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, id));

    return toLabel(label);
  },

  /**
   * Updates an existing label.
   * @param id - The label ID
   * @param data - The update data
   * @returns The updated label
   * @throws LabelNotFoundError if label doesn't exist
   * @throws LabelValidationError if validation fails
   */
  async update(id: string, data: UpdateLabelInput): Promise<Label> {
    const validation = validateUpdateLabel(data);
    if (!validation.valid) {
      throw new LabelValidationError('Invalid label data', validation.errors);
    }

    // Get the existing label
    const [existing] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, id));

    if (!existing) {
      throw new LabelNotFoundError(id);
    }

    const now = new Date();
    const updateData: Partial<typeof schema.labels.$inferInsert> = {
      updatedAt: now,
    };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.icon !== undefined) {
      updateData.icon = data.icon;
    }

    await db
      .update(schema.labels)
      .set(updateData)
      .where(eq(schema.labels.id, id));

    const [updated] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, id));

    return toLabel(updated);
  },

  /**
   * Deletes a label.
   * The cascade delete in the schema will automatically remove
   * all task-label associations when the label is deleted.
   * @param id - The label ID
   * @throws LabelNotFoundError if label doesn't exist
   */
  async delete(id: string): Promise<void> {
    // Get the existing label
    const [existing] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, id));

    if (!existing) {
      throw new LabelNotFoundError(id);
    }

    // Delete the label (cascade will remove task_labels entries)
    await db.delete(schema.labels).where(eq(schema.labels.id, id));
  },

  /**
   * Gets all labels.
   * @returns All labels ordered by creation date
   */
  async getAll(): Promise<Label[]> {
    const rows = await db
      .select()
      .from(schema.labels)
      .orderBy(schema.labels.createdAt);

    return rows.map(toLabel);
  },

  /**
   * Gets a label by ID.
   * @param id - The label ID
   * @returns The label or null if not found
   */
  async getById(id: string): Promise<Label | null> {
    const [row] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, id));

    return row ? toLabel(row) : null;
  },

  /**
   * Adds a label to a task.
   * @param taskId - The task ID
   * @param labelId - The label ID
   * @throws TaskNotFoundError if task doesn't exist
   * @throws LabelNotFoundError if label doesn't exist
   */
  async addToTask(taskId: string, labelId: string): Promise<void> {
    // Verify task exists
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Verify label exists
    const [label] = await db
      .select()
      .from(schema.labels)
      .where(eq(schema.labels.id, labelId));

    if (!label) {
      throw new LabelNotFoundError(labelId);
    }

    // Check if association already exists
    const [existing] = await db
      .select()
      .from(schema.taskLabels)
      .where(
        and(
          eq(schema.taskLabels.taskId, taskId),
          eq(schema.taskLabels.labelId, labelId)
        )
      );

    // Only insert if not already associated
    if (!existing) {
      await db.insert(schema.taskLabels).values({
        taskId,
        labelId,
      });
    }
  },

  /**
   * Removes a label from a task.
   * @param taskId - The task ID
   * @param labelId - The label ID
   */
  async removeFromTask(taskId: string, labelId: string): Promise<void> {
    await db
      .delete(schema.taskLabels)
      .where(
        and(
          eq(schema.taskLabels.taskId, taskId),
          eq(schema.taskLabels.labelId, labelId)
        )
      );
  },
};

export default labelService;
