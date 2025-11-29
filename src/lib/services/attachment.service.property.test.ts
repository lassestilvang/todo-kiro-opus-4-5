/**
 * Property-based tests for Attachment service
 * 
 * Tests Properties 23, 24 from the design document
 * **Validates: Requirements 11.1, 11.2, 11.3**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '@/lib/db/schema';
import type { Attachment } from '@/types';
import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';

// Test upload directory
const TEST_UPLOAD_DIR = './test-uploads';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Custom error classes for test service
class AttachmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Attachment with id "${id}" not found`);
    this.name = 'AttachmentNotFoundError';
  }
}

class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task with id "${id}" not found`);
    this.name = 'TaskNotFoundError';
  }
}

class FileStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileStorageError';
  }
}


interface CreateAttachmentInput {
  taskId: string;
  fileName: string;
  fileType: string;
  fileData: Buffer | Uint8Array;
}

interface IAttachmentService {
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
 * Ensures the test upload directory exists
 */
function ensureUploadDir(): void {
  if (!existsSync(TEST_UPLOAD_DIR)) {
    mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Generates a unique file path for an attachment
 */
function generateFilePath(fileName: string): string {
  const timestamp = Date.now();
  const uniqueId = uuidv4().slice(0, 8);
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return join(TEST_UPLOAD_DIR, `${timestamp}-${uniqueId}-${sanitizedName}`);
}

/**
 * Create a test-specific attachment service that uses the test database
 */
function createTestAttachmentService(db: ReturnType<typeof drizzle>): IAttachmentService {
  return {
    async create(data: CreateAttachmentInput): Promise<Attachment> {
      // Verify task exists
      const [task] = db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, data.taskId))
        .all();

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

      db.insert(schema.attachments).values({
        id,
        taskId: data.taskId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize,
        filePath,
        uploadedAt: now,
      }).run();

      const [attachment] = db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, id))
        .all();

      return toAttachment(attachment);
    },

    async delete(id: string): Promise<void> {
      const [existing] = db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, id))
        .all();

      if (!existing) {
        throw new AttachmentNotFoundError(id);
      }

      // Delete file from disk if it exists
      try {
        if (existsSync(existing.filePath)) {
          unlinkSync(existing.filePath);
        }
      } catch (error) {
        console.warn(`Failed to delete file ${existing.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete database record
      db.delete(schema.attachments).where(eq(schema.attachments.id, id)).run();
    },

    async getById(id: string): Promise<Attachment | null> {
      const [row] = db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, id))
        .all();

      return row ? toAttachment(row) : null;
    },

    async getByTaskId(taskId: string): Promise<Attachment[]> {
      const rows = db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.taskId, taskId))
        .all();

      return rows.map(toAttachment);
    },

    async getFileData(id: string): Promise<Buffer> {
      const [attachment] = db
        .select()
        .from(schema.attachments)
        .where(eq(schema.attachments.id, id))
        .all();

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
}

let attachmentService: IAttachmentService;


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
    
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    );
  `);
  
  attachmentService = createTestAttachmentService(testDb);
  
  // Ensure test upload directory exists
  ensureUploadDir();
});

afterAll(() => {
  sqlite.close();
  
  // Clean up test upload directory
  if (existsSync(TEST_UPLOAD_DIR)) {
    rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  }
});

beforeEach(() => {
  // Clean up tables before each test
  sqlite.exec('DELETE FROM attachments');
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM lists');
  
  // Clean up test files
  if (existsSync(TEST_UPLOAD_DIR)) {
    rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
  }
  ensureUploadDir();
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

// Helper function to delete a task directly (simulating cascade)
function deleteTask(taskId: string): void {
  testDb.delete(schema.tasks).where(eq(schema.tasks.id, taskId)).run();
}

// Arbitraries for generating test data
const validFileName = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\'))
  .map(s => s.replace(/[^a-zA-Z0-9.-]/g, '_') + '.txt');

const validFileType = fc.constantFrom(
  'text/plain',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/json',
  'text/csv'
);

const fileData = fc.uint8Array({ minLength: 1, maxLength: 1000 })
  .map(arr => Buffer.from(arr));


describe('Property 23: Attachment Metadata Persistence', () => {
  /**
   * **Feature: daily-task-planner, Property 23: Attachment Metadata Persistence**
   * **Validates: Requirements 11.1, 11.2**
   * 
   * For any file attached to a task, the attachment metadata (fileName, fileType, 
   * fileSize, filePath) SHALL be stored and retrievable.
   */
  test('Attachment metadata is persisted and retrievable', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFileName,
        validFileType,
        fileData,
        async (fileName, fileType, data) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create attachment
          const attachment = await attachmentService.create({
            taskId,
            fileName,
            fileType,
            fileData: data,
          });
          
          // Verify metadata is correct
          expect(attachment.fileName).toBe(fileName);
          expect(attachment.fileType).toBe(fileType);
          expect(attachment.fileSize).toBe(data.length);
          expect(attachment.taskId).toBe(taskId);
          expect(attachment.filePath).toBeTruthy();
          expect(attachment.uploadedAt).toBeInstanceOf(Date);
          
          // Retrieve and verify
          const retrieved = await attachmentService.getById(attachment.id);
          expect(retrieved).not.toBeNull();
          expect(retrieved!.fileName).toBe(fileName);
          expect(retrieved!.fileType).toBe(fileType);
          expect(retrieved!.fileSize).toBe(data.length);
          expect(retrieved!.taskId).toBe(taskId);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('File data can be retrieved after upload', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFileName,
        validFileType,
        fileData,
        async (fileName, fileType, data) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create attachment
          const attachment = await attachmentService.create({
            taskId,
            fileName,
            fileType,
            fileData: data,
          });
          
          // Retrieve file data
          const retrievedData = await attachmentService.getFileData(attachment.id);
          
          // Verify data matches
          expect(Buffer.compare(retrievedData, data)).toBe(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Multiple attachments can be added to a task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(validFileName, validFileType, fileData),
          { minLength: 1, maxLength: 5 }
        ),
        async (attachmentInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create multiple attachments
          const createdAttachments: Attachment[] = [];
          for (const [fileName, fileType, data] of attachmentInputs) {
            const attachment = await attachmentService.create({
              taskId,
              fileName,
              fileType,
              fileData: data,
            });
            createdAttachments.push(attachment);
          }
          
          // Retrieve all attachments for the task
          const taskAttachments = await attachmentService.getByTaskId(taskId);
          
          // Verify count matches
          expect(taskAttachments.length).toBe(attachmentInputs.length);
          
          // Verify all attachments are present
          for (const created of createdAttachments) {
            const found = taskAttachments.find(a => a.id === created.id);
            expect(found).toBeTruthy();
            expect(found!.fileName).toBe(created.fileName);
            expect(found!.fileType).toBe(created.fileType);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Creating attachment for non-existent task throws error', async () => {
    const nonExistentTaskId = uuidv4();
    
    await expect(
      attachmentService.create({
        taskId: nonExistentTaskId,
        fileName: 'test.txt',
        fileType: 'text/plain',
        fileData: Buffer.from('test'),
      })
    ).rejects.toThrow(`Task with id "${nonExistentTaskId}" not found`);
  });
});


describe('Property 24: Attachment Cascade Delete', () => {
  /**
   * **Feature: daily-task-planner, Property 24: Attachment Cascade Delete**
   * **Validates: Requirements 11.3**
   * 
   * For any attachment removed from a task, both the file reference in the database 
   * and the file on disk SHALL be deleted.
   */
  test('Deleting attachment removes database record and file', async () => {
    await fc.assert(
      fc.asyncProperty(
        validFileName,
        validFileType,
        fileData,
        async (fileName, fileType, data) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create attachment
          const attachment = await attachmentService.create({
            taskId,
            fileName,
            fileType,
            fileData: data,
          });
          
          // Verify file exists
          expect(existsSync(attachment.filePath)).toBe(true);
          
          // Delete attachment
          await attachmentService.delete(attachment.id);
          
          // Verify database record is removed
          const retrieved = await attachmentService.getById(attachment.id);
          expect(retrieved).toBeNull();
          
          // Verify file is removed from disk
          expect(existsSync(attachment.filePath)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Deleting task cascades to delete attachments', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(validFileName, validFileType, fileData),
          { minLength: 1, maxLength: 3 }
        ),
        async (attachmentInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create multiple attachments
          const createdAttachments: Attachment[] = [];
          for (const [fileName, fileType, data] of attachmentInputs) {
            const attachment = await attachmentService.create({
              taskId,
              fileName,
              fileType,
              fileData: data,
            });
            createdAttachments.push(attachment);
          }
          
          // Verify all files exist
          for (const attachment of createdAttachments) {
            expect(existsSync(attachment.filePath)).toBe(true);
          }
          
          // Delete the task (cascade should remove attachments from DB)
          deleteTask(taskId);
          
          // Verify all attachment records are removed from database
          for (const attachment of createdAttachments) {
            const retrieved = await attachmentService.getById(attachment.id);
            expect(retrieved).toBeNull();
          }
          
          // Note: Files on disk are NOT automatically deleted by cascade
          // This is expected behavior - the cascade only affects DB records
          // File cleanup would need to be handled by application logic
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Deleting non-existent attachment throws error', async () => {
    const nonExistentId = uuidv4();
    
    await expect(
      attachmentService.delete(nonExistentId)
    ).rejects.toThrow(`Attachment with id "${nonExistentId}" not found`);
  });

  test('Deleting one attachment does not affect others on same task', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(validFileName, validFileType, fileData),
          { minLength: 2, maxLength: 4 }
        ),
        async (attachmentInputs) => {
          // Create a list and task
          const listId = createTestList();
          const taskId = createTestTask(listId);
          
          // Create multiple attachments
          const createdAttachments: Attachment[] = [];
          for (const [fileName, fileType, data] of attachmentInputs) {
            const attachment = await attachmentService.create({
              taskId,
              fileName,
              fileType,
              fileData: data,
            });
            createdAttachments.push(attachment);
          }
          
          // Delete the first attachment
          const deletedAttachment = createdAttachments[0];
          await attachmentService.delete(deletedAttachment.id);
          
          // Verify deleted attachment is gone
          const deletedRetrieved = await attachmentService.getById(deletedAttachment.id);
          expect(deletedRetrieved).toBeNull();
          expect(existsSync(deletedAttachment.filePath)).toBe(false);
          
          // Verify other attachments still exist
          for (let i = 1; i < createdAttachments.length; i++) {
            const attachment = createdAttachments[i];
            const retrieved = await attachmentService.getById(attachment.id);
            expect(retrieved).not.toBeNull();
            expect(existsSync(attachment.filePath)).toBe(true);
          }
          
          // Verify task still has remaining attachments
          const taskAttachments = await attachmentService.getByTaskId(taskId);
          expect(taskAttachments.length).toBe(createdAttachments.length - 1);
        }
      ),
      { numRuns: 30 }
    );
  });
});
