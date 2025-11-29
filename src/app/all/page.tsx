'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListTodo } from 'lucide-react';
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
 * Fetches all tasks from the API
 */
async function fetchAllTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks?includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
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
 * All Tasks Page Component
 * Displays all tasks including scheduled and unscheduled.
 * Distinguishes between scheduled and unscheduled tasks.
 * 
 * Requirements: 15.1, 15.2, 15.3
 */
export default function AllPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  // Fetch all tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', 'all', showCompleted],
    queryFn: () => fetchAllTasks(showCompleted),
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

  // Separate scheduled and unscheduled tasks
  const scheduledTasks = tasks.filter(task => task.date);
  const unscheduledTasks = tasks.filter(task => !task.date);

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
    queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
  };

  if (error) {
    return (
      <AppLayout title="All Tasks">
        <QueryErrorFallback 
          message="Failed to load tasks. Please try again."
          onRetry={handleRetry}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="All Tasks">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListTodo className="h-6 w-6" />
              All Tasks
            </h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <TaskListSkeleton count={5} />
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No tasks yet. Create your first task!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Scheduled Tasks Section */}
            {scheduledTasks.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Scheduled ({scheduledTasks.length})
                </h2>
                <TaskList
                  tasks={scheduledTasks}
                  onTaskClick={handleTaskClick}
                  onToggleComplete={handleToggleComplete}
                  showCompleted={showCompleted}
                  onToggleShowCompleted={handleToggleShowCompleted}
                  groupByDate={true}
                  emptyMessage="No scheduled tasks."
                />
              </div>
            )}

            {/* Unscheduled Tasks Section */}
            {unscheduledTasks.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-muted-foreground">
                  Unscheduled ({unscheduledTasks.length})
                </h2>
                <TaskList
                  tasks={unscheduledTasks}
                  onTaskClick={handleTaskClick}
                  onToggleComplete={handleToggleComplete}
                  showCompleted={showCompleted}
                  onToggleShowCompleted={scheduledTasks.length === 0 ? handleToggleShowCompleted : undefined}
                  emptyMessage="No unscheduled tasks."
                />
              </div>
            )}
          </div>
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
