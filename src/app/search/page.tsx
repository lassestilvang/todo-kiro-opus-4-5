'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList, TaskDetail } from '@/components/tasks';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Task, List, Label, TaskHistoryEntry, CreateTaskInput, UpdateTaskInput } from '@/types';

/**
 * Parses dates from JSON response
 */
function parseTaskDates(task: Task): Task {
  return {
    ...task,
    date: task.date ? new Date(task.date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    subtasks: task.subtasks?.map(s => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    })),
    labels: task.labels?.map(l => ({
      ...l,
      createdAt: new Date(l.createdAt),
      updatedAt: new Date(l.updatedAt),
    })),
  };
}

/**
 * Searches tasks using the search API
 */
async function searchTasks(query: string): Promise<Task[]> {
  if (!query.trim()) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

/**
 * Fetches all lists
 */
async function fetchLists(): Promise<List[]> {
  const res = await fetch('/api/lists');
  if (!res.ok) throw new Error('Failed to fetch lists');
  return res.json();
}

/**
 * Fetches all labels
 */
async function fetchLabels(): Promise<Label[]> {
  const res = await fetch('/api/labels');
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

/**
 * Fetches task history
 */
async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const res = await fetch(`/api/tasks/${taskId}/history`);
  if (!res.ok) throw new Error('Failed to fetch task history');
  const data = await res.json();
  return data.map((entry: TaskHistoryEntry) => ({
    ...entry,
    changedAt: new Date(entry.changedAt),
  }));
}

/**
 * Toggles task completion status
 */
async function toggleTaskComplete(taskId: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: undefined }),
  });
  if (!res.ok) throw new Error('Failed to toggle task');
  return res.json();
}

/**
 * Updates an existing task
 */
async function updateTask({ id, data }: { id: string; data: UpdateTaskInput }): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

/**
 * Deletes a task
 */
async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

/**
 * Search Results Page Component
 * Displays search results ranked by relevance.
 * 
 * Requirements: 17.2
 */
export default function SearchPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const query = searchParams.get('q') ?? '';

  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  // Search tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTasks(query),
    enabled: query.length > 0,
  });

  // Fetch lists and labels for forms
  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: fetchLists,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });

  // Fetch history for selected task
  const { data: taskHistory = [] } = useQuery({
    queryKey: ['taskHistory', selectedTask?.id],
    queryFn: () => selectedTask ? fetchTaskHistory(selectedTask.id) : Promise.resolve([]),
    enabled: !!selectedTask,
  });

  // Toggle complete mutation
  const toggleCompleteMutation = useMutation({
    mutationFn: toggleTaskComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      setSelectedTask(null);
      toast.success('Task updated');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
      setSelectedTask(null);
      toast.success('Task deleted');
    },
    onError: () => {
      toast.error('Failed to delete task');
    },
  });

  const handleToggleComplete = (taskId: string): void => {
    toggleCompleteMutation.mutate(taskId);
  };

  const handleTaskClick = (task: Task): void => {
    setSelectedTask(task);
  };

  const handleUpdateTask = (data: CreateTaskInput | UpdateTaskInput): void => {
    if (selectedTask) {
      updateTaskMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput });
    }
  };

  const handleDeleteTask = (): void => {
    if (selectedTask) {
      deleteTaskMutation.mutate(selectedTask.id);
    }
  };

  const handleToggleSelectedTaskComplete = (): void => {
    if (selectedTask) {
      toggleCompleteMutation.mutate(selectedTask.id);
    }
  };

  if (error) {
    return (
      <AppLayout title="Search">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">Search failed. Please try again.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Search">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6" />
            Search Results
          </h1>
          {query && (
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Searching...' : `${tasks.length} result${tasks.length !== 1 ? 's' : ''} for "${query}"`}
            </p>
          )}
        </div>

        {/* Results */}
        {!query ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Enter a search term to find tasks.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-lg border bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No tasks found matching &quot;{query}&quot;.</p>
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onToggleComplete={handleToggleComplete}
            showCompleted={true}
            emptyMessage="No results found."
          />
        )}
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              lists={lists}
              labels={labels}
              history={taskHistory}
              onUpdate={handleUpdateTask}
              onDelete={handleDeleteTask}
              onToggleComplete={handleToggleSelectedTaskComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
