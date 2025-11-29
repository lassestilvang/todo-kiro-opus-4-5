import { db, schema } from '@/lib/db';
import { eq, asc, and, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type {
  List,
  CreateListInput,
  UpdateListInput,
  IListService,
} from '@/types';
import { validateCreateList, validateUpdateList } from '@/lib/utils/validation';

// Custom error classes for List service
export class ListValidationError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ListValidationError';
  }
}

export class ListNotFoundError extends Error {
  constructor(id: string) {
    super(`List with id "${id}" not found`);
    this.name = 'ListNotFoundError';
  }
}

export class InboxProtectionError extends Error {
  constructor(operation: string) {
    super(`Cannot ${operation} the Inbox list`);
    this.name = 'InboxProtectionError';
  }
}

/**
 * Converts a database row to a List entity
 */
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

/**
 * List Service Implementation
 * Handles all list-related operations including CRUD and Inbox management
 */
export const listService: IListService = {

  /**
   * Ensures the Inbox list exists in the database.
   * Creates it if it doesn't exist, returns the existing one otherwise.
   * @returns The Inbox list
   */
  async ensureInboxExists(): Promise<List> {
    const existingInbox = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.isInbox, true))
      .limit(1);

    if (existingInbox.length > 0) {
      return toList(existingInbox[0]);
    }

    const now = new Date();
    const inboxId = uuidv4();

    await db.insert(schema.lists).values({
      id: inboxId,
      name: 'Inbox',
      isInbox: true,
      createdAt: now,
      updatedAt: now,
    });

    const [inbox] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, inboxId));

    return toList(inbox);
  },

  /**
   * Gets the Inbox list.
   * Ensures it exists before returning.
   * @returns The Inbox list
   */
  async getInbox(): Promise<List> {
    return this.ensureInboxExists();
  },

  /**
   * Creates a new list.
   * @param data - The list creation data
   * @returns The created list
   * @throws ListValidationError if validation fails
   */
  async create(data: CreateListInput): Promise<List> {
    const validation = validateCreateList(data);
    if (!validation.valid) {
      throw new ListValidationError('Invalid list data', validation.errors);
    }

    const now = new Date();
    const id = uuidv4();

    await db.insert(schema.lists).values({
      id,
      name: data.name.trim(),
      color: data.color ?? null,
      emoji: data.emoji ?? null,
      isInbox: false,
      createdAt: now,
      updatedAt: now,
    });

    const [list] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, id));

    return toList(list);
  },


  /**
   * Updates an existing list.
   * Cannot rename the Inbox list.
   * @param id - The list ID
   * @param data - The update data
   * @returns The updated list
   * @throws ListNotFoundError if list doesn't exist
   * @throws InboxProtectionError if trying to rename Inbox
   * @throws ListValidationError if validation fails
   */
  async update(id: string, data: UpdateListInput): Promise<List> {
    const validation = validateUpdateList(data);
    if (!validation.valid) {
      throw new ListValidationError('Invalid list data', validation.errors);
    }

    // Get the existing list
    const [existing] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, id));

    if (!existing) {
      throw new ListNotFoundError(id);
    }

    // Prevent renaming the Inbox
    if (existing.isInbox && data.name !== undefined && data.name !== existing.name) {
      throw new InboxProtectionError('rename');
    }

    const now = new Date();
    const updateData: Partial<typeof schema.lists.$inferInsert> = {
      updatedAt: now,
    };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.color !== undefined) {
      updateData.color = data.color;
    }
    if (data.emoji !== undefined) {
      updateData.emoji = data.emoji;
    }

    await db
      .update(schema.lists)
      .set(updateData)
      .where(eq(schema.lists.id, id));

    const [updated] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, id));

    return toList(updated);
  },

  /**
   * Deletes a list and migrates its tasks to Inbox.
   * Cannot delete the Inbox list.
   * @param id - The list ID
   * @throws ListNotFoundError if list doesn't exist
   * @throws InboxProtectionError if trying to delete Inbox
   */
  async delete(id: string): Promise<void> {
    // Get the existing list
    const [existing] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, id));

    if (!existing) {
      throw new ListNotFoundError(id);
    }

    // Prevent deleting the Inbox
    if (existing.isInbox) {
      throw new InboxProtectionError('delete');
    }

    // Get the Inbox to migrate tasks
    const inbox = await this.getInbox();

    // Migrate all tasks from this list to Inbox
    await db
      .update(schema.tasks)
      .set({ listId: inbox.id, updatedAt: new Date() })
      .where(eq(schema.tasks.listId, id));

    // Delete the list
    await db.delete(schema.lists).where(eq(schema.lists.id, id));
  },


  /**
   * Gets all lists, with Inbox first.
   * @returns All lists ordered with Inbox first, then by creation date
   */
  async getAll(): Promise<List[]> {
    // Ensure Inbox exists
    await this.ensureInboxExists();

    // Get all lists, ordering by isInbox desc (true first), then by createdAt
    const rows = await db
      .select()
      .from(schema.lists)
      .orderBy(
        // SQLite: 1 for true, 0 for false, so desc puts Inbox first
        asc(schema.lists.isInbox),
        asc(schema.lists.createdAt)
      );

    // Manual sort to ensure Inbox is always first
    const sorted = rows.sort((a, b) => {
      if (a.isInbox && !b.isInbox) return -1;
      if (!a.isInbox && b.isInbox) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return sorted.map(toList);
  },

  /**
   * Gets a list by ID.
   * @param id - The list ID
   * @returns The list or null if not found
   */
  async getById(id: string): Promise<List | null> {
    const [row] = await db
      .select()
      .from(schema.lists)
      .where(eq(schema.lists.id, id));

    return row ? toList(row) : null;
  },
};

export default listService;
