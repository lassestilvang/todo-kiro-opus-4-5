'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, CalendarRange, Sparkles, TrendingUp } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Task, List, Label, TaskHistoryEntry, CreateTaskInput, UpdateTaskInput } from '@/types';

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

async function fetchUpcomingTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks/upcoming?includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch upcoming tasks');
  const data = await res.json();
  return data.map(parseTaskDates);
}

async function fetchLists(): Promise<List[]> {
  const res = await fetch('/api/lists');
  if (!res.ok) throw new Error('Failed to fetch lists');
  return res.json();
}

async function fetchLabels(): Promise<Label[]> {
  const res = await fetch('/api/labels');
  if (!res.ok) throw new Error('Failed to fetch labels');
  return res.json();
}

async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const res = await fetch(`/api/tasks/${taskId}/history`);
  if (!res.ok) throw new Error('Failed to fetch task history');
  const data = await res.json();
  return data.map((entry: TaskHistoryEntry) => ({
    ...entry,
    changedAt: new Date(entry.changedAt),
  }));
}

async function toggleTaskComplete(taskId: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toggleComplete: true }),
  });
  if (!res.ok) throw new Error('Failed to toggle task');
  return res.json();
}

async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

async function updateTask({ id, data }: { id: string; data: UpdateTaskInput }): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete task');
}

export default function UpcomingPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', 'upcoming', showCompleted],
    queryFn: () => fetchUpcomingTasks(showCompleted),
  });

  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: fetchLists,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: fetchLabels,
  });

  const { data: taskHistory = [] } = useQuery({
    queryKey: ['taskHistory', selectedTask?.id],
    queryFn: () => selectedTask ? fetchTaskHistory(selectedTask.id) : Promise.resolve([]),
    enabled: !!selectedTask,
  });

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
    queryClient.invalidateQueries({ queryKey: ['tasks', 'upcoming'] });
  };

  if (error) {
    return (
      <AppLayout title="Upcoming">
        <QueryErrorFallback 
          message="Failed to load upcoming tasks. Please try again."
          onRetry={handleRetry}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Upcoming">
      <div className="space-y-8">
        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl glass-card p-6 sm:p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl sm:text-4xl font-bold gradient-text flex items-center gap-3"
              >
                <CalendarRange className="h-8 w-8 sm:h-10 sm:w-10" />
                Upcoming
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-muted-foreground"
              >
                All future scheduled tasks
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 pt-2"
              >
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold tabular-nums">{tasks.length}</span>
                <span className="text-muted-foreground">tasks ahead</span>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
            >
              <Button 
                onClick={() => setIsFormOpen(true)} 
                size="lg"
                className={cn(
                  'btn-primary-glow h-12 px-6 rounded-xl',
                  'bg-gradient-to-r from-primary to-accent',
                  'text-white font-semibold',
                  'shadow-lg shadow-primary/25'
                )}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Task
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Task List */}
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
            emptyMessage="No upcoming tasks scheduled."
          />
        )}
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border/50">
          <DialogHeader className="sr-only">
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Task
            </DialogTitle>
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
