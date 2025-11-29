'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { List, CreateListInput, UpdateListInput } from '@/types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses dates from JSON response for a list
 */
function parseListDates(list: List): List {
  return {
    ...list,
    createdAt: new Date(list.createdAt),
    updatedAt: new Date(list.updatedAt),
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchLists(): Promise<List[]> {
  const res = await fetch('/api/lists');
  if (!res.ok) throw new Error('Failed to fetch lists');
  const data = await res.json();
  return data.map(parseListDates);
}

async function fetchList(id: string): Promise<List> {
  const res = await fetch(`/api/lists/${id}`);
  if (!res.ok) throw new Error('Failed to fetch list');
  const data = await res.json();
  return parseListDates(data);
}

async function createList(data: CreateListInput): Promise<List> {
  const res = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create list');
  }
  return res.json();
}

async function updateList({
  id,
  data,
}: {
  id: string;
  data: UpdateListInput;
}): Promise<List> {
  const res = await fetch(`/api/lists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to update list');
  }
  return res.json();
}

async function deleteList(id: string): Promise<void> {
  const res = await fetch(`/api/lists/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to delete list');
  }
}

// ============================================================================
// Query Keys
// ============================================================================

export const listKeys = {
  all: ['lists'] as const,
  details: () => [...listKeys.all, 'detail'] as const,
  detail: (id: string) => [...listKeys.details(), id] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all lists (Inbox first)
 * Requirements: 1.3, 18.1
 */
export function useLists() {
  return useQuery({
    queryKey: listKeys.all,
    queryFn: fetchLists,
  });
}

/**
 * Hook to fetch a single list by ID
 */
export function useList(id: string | undefined) {
  return useQuery({
    queryKey: listKeys.detail(id ?? ''),
    queryFn: () => fetchList(id!),
    enabled: !!id,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook providing all list mutations
 * Requirements: 2.1, 2.2, 2.3, 25.2, 25.3
 */
export function useListMutations() {
  const queryClient = useQueryClient();

  const invalidateListQueries = (): void => {
    queryClient.invalidateQueries({ queryKey: listKeys.all });
    // Also invalidate tasks since list deletion migrates tasks
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const create = useMutation({
    mutationFn: createList,
    onSuccess: invalidateListQueries,
  });

  const update = useMutation({
    mutationFn: updateList,
    onSuccess: invalidateListQueries,
  });

  const remove = useMutation({
    mutationFn: deleteList,
    onSuccess: invalidateListQueries,
  });

  return {
    create,
    update,
    remove,
  };
}
