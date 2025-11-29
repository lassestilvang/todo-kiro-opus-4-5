// Core type definitions for Daily Task Planner

// Priority levels for tasks
export type Priority = 'high' | 'medium' | 'low' | 'none';

// Recurrence pattern types
export type RecurrenceType = 
  | 'daily' 
  | 'weekly' 
  | 'weekday' 
  | 'monthly' 
  | 'yearly' 
  | 'custom';

// Recurrence pattern configuration
export interface RecurrencePattern {
  type: RecurrenceType;
  interval?: number;           // Every N days/weeks/months
  weekdays?: number[];         // 0-6 for Sun-Sat
  monthDay?: number;           // Day of month (1-31)
  ordinal?: number;            // 1st, 2nd, 3rd, etc.
  ordinalWeekday?: number;     // Weekday for ordinal (e.g., 3rd Monday)
}

// Reminder notification methods
export type ReminderMethod = 'push' | 'email' | 'in-app';

// Reminder entity
export interface Reminder {
  id: string;
  taskId: string;
  offsetMinutes: number;       // Minutes before deadline
  method: ReminderMethod;
  sent: boolean;
}

// File attachment entity
export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedAt: Date;
}

// Label entity for task categorization
export interface Label {
  id: string;
  name: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}


// List entity for task organization
export interface List {
  id: string;
  name: string;
  color?: string;
  emoji?: string;
  isInbox: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Subtask entity (child of Task)
export interface Subtask {
  id: string;
  taskId: string;
  name: string;
  completed: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Main Task entity
export interface Task {
  id: string;
  name: string;
  description?: string;
  listId: string;
  date?: Date;
  deadline?: Date;
  estimate?: number;           // Minutes
  actualTime?: number;         // Minutes
  priority: Priority;
  completed: boolean;
  completedAt?: Date;
  recurrence?: RecurrencePattern;
  parentTaskId?: string;       // For recurring task instances
  createdAt: Date;
  updatedAt: Date;
  
  // Relations (populated on fetch)
  list?: List;
  labels?: Label[];
  subtasks?: Subtask[];
  attachments?: Attachment[];
  reminders?: Reminder[];
}

// Task history entry for audit trail
export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  field: string;
  previousValue?: string;
  newValue?: string;
  changedAt: Date;
}

// Parsed result from natural language input
export interface ParsedTaskInput {
  name: string;
  date?: Date;
  time?: string;
  priority?: Priority;
  listName?: string;
  labels?: string[];
}

// Smart scheduling suggestion
export interface ScheduleSuggestion {
  startTime: Date;
  endTime: Date;
  score: number;               // Suitability score 0-100
  reason: string;
}

// Grouped tasks by date for views
export interface GroupedTasks {
  date: Date;
  dateKey: string;             // ISO date string (YYYY-MM-DD) for grouping
  tasks: Task[];
}

// Input types for creating entities
export interface CreateTaskInput {
  name: string;
  description?: string;
  listId?: string;
  date?: Date;
  deadline?: Date;
  estimate?: number;
  actualTime?: number;
  priority?: Priority;
  recurrence?: RecurrencePattern;
  labelIds?: string[];
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  listId?: string;
  date?: Date | null;
  deadline?: Date | null;
  estimate?: number | null;
  actualTime?: number | null;
  priority?: Priority;
  completed?: boolean;
  recurrence?: RecurrencePattern | null;
  labelIds?: string[];
}

export interface CreateListInput {
  name: string;
  color?: string;
  emoji?: string;
}

export interface UpdateListInput {
  name?: string;
  color?: string;
  emoji?: string;
}

export interface CreateLabelInput {
  name: string;
  icon?: string;
}

export interface UpdateLabelInput {
  name?: string;
  icon?: string;
}

export interface CreateSubtaskInput {
  name: string;
  order?: number;
}

export interface CreateReminderInput {
  offsetMinutes: number;
  method: ReminderMethod;
}


// Service interfaces

export interface ITaskService {
  create(data: CreateTaskInput): Promise<Task>;
  update(id: string, data: UpdateTaskInput): Promise<Task>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Task | null>;
  getByListId(listId: string, includeCompleted?: boolean): Promise<Task[]>;
  getByDateRange(start: Date, end: Date, includeCompleted?: boolean): Promise<Task[]>;
  getToday(includeCompleted?: boolean): Promise<Task[]>;
  getNext7Days(includeCompleted?: boolean): Promise<Task[]>;
  getNext7DaysGrouped(includeCompleted?: boolean): Promise<GroupedTasks[]>;
  getUpcoming(includeCompleted?: boolean): Promise<Task[]>;
  getUpcomingGrouped(includeCompleted?: boolean): Promise<GroupedTasks[]>;
  getOverdue(): Promise<Task[]>;
  getOverdueCount(): Promise<number>;
  getAll(includeCompleted?: boolean): Promise<Task[]>;
  toggleComplete(id: string): Promise<Task>;
  addSubtask(taskId: string, name: string): Promise<Subtask>;
  toggleSubtask(subtaskId: string): Promise<Subtask>;
  deleteSubtask(subtaskId: string): Promise<void>;
  getHistory(taskId: string): Promise<TaskHistoryEntry[]>;
}

export interface IListService {
  create(data: CreateListInput): Promise<List>;
  update(id: string, data: UpdateListInput): Promise<List>;
  delete(id: string): Promise<void>;
  getAll(): Promise<List[]>;
  getById(id: string): Promise<List | null>;
  getInbox(): Promise<List>;
  ensureInboxExists(): Promise<List>;
}

export interface ILabelService {
  create(data: CreateLabelInput): Promise<Label>;
  update(id: string, data: UpdateLabelInput): Promise<Label>;
  delete(id: string): Promise<void>;
  getAll(): Promise<Label[]>;
  getById(id: string): Promise<Label | null>;
  addToTask(taskId: string, labelId: string): Promise<void>;
  removeFromTask(taskId: string, labelId: string): Promise<void>;
}

export interface ISearchService {
  search(query: string): Promise<Task[]>;
}

export interface INLPParserService {
  parse(input: string): ParsedTaskInput;
}

export interface ISchedulerService {
  suggestTimeSlots(task: Task, count?: number): Promise<ScheduleSuggestion[]>;
}

export interface IReminderService {
  scheduleReminder(taskId: string, reminder: CreateReminderInput): Promise<Reminder>;
  cancelReminder(reminderId: string): Promise<void>;
  getByTaskId(taskId: string): Promise<Reminder[]>;
}

// Error response format
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}
