'use client';

import { useQuery } from '@tanstack/react-query';
import type { Task } from '@/types';

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

// ============================================================================
// API Functions
// ============================================================================

async function searchTasks(query: string): Promise<Task[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

// ============================================================================
// Query Keys
// ============================================================================

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to search tasks using fuzzy matching
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */
export function useSearch(query: string) {
  return useQuery({
    queryKey: searchKeys.query(query),
    queryFn: () => searchTasks(query),
    enabled: query.trim().length > 0,
  });
}
