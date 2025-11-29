'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Label, CreateLabelInput, UpdateLabelInput } from '@/types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses dates from JSON response for a label
 */
function parseLabelDates(label: Label): Label {
  return {
    ...label,
    createdAt: new Date(label.createdAt),
    updatedAt: new Date(label.updatedAt),
  };
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchLabels(): Promise<Label[]> {
  const res = await fetch('/api/labels');
  if (!res.ok) throw new Error('Failed to fetch labels');
  const data = await res.json();
  return data.map(parseLabelDates);
}

async function fetchLabel(id: string): Promise<Label> {
  const res = await fetch(`/api/labels/${id}`);
  if (!res.ok) throw new Error('Failed to fetch label');
  const data = await res.json();
  return parseLabelDates(data);
}

async function createLabel(data: CreateLabelInput): Promise<Label> {
  const res = await fetch('/api/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create label');
  }
  return res.json();
}

async function updateLabel({
  id,
  data,
}: {
  id: string;
  data: UpdateLabelInput;
}): Promise<Label> {
  const res = await fetch(`/api/labels/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to update label');
  }
  return res.json();
}

async function deleteLabel(id: string): Promise<void> {
  const res = await fetch(`/api/labels/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to delete label');
  }
}

// ============================================================================
// Query Keys
// ============================================================================

export const labelKeys = {
  all: ['labels'] as const,
  details: () => [...labelKeys.all, 'detail'] as const,
  detail: (id: string) => [...labelKeys.details(), id] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all labels
 * Requirements: 8.1, 8.3
 */
export function useLabels() {
  return useQuery({
    queryKey: labelKeys.all,
    queryFn: fetchLabels,
  });
}

/**
 * Hook to fetch a single label by ID
 */
export function useLabel(id: string | undefined) {
  return useQuery({
    queryKey: labelKeys.detail(id ?? ''),
    queryFn: () => fetchLabel(id!),
    enabled: !!id,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook providing all label mutations
 * Requirements: 8.1, 8.4, 25.2, 25.3
 */
export function useLabelMutations() {
  const queryClient = useQueryClient();

  const invalidateLabelQueries = (): void => {
    queryClient.invalidateQueries({ queryKey: labelKeys.all });
    // Also invalidate tasks since label deletion removes from tasks
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const create = useMutation({
    mutationFn: createLabel,
    onSuccess: invalidateLabelQueries,
  });

  const update = useMutation({
    mutationFn: updateLabel,
    onSuccess: invalidateLabelQueries,
  });

  const remove = useMutation({
    mutationFn: deleteLabel,
    onSuccess: invalidateLabelQueries,
  });

  return {
    create,
    update,
    remove,
  };
}
