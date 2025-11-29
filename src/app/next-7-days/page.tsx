'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { Plus, Calendar } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList, TaskDetail, TaskForm } from '@/components/tasks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { showSuccess, showError } from '@/lib/utils/toast';
import { TaskListSkeleton, QueryErrorFallback } from '@/components/common';
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
 * Fetches next 7 days tasks from the API
 */
async function fetchNext7DaysTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks/next7days?includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch next 7 days tasks');
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
 * Creates a new task
 */
async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
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
 * Next 7 Days Page Component
 * Displays tasks for the upcoming week grouped by date.
 * 
 * Requirements: 13.1, 13.2, 13.3
 */
export default function Next7DaysPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const today = new Date();
  const endDate = addDays(today, 7);
  const dateRange = `${format(today, 'MMM d')} - ${format(endDate, 'MMM d')}`;

  // Fetch next 7 days tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', 'next7days', showCompleted],
    queryFn: () => fetchNext7DaysTasks(showCompleted),
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
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
    },
    onError: () => {
      showError('Failed to update task');
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsFormOpen(false);
      showSuccess('Task created');
    },
    onError: () => {
      showError('Failed to create task');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
      showSuccess('Task updated');
    },
    onError: () => {
      showError('Failed to update task');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
      setSelectedTask(null);
      showSuccess('Task deleted');
    },
    onError: () => {
      showError('Failed to delete task');
    },
  });

  const handleToggleComplete = (taskId: string): void => {
    toggleCompleteMutation.mutate(taskId);
  };

  const handleTaskClick = (task: Task): void => {
    setSelectedTask(task);
  };

  const handleToggleShowCompleted = (): void => {
    setShowCompleted(!showCompleted);
  };

  const handleCreateTask = (data: CreateTaskInput | UpdateTaskInput): void => {
    createTaskMutation.mutate(data as CreateTaskInput);
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

  const handleRetry = (): void => {
    queryClient.invalidateQueries({ queryKey: ['tasks', 'next7days'] });
  };

  if (error) {
    return (
      <AppLayout title="Next 7 Days">
        <QueryErrorFallback 
          message="Failed to load tasks for the next 7 days. Please try again."
          onRetry={handleRetry}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Next 7 Days">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              <span className="truncate">Next 7 Days</span>
            </h1>
            <p className="text-sm text-muted-foreground">{dateRange}</p>
          </div>
          <Button 
            onClick={() => setIsFormOpen(true)} 
            size="sm"
            className="h-10 px-4 sm:h-8 sm:px-3 shrink-0"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Task</span>
          </Button>
        </div>

        {/* Task List - grouped by date */}
        {isLoading ? (
          <TaskListSkeleton count={5} />
        ) : (
          <TaskList
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onToggleComplete={handleToggleComplete}
            showCompleted={showCompleted}
            onToggleShowCompleted={handleToggleShowCompleted}
            groupByDate={true}
            emptyMessage="No tasks scheduled for the next 7 days."
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

      {/* Create Task Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            lists={lists}
            labels={labels}
            onSubmit={handleCreateTask}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
