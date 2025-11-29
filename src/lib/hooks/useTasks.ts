'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Task,
  TaskHistoryEntry,
  CreateTaskInput,
  UpdateTaskInput,
  GroupedTasks,
  Subtask,
  CreateSubtaskInput,
} from '@/types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses dates from JSON response for a task
 */
function parseTaskDates(task: Task): Task {
  return {
    ...task,
    date: task.date ? new Date(task.date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    subtasks: task.subtasks?.map((s) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    })),
    labels: task.labels?.map((l) => ({
      ...l,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
    })),
  };
}

/**
 * Parses dates for grouped tasks
 */
function parseGroupedTasksDates(groups: GroupedTasks[]): GroupedTasks[] {
  return groups.map((group) => ({
    ...group,
    date: new Date(group.date),
    tasks: group.tasks.map(parseTaskDates),
  }));
}

/**
 * Parses dates for task history entries
 */
function parseHistoryDates(entry: TaskHistoryEntry): TaskHistoryEntry {
  return {
    ...entry,
    changedAt: new Date(entry.changedAt),
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks?includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`);
  if (!res.ok) throw new Error('Failed to fetch task');
  const data = await res.json();
  return parseTaskDates(data);
}


async function fetchTasksByList(
  listId: string,
  includeCompleted: boolean
): Promise<Task[]> {
  const res = await fetch(
    `/api/tasks?listId=${listId}&includeCompleted=${includeCompleted}`
  );
  if (!res.ok) throw new Error('Failed to fetch tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

async function fetchTodayTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(
    `/api/tasks/today?includeCompleted=${includeCompleted}`
  );
  if (!res.ok) throw new Error("Failed to fetch today's tasks");
  const data = await res.json();
  return data.map(parseTaskDates);
}

async function fetchNext7DaysTasks(
  includeCompleted: boolean
): Promise<GroupedTasks[]> {
  const res = await fetch(
    `/api/tasks/next7days?includeCompleted=${includeCompleted}`
  );
  if (!res.ok) throw new Error('Failed to fetch next 7 days tasks');
  const data = await res.json();
  return parseGroupedTasksDates(data);
}

async function fetchUpcomingTasks(
  includeCompleted: boolean
): Promise<GroupedTasks[]> {
  const res = await fetch(
    `/api/tasks/upcoming?includeCompleted=${includeCompleted}`
  );
  if (!res.ok) throw new Error('Failed to fetch upcoming tasks');
  const data = await res.json();
  return parseGroupedTasksDates(data);
}

async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const res = await fetch(`/api/tasks/${taskId}/history`);
  if (!res.ok) throw new Error('Failed to fetch task history');
  const data = await res.json();
  return data.map(parseHistoryDates);
}

async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create task');
  }
  return res.json();
}

async function updateTask({
  id,
  data,
}: {
  id: string;
  data: UpdateTaskInput;
}): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to update task');
  }
  return res.json();
}

async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to delete task');
  }
}

async function toggleTaskComplete(id: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggleComplete: true }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to toggle task');
  }
  return res.json();
}

async function createSubtask({
  taskId,
  data,
}: {
  taskId: string;
  data: CreateSubtaskInput;
}): Promise<Subtask> {
  const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create subtask');
  }
  return res.json();
}


// ============================================================================
// Query Keys
// ============================================================================

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (listId: string, includeCompleted: boolean) =>
    [...taskKeys.lists(), listId, { includeCompleted }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  today: (includeCompleted: boolean) =>
    [...taskKeys.all, 'today', { includeCompleted }] as const,
  next7Days: (includeCompleted: boolean) =>
    [...taskKeys.all, 'next7days', { includeCompleted }] as const,
  upcoming: (includeCompleted: boolean) =>
    [...taskKeys.all, 'upcoming', { includeCompleted }] as const,
  history: (taskId: string) => [...taskKeys.all, 'history', taskId] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all tasks
 * Requirements: 15.1, 15.2
 */
export function useTasks(includeCompleted = true) {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: () => fetchTasks(includeCompleted),
  });
}

/**
 * Hook to fetch a single task by ID
 */
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch tasks by list ID
 */
export function useTasksByList(listId: string, includeCompleted = true) {
  return useQuery({
    queryKey: taskKeys.list(listId, includeCompleted),
    queryFn: () => fetchTasksByList(listId, includeCompleted),
    enabled: !!listId,
  });
}

/**
 * Hook to fetch today's tasks
 * Requirements: 12.1, 12.2
 */
export function useTodayTasks(includeCompleted = true) {
  return useQuery({
    queryKey: taskKeys.today(includeCompleted),
    queryFn: () => fetchTodayTasks(includeCompleted),
  });
}

/**
 * Hook to fetch next 7 days tasks grouped by date
 * Requirements: 13.1, 13.2, 13.3
 */
export function useNext7DaysTasks(includeCompleted = true) {
  return useQuery({
    queryKey: taskKeys.next7Days(includeCompleted),
    queryFn: () => fetchNext7DaysTasks(includeCompleted),
  });
}

/**
 * Hook to fetch upcoming tasks grouped by date
 * Requirements: 14.1, 14.2, 14.3
 */
export function useUpcomingTasks(includeCompleted = true) {
  return useQuery({
    queryKey: taskKeys.upcoming(includeCompleted),
    queryFn: () => fetchUpcomingTasks(includeCompleted),
  });
}

/**
 * Hook to fetch task history
 * Requirements: 5.1, 5.2, 5.3
 */
export function useTaskHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.history(taskId ?? ''),
    queryFn: () => fetchTaskHistory(taskId!),
    enabled: !!taskId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook providing all task mutations
 * Requirements: 3.1, 3.2, 4.1, 22.1, 22.2, 25.2, 25.3
 */
export function useTaskMutations() {
  const queryClient = useQueryClient();

  const invalidateTaskQueries = (): void => {
    queryClient.invalidateQueries({ queryKey: taskKeys.all });
    queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
  };

  const create = useMutation({
    mutationFn: createTask,
    onSuccess: invalidateTaskQueries,
  });

  const update = useMutation({
    mutationFn: updateTask,
    onSuccess: invalidateTaskQueries,
  });

  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: invalidateTaskQueries,
  });

  const toggleComplete = useMutation({
    mutationFn: toggleTaskComplete,
    onSuccess: invalidateTaskQueries,
  });

  const addSubtask = useMutation({
    mutationFn: createSubtask,
    onSuccess: invalidateTaskQueries,
  });

  return {
    create,
    update,
    remove,
    toggleComplete,
    addSubtask,
  };
}
