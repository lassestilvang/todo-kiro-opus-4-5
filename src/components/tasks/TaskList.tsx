'use client';

import * as React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { Eye, EyeOff, Inbox, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Task, GroupedTasks } from '@/types';
import { TaskItem } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onToggleComplete?: (taskId: string) => void;
  showCompleted?: boolean;
  onToggleShowCompleted?: () => void;
  groupByDate?: boolean;
  emptyMessage?: string;
  className?: string;
}

function formatGroupDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
}

function groupTasksByDate(tasks: Task[]): GroupedTasks[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const dateKey = task.date ? task.date.toISOString().split('T')[0] : 'no-date';
    const existing = groups.get(dateKey) || [];
    existing.push(task);
    groups.set(dateKey, existing);
  }

  const result: GroupedTasks[] = [];
  for (const [dateKey, groupTasks] of groups) {
    if (dateKey === 'no-date') {
      result.push({ date: new Date(0), dateKey: 'no-date', tasks: groupTasks });
    } else {
      const date = new Date(dateKey);
      date.setHours(0, 0, 0, 0);
      result.push({ date, dateKey, tasks: groupTasks });
    }
  }

  result.sort((a, b) => {
    if (a.dateKey === 'no-date') return 1;
    if (b.dateKey === 'no-date') return -1;
    return a.date.getTime() - b.date.getTime();
  });

  return result;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25, scale: 0.96 },
  visible: { 
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, stiffness: 260, damping: 24 },
  },
  exit: { opacity: 0, x: -40, scale: 0.94, transition: { duration: 0.25 } },
};

export function TaskList({
  tasks, onTaskClick, onToggleComplete, showCompleted = true, onToggleShowCompleted, groupByDate = false, emptyMessage = 'No tasks', className,
}: TaskListProps): React.ReactElement {
  const filteredTasks = showCompleted ? tasks : tasks.filter(task => !task.completed);
  const groupedTasks = groupByDate ? groupTasksByDate(filteredTasks) : null;
  const hasCompletedTasks = tasks.some(task => task.completed);
  const completedCount = tasks.filter(task => task.completed).length;

  if (filteredTasks.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        {onToggleShowCompleted && hasCompletedTasks && (
          <CompletedToggle showCompleted={showCompleted} onToggle={onToggleShowCompleted} completedCount={completedCount} />
        )}
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {onToggleShowCompleted && hasCompletedTasks && (
        <CompletedToggle showCompleted={showCompleted} onToggle={onToggleShowCompleted} completedCount={completedCount} />
      )}

      <LayoutGroup>
        {groupByDate && groupedTasks ? (
          <div className="space-y-10">
            {groupedTasks.map((group, groupIndex) => (
              <TaskGroup key={group.dateKey} group={group} groupIndex={groupIndex} onTaskClick={onTaskClick} onToggleComplete={onToggleComplete} />
            ))}
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => (
                <motion.div key={task.id} variants={itemVariants} exit="exit" layout>
                  <TaskItem task={task} onClick={() => onTaskClick?.(task)} onToggleComplete={() => onToggleComplete?.(task.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </LayoutGroup>
    </div>
  );
}

interface TaskGroupProps {
  group: GroupedTasks;
  groupIndex: number;
  onTaskClick?: (task: Task) => void;
  onToggleComplete?: (taskId: string) => void;
}

function TaskGroup({ group, groupIndex, onTaskClick, onToggleComplete }: TaskGroupProps): React.ReactElement {
  const headerText = group.dateKey === 'no-date' ? 'No Date' : formatGroupDate(group.date);
  const isCurrentDay = group.dateKey !== 'no-date' && isToday(group.date);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: groupIndex * 0.1, duration: 0.5 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-4 px-1">
        <h3 className={cn('text-sm font-bold', isCurrentDay ? 'gradient-text-aurora' : 'text-muted-foreground')}>
          {headerText}
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
        <span className="text-xs text-muted-foreground/50 tabular-nums font-medium">
          {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
        <AnimatePresence mode="popLayout">
          {group.tasks.map((task) => (
            <motion.div key={task.id} variants={itemVariants} exit="exit" layout>
              <TaskItem task={task} onClick={() => onTaskClick?.(task)} onToggleComplete={() => onToggleComplete?.(task.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

interface CompletedToggleProps {
  showCompleted: boolean;
  onToggle: () => void;
  completedCount: number;
}

function CompletedToggle({ showCompleted, onToggle, completedCount }: CompletedToggleProps): React.ReactElement {
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={cn(
          'h-10 px-5 rounded-2xl',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-primary/10 transition-all duration-300',
          'group press-effect'
        )}
      >
        <motion.div initial={false} animate={{ rotate: showCompleted ? 0 : 180 }} transition={{ duration: 0.4 }} className="mr-2">
          {showCompleted ? (
            <EyeOff className="h-4 w-4 group-hover:text-primary transition-colors" />
          ) : (
            <Eye className="h-4 w-4 group-hover:text-primary transition-colors" />
          )}
        </motion.div>
        <span className="text-sm font-medium">{showCompleted ? 'Hide' : 'Show'} completed</span>
        <span className="ml-2 text-xs text-muted-foreground/50 tabular-nums">({completedCount})</span>
      </Button>
    </div>
  );
}


interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps): React.ReactElement {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-8"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 rounded-full blur-3xl scale-150" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20">
            <CheckCircle2 className="h-10 w-10 text-primary/70" />
          </div>
        </div>
      </motion.div>
      
      <p className="text-muted-foreground text-lg max-w-sm">{message}</p>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-5 flex items-center gap-2 text-sm text-muted-foreground/50"
      >
        <Sparkles className="h-4 w-4" />
        <span>Add a task to get started</span>
      </motion.div>
    </motion.div>
  );
}

export default TaskList;