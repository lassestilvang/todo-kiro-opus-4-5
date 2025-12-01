'use client';

import * as React from 'react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, Clock, Paperclip, CheckCircle2, Circle, AlertCircle, Repeat, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { Task, Priority } from '@/types';

interface TaskItemProps {
  task: Task;
  onClick?: () => void;
  onToggleComplete?: () => void;
  className?: string;
}

const priorityConfig: Record<Priority, { 
  color: string; 
  bgColor: string;
  borderColor: string;
  glowColor: string;
  gradient: string;
}> = {
  high: { 
    color: 'text-rose-500 dark:text-rose-400', 
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    glowColor: 'shadow-rose-500/25',
    gradient: 'from-rose-500 to-rose-400',
  },
  medium: { 
    color: 'text-amber-500 dark:text-amber-400', 
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-amber-500/25',
    gradient: 'from-amber-500 to-amber-400',
  },
  low: { 
    color: 'text-sky-500 dark:text-sky-400', 
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    glowColor: 'shadow-sky-500/25',
    gradient: 'from-sky-500 to-sky-400',
  },
  none: { 
    color: 'text-muted-foreground', 
    bgColor: '',
    borderColor: 'border-border/50',
    glowColor: '',
    gradient: '',
  },
};

function isOverdue(task: Task): boolean {
  if (task.completed) return false;
  if (!task.deadline) return false;
  return isPast(task.deadline);
}

function formatDueDate(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}

function getSubtaskProgress(task: Task): { completed: number; total: number } | null {
  if (!task.subtasks || task.subtasks.length === 0) return null;
  const completed = task.subtasks.filter(s => s.completed).length;
  return { completed, total: task.subtasks.length };
}

export function TaskItem({ task, onClick, onToggleComplete, className }: TaskItemProps): React.ReactElement {
  const taskIsOverdue = isOverdue(task);
  const subtaskProgress = getSubtaskProgress(task);
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const hasRecurrence = !!task.recurrence;
  const priority = priorityConfig[task.priority];

  const handleCheckboxClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onToggleComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95, transition: { duration: 0.25 } }}
      whileTap={{ scale: 0.98 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'task-item group relative flex items-start gap-4 rounded-2xl p-5',
        'aurora-card cursor-pointer',
        'transition-all duration-400',
        task.completed && 'opacity-50',
        taskIsOverdue && 'border-destructive/40 bg-destructive/5',
        task.priority !== 'none' && !taskIsOverdue && priority.borderColor,
        className
      )}
    >
      {/* Priority indicator */}
      {task.priority !== 'none' && (
        <motion.div 
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          className={cn(
            'absolute left-0 top-5 bottom-5 w-1 rounded-full origin-center',
            `bg-gradient-to-b ${priority.gradient}`
          )} 
        />
      )}

      {/* Checkbox */}
      <div className="pt-0.5 -m-2 p-2 sm:m-0 sm:p-0" onClick={handleCheckboxClick} role="button" tabIndex={-1}>
        <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}>
          <Checkbox
            checked={task.completed}
            className={cn(
              'task-checkbox h-6 w-6 rounded-full border-2',
              'transition-all duration-300',
              task.priority === 'high' && !task.completed && 'border-rose-500/50 hover:border-rose-500',
              task.priority === 'medium' && !task.completed && 'border-amber-500/50 hover:border-amber-500',
              task.priority === 'low' && !task.completed && 'border-sky-500/50 hover:border-sky-500',
              task.priority === 'none' && !task.completed && 'border-muted-foreground/30 hover:border-primary'
            )}
          />
        </motion.div>
      </div>

 
     {/* Content */}
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="flex items-start gap-2">
          <span className={cn(
            'text-base font-medium leading-snug transition-all duration-300',
            task.completed && 'line-through text-muted-foreground'
          )}>
            {task.name}
          </span>
          
          {hasRecurrence && (
            <motion.span 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="shrink-0 text-primary/60"
              title="Recurring task"
            >
              <Repeat className="h-4 w-4" />
            </motion.span>
          )}
          
          {task.priority !== 'none' && (
            <span className={cn('shrink-0', priority.color)} title={`${task.priority} priority`}>
              <Flag className="h-4 w-4" />
            </span>
          )}
        </div>

        {/* Meta information */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {task.date && (
            <span className={cn(
              'flex items-center gap-1.5 font-medium',
              taskIsOverdue ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {taskIsOverdue ? <AlertCircle className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
              {formatDueDate(task.date)}
            </span>
          )}

          {task.deadline && (
            <span className={cn(
              'flex items-center gap-1.5',
              taskIsOverdue ? 'text-destructive' : 'text-muted-foreground'
            )}>
              <Clock className="h-4 w-4" />
              {format(task.deadline, 'h:mm a')}
            </span>
          )}

          {subtaskProgress && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {subtaskProgress.completed === subtaskProgress.total ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span className="tabular-nums">{subtaskProgress.completed}/{subtaskProgress.total}</span>
            </span>
          )}

          {hasAttachments && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              {task.attachments!.length}
            </span>
          )}
        </div>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border-0 rounded-full hover:bg-primary/20 transition-colors"
              >
                {label.icon && <span className="mr-1">{label.icon}</span>}
                {label.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Overdue badge */}
      {taskIsOverdue && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
          <Badge variant="destructive" className="text-xs font-semibold shadow-lg shadow-destructive/25 rounded-full">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        </motion.div>
      )}
    </motion.div>
  );
}

export default TaskItem;