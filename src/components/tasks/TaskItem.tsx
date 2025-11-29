'use client';

import * as React from 'react';
import { format, isPast, isToday } from 'date-fns';
import {
  Calendar,
  Clock,
  Paperclip,
  CheckCircle2,
  Circle,
  AlertCircle,
  Repeat,
} from 'lucide-react';
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

/**
 * Priority indicator colors and styles
 */
const priorityConfig: Record<Priority, { color: string; label: string }> = {
  high: { color: 'bg-red-500', label: 'High' },
  medium: { color: 'bg-yellow-500', label: 'Medium' },
  low: { color: 'bg-blue-500', label: 'Low' },
  none: { color: 'bg-transparent', label: '' },
};

/**
 * Checks if a task is overdue
 * A task is overdue if it's incomplete and has a deadline in the past
 */
function isOverdue(task: Task): boolean {
  if (task.completed) return false;
  if (!task.deadline) return false;
  return isPast(task.deadline);
}

/**
 * Formats the due date for display
 */
function formatDueDate(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  return format(date, 'MMM d');
}

/**
 * Calculates subtask progress
 */
function getSubtaskProgress(task: Task): { completed: number; total: number } | null {
  if (!task.subtasks || task.subtasks.length === 0) {
    return null;
  }
  const completed = task.subtasks.filter(s => s.completed).length;
  return { completed, total: task.subtasks.length };
}

/**
 * TaskItem Component
 * Displays a single task with priority indicator, due date, labels, subtask progress,
 * attachment indicator, and completion checkbox.
 * 
 * Requirements: 9.2, 16.1, 22.3
 */
export function TaskItem({
  task,
  onClick,
  onToggleComplete,
  className,
}: TaskItemProps) {
  const taskIsOverdue = isOverdue(task);
  const subtaskProgress = getSubtaskProgress(task);
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const hasRecurrence = !!task.recurrence;
  const priority = priorityConfig[task.priority];

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex items-start gap-3 rounded-lg border p-3 sm:p-3 transition-colors',
        'hover:bg-accent/50 active:bg-accent/70 cursor-pointer',
        // Touch-friendly: larger padding on mobile
        'p-4 sm:p-3',
        task.completed && 'opacity-60',
        taskIsOverdue && 'border-destructive/50 bg-destructive/5',
        className
      )}
    >
      {/* Checkbox - larger touch target on mobile */}
      <div 
        className="pt-0.5 -m-2 p-2 sm:m-0 sm:p-0"
        onClick={handleCheckboxClick}
        role="button"
        tabIndex={-1}
      >
        <Checkbox
          checked={task.completed}
          className={cn(
            'h-6 w-6 sm:h-5 sm:w-5',
            task.priority === 'high' && !task.completed && 'border-red-500',
            task.priority === 'medium' && !task.completed && 'border-yellow-500',
            task.priority === 'low' && !task.completed && 'border-blue-500'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-1">
        {/* Task name and priority indicator */}
        <div className="flex items-center gap-2">
          {task.priority !== 'none' && (
            <div
              className={cn(
                'h-2.5 w-2.5 sm:h-2 sm:w-2 rounded-full shrink-0',
                priority.color
              )}
              title={`${priority.label} priority`}
            />
          )}
          <span
            className={cn(
              'text-base sm:text-sm font-medium truncate',
              task.completed && 'line-through text-muted-foreground'
            )}
          >
            {task.name}
          </span>
        </div>

        {/* Meta information row */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2 text-sm sm:text-xs text-muted-foreground">
          {/* Due date */}
          {task.date && (
            <span className={cn(
              'flex items-center gap-1',
              taskIsOverdue && 'text-destructive'
            )}>
              {taskIsOverdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Calendar className="h-3 w-3" />
              )}
              {formatDueDate(task.date)}
            </span>
          )}

          {/* Deadline time */}
          {task.deadline && (
            <span className={cn(
              'flex items-center gap-1',
              taskIsOverdue && 'text-destructive'
            )}>
              <Clock className="h-3 w-3" />
              {format(task.deadline, 'h:mm a')}
            </span>
          )}

          {/* Recurrence indicator */}
          {hasRecurrence && (
            <span className="flex items-center gap-1" title="Recurring task">
              <Repeat className="h-3 w-3" />
            </span>
          )}

          {/* Subtask progress */}
          {subtaskProgress && (
            <span className="flex items-center gap-1">
              {subtaskProgress.completed === subtaskProgress.total ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          )}

          {/* Attachment indicator */}
          {hasAttachments && (
            <span className="flex items-center gap-1" title={`${task.attachments!.length} attachment(s)`}>
              <Paperclip className="h-3 w-3" />
              {task.attachments!.length}
            </span>
          )}
        </div>

        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:gap-1 pt-1">
            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="secondary"
                className="text-sm sm:text-xs px-2 py-0.5 sm:px-1.5 sm:py-0"
              >
                {label.icon && <span className="mr-1">{label.icon}</span>}
                {label.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Overdue indicator */}
      {taskIsOverdue && (
        <div className="shrink-0">
          <Badge variant="destructive" className="text-sm sm:text-xs">
            Overdue
          </Badge>
        </div>
      )}
    </div>
  );
}

export default TaskItem;
