import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Attachment } from '@/types';
import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// Upload directory for attachments
const UPLOAD_DIR = './public/uploads';

// Custom error classes for Attachment service
export class AttachmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Attachment with id "${id}" not found`);
    this.name = 'AttachmentNotFoundError';
  }
}

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

export class FileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileStorageError';
  }
}

/**
 * Input for creating an attachment
 */
export interface CreateAttachmentInput {
  taskId: string;
  fileName: string;
  fileType: string;
  fileData: Buffer | Uint8Array;
}

/**
 * Attachment service interface
 */
export interface IAttachmentService {
  create(data: CreateAttachmentInput): Promise<Attachment>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Attachment | null>;
  getByTaskId(taskId: string): Promise<Attachment[]>;
  getFileData(id: string): Promise<Buffer>;
}


/**
 * Converts a database row to an Attachment entity
 */
function toAttachment(row: typeof schema.attachments.$inferSelect): Attachment {
  return {
    id: row.id,
    taskId: row.taskId,
    fileName: row.fileName,
    fileType: row.fileType,
    fileSize: row.fileSize,
    filePath: row.filePath,
    uploadedAt: row.uploadedAt,
  };
}

/**
 * Ensures the upload directory exists
 */
function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Generates a unique file path for an attachment
 */
function generateFilePath(fileName: string): string {
  const timestamp = Date.now();
  const uniqueId = uuidv4().slice(0, 8);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return join(UPLOAD_DIR, `${timestamp}-${uniqueId}-${sanitizedName}`);
}

/**
 * Attachment Service Implementation
 * Handles file attachment operations including upload, download, and deletion
 */
export const attachmentService: IAttachmentService = {

  /**
   * Creates a new attachment by storing the file and metadata.
   * @param data - The attachment creation data including file buffer
   * @returns The created attachment metadata
   * @throws TaskNotFoundError if task doesn't exist
   * @throws FileStorageError if file storage fails
   */
  async create(data: CreateAttachmentInput): Promise<Attachment> {
    // Verify task exists
    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, data.taskId));

    if (!task) {
      throw new TaskNotFoundError(data.taskId);
    }

    // Ensure upload directory exists
    ensureUploadDir();

    // Generate unique file path
    const filePath = generateFilePath(data.fileName);
    const fileSize = data.fileData.length;

    // Write file to disk
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, data.fileData);
    } catch (error) {
      throw new FileStorageError(`Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Store metadata in database
    const now = new Date();
    const id = uuidv4();

    await db.insert(schema.attachments).values({
      id,
      taskId: data.taskId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize,
      filePath,
      uploadedAt: now,
    });

    const [attachment] = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, id));

    return toAttachment(attachment);
  },

  /**
   * Deletes an attachment by removing both the file and database record.
   * @param id - The attachment ID
   * @throws AttachmentNotFoundError if attachment doesn't exist
   */
  async delete(id: string): Promise<void> {
    // Get the existing attachment
    const [existing] = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, id));

    if (!existing) {
      throw new AttachmentNotFoundError(id);
    }

    // Delete file from disk if it exists
    try {
      if (existsSync(existing.filePath)) {
        unlinkSync(existing.filePath);
      }
    } catch (error) {
      // Log but don't fail if file deletion fails
      console.warn(`Failed to delete file ${existing.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Delete database record
    await db.delete(schema.attachments).where(eq(schema.attachments.id, id));
  },

  /**
   * Gets an attachment by ID.
   * @param id - The attachment ID
   * @returns The attachment or null if not found
   */
  async getById(id: string): Promise<Attachment | null> {
    const [row] = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, id));

    return row ? toAttachment(row) : null;
  },

  /**
   * Gets all attachments for a task.
   * @param taskId - The task ID
   * @returns Array of attachments
   */
  async getByTaskId(taskId: string): Promise<Attachment[]> {
    const rows = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.taskId, taskId));

    return rows.map(toAttachment);
  },

  /**
   * Gets the file data for an attachment.
   * @param id - The attachment ID
   * @returns The file data as a Buffer
   * @throws AttachmentNotFoundError if attachment doesn't exist
   * @throws FileStorageError if file cannot be read
   */
  async getFileData(id: string): Promise<Buffer> {
    const [attachment] = await db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, id));

    if (!attachment) {
      throw new AttachmentNotFoundError(id);
    }

    try {
      if (!existsSync(attachment.filePath)) {
        throw new FileStorageError(`File not found at path: ${attachment.filePath}`);
      }
      return readFileSync(attachment.filePath);
    } catch (error) {
      if (error instanceof FileStorageError) {
        throw error;
      }
      throw new FileStorageError(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

export default attachmentService;
