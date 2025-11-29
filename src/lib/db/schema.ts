import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Lists table
export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  emoji: text('emoji'),
  isInbox: integer('is_inbox', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Labels table
export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tasks table
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  listId: text('list_id').notNull().references(() => lists.id),
  date: integer('date', { mode: 'timestamp' }),
  deadline: integer('deadline', { mode: 'timestamp' }),
  estimate: integer('estimate'),
  actualTime: integer('actual_time'),
  priority: text('priority').notNull().default('none'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  recurrence: text('recurrence', { mode: 'json' }),
  parentTaskId: text('parent_task_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Subtasks table
export const subtasks = sqliteTable('subtasks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});


// Task-Label junction table
export const taskLabels = sqliteTable('task_labels', {
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  labelId: text('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
});

// Attachments table
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  filePath: text('file_path').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
});

// Reminders table
export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  offsetMinutes: integer('offset_minutes').notNull(),
  method: text('method').notNull(),
  sent: integer('sent', { mode: 'boolean' }).notNull().default(false),
});

// Task history table
export const taskHistory = sqliteTable('task_history', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  field: text('field').notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
});
