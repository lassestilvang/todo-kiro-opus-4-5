'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Plus, CalendarDays, Sparkles, Sun, CloudSun, Moon, Zap, Target, Clock, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList, TaskDetail, TaskForm } from '@/components/tasks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/lib/utils/toast';
import { TaskListSkeleton, QueryErrorFallback } from '@/components/common';
import type { Task, List, Label, TaskHistoryEntry, CreateTaskInput, UpdateTaskInput } from '@/types';
import { cn } from '@/lib/utils';

function parseTaskDates(task: Task): Task {
  return {
    ...task,
    date: task.date ? new Date(task.date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    subtasks: task.subtasks?.map(s => ({ ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) })),
    labels: task.labels?.map(l => ({ ...l, createdAt: new Date(l.createdAt), updatedAt: new Date(l.updatedAt) })),
  };
}

async function fetchTodayTasks(includeCompleted: boolean): Promise<Task[]> {
  const res = await fetch(`/api/tasks/today?includeCompleted=${includeCompleted}`);
  if (!res.ok) throw new Error('Failed to fetch today\'s tasks');
  return (await res.json()).map(parseTaskDates);
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
  return (await res.json()).map((e: TaskHistoryEntry) => ({ ...e, changedAt: new Date(e.changedAt) }));
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
  const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}

function getGreeting(): { text: string; icon: React.ReactNode; color: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: <Sun className="h-6 w-6" />, color: 'text-amber-500' };
  if (hour < 17) return { text: 'Good afternoon', icon: <CloudSun className="h-6 w-6" />, color: 'text-orange-500' };
  return { text: 'Good evening', icon: <Moon className="h-6 w-6" />, color: 'text-indigo-400' };
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  delay?: number;
}

function StatCard({ icon, label, value, color, delay = 0 }: StatCardProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className="aurora-card aurora-glow p-5 flex flex-col gap-3 hover-lift"
    >
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}


export default function TodayPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d');
  const greeting = getGreeting();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', 'today', showCompleted],
    queryFn: () => fetchTodayTasks(showCompleted),
  });

  const { data: lists = [] } = useQuery({ queryKey: ['lists'], queryFn: fetchLists });
  const { data: labels = [] } = useQuery({ queryKey: ['labels'], queryFn: fetchLabels });
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
    onError: () => showError('Failed to update task'),
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsFormOpen(false);
      showSuccess('Task created');
    },
    onError: () => showError('Failed to create task'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTask(null);
      showSuccess('Task updated');
    },
    onError: () => showError('Failed to update task'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdueCount'] });
      setSelectedTask(null);
      showSuccess('Task deleted');
    },
    onError: () => showError('Failed to delete task'),
  });

  const handleCreateTask = (data: CreateTaskInput | UpdateTaskInput): void => {
    createTaskMutation.mutate({ ...(data as CreateTaskInput), date: today });
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const highPriorityCount = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  const totalEstimate = tasks.filter(t => !t.completed).reduce((acc, t) => acc + (t.estimate || 0), 0);

  if (error) {
    return (
      <AppLayout title="Today">
        <QueryErrorFallback message="Failed to load today's tasks." onRetry={() => queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] })} />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Today">
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Hero Section - Bento Grid */}
        <div className="bento-grid">
          {/* Main Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="aurora-card aurora-glow p-6 sm:p-8 md:col-span-8 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
            
            <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="space-y-4">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn('flex items-center gap-2', greeting.color)}
                >
                  {greeting.icon}
                  <span className="text-sm font-medium">{greeting.text}</span>
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl sm:text-5xl font-bold gradient-text-aurora flex items-center gap-4"
                >
                  <CalendarDays className="h-10 w-10 sm:h-12 sm:w-12" />
                  Today
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-muted-foreground"
                >
                  {formattedDate}
                </motion.p>
                
                {/* Progress Ring */}
                {totalCount > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-4 pt-2"
                  >
                    <div className="relative h-16 w-16">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                        <motion.circle
                          cx="32" cy="32" r="28" fill="none" stroke="url(#progressGradient)" strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={175.93}
                          initial={{ strokeDashoffset: 175.93 }}
                          animate={{ strokeDashoffset: 175.93 - (175.93 * progress) / 100 }}
                          transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                        />
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--primary)" />
                            <stop offset="100%" stopColor="var(--accent)" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{progress}%</span>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-lg font-semibold tabular-nums">{completedCount} of {totalCount}</p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: 'spring' }}>
                <Button onClick={() => setIsFormOpen(true)} size="lg" className="btn-aurora h-14 px-8 rounded-2xl text-white font-semibold text-base">
                  <Plus className="h-5 w-5 mr-2" />
                  Add Task
                </Button>
              </motion.div>
            </div>
          </motion.div>

    
      {/* Stat Cards */}
          <div className="md:col-span-4 grid grid-cols-2 gap-4">
            <StatCard
              icon={<Target className="h-5 w-5 text-white" />}
              label="Remaining"
              value={totalCount - completedCount}
              color="bg-gradient-to-br from-primary to-primary/80"
              delay={0.3}
            />
            <StatCard
              icon={<Zap className="h-5 w-5 text-white" />}
              label="High Priority"
              value={highPriorityCount}
              color="bg-gradient-to-br from-rose-500 to-rose-600"
              delay={0.4}
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-white" />}
              label="Est. Time"
              value={totalEstimate > 0 ? `${Math.floor(totalEstimate / 60)}h ${totalEstimate % 60}m` : '—'}
              color="bg-gradient-to-br from-amber-500 to-orange-500"
              delay={0.5}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-white" />}
              label="Progress"
              value={`${progress}%`}
              color="bg-gradient-to-br from-emerald-500 to-teal-500"
              delay={0.6}
            />
          </div>
        </div>

        {/* Task List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {isLoading ? (
            <TaskListSkeleton count={5} />
          ) : (
            <TaskList
              tasks={tasks}
              onTaskClick={setSelectedTask}
              onToggleComplete={(id) => toggleCompleteMutation.mutate(id)}
              showCompleted={showCompleted}
              onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
              emptyMessage="No tasks scheduled for today. Add a task to get started!"
            />
          )}
        </motion.div>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto aurora-glass border-border/30">
          <DialogHeader className="sr-only">
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              lists={lists}
              labels={labels}
              history={taskHistory}
              onUpdate={(data) => updateTaskMutation.mutate({ id: selectedTask.id, data: data as UpdateTaskInput })}
              onDelete={() => deleteTaskMutation.mutate(selectedTask.id)}
              onToggleComplete={() => toggleCompleteMutation.mutate(selectedTask.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto aurora-glass border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <TaskForm lists={lists} labels={labels} onSubmit={handleCreateTask} onCancel={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}