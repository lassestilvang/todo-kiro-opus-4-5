'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { Eye, EyeOff } from 'lucide-react';
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

/**
 * Formats a date for display in group headers
 */
function formatGroupDate(date: Date): string {
  if (isToday(date)) {
    return 'Today';
  }
  if (isTomorrow(date)) {
    return 'Tomorrow';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'EEEE, MMMM d');
}

/**
 * Groups tasks by their date
 */
function groupTasksByDate(tasks: Task[]): GroupedTasks[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const dateKey = task.date 
      ? task.date.toISOString().split('T')[0]
      : 'no-date';
    
    const existing = groups.get(dateKey) || [];
    existing.push(task);
    groups.set(dateKey, existing);
  }

  const result: GroupedTasks[] = [];
  
  for (const [dateKey, groupTasks] of groups) {
    if (dateKey === 'no-date') {
      result.push({
        date: new Date(0),
        dateKey: 'no-date',
        tasks: groupTasks,
      });
    } else {
      const date = new Date(dateKey);
      date.setHours(0, 0, 0, 0);
      result.push({
        date,
        dateKey,
        tasks: groupTasks,
      });
    }
  }

  // Sort by date ascending, with no-date at the end
  result.sort((a, b) => {
    if (a.dateKey === 'no-date') return 1;
    if (b.dateKey === 'no-date') return -1;
    return a.date.getTime() - b.date.getTime();
  });

  return result;
}

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

/**
 * TaskList Component
 * Displays a list of tasks with optional grouping by date and show/hide completed toggle.
 * Animates task items using Framer Motion.
 * 
 * Requirements: 12.2, 13.2, 14.2
 */
export function TaskList({
  tasks,
  onTaskClick,
  onToggleComplete,
  showCompleted = true,
  onToggleShowCompleted,
  groupByDate = false,
  emptyMessage = 'No tasks',
  className,
}: TaskListProps) {
  // Filter tasks based on showCompleted
  const filteredTasks = showCompleted 
    ? tasks 
    : tasks.filter(task => !task.completed);

  // Group tasks if needed
  const groupedTasks = groupByDate 
    ? groupTasksByDate(filteredTasks)
    : null;

  const hasCompletedTasks = tasks.some(task => task.completed);

  if (filteredTasks.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        {onToggleShowCompleted && hasCompletedTasks && (
          <CompletedToggle 
            showCompleted={showCompleted} 
            onToggle={onToggleShowCompleted} 
          />
        )}
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {onToggleShowCompleted && hasCompletedTasks && (
        <CompletedToggle 
          showCompleted={showCompleted} 
          onToggle={onToggleShowCompleted} 
        />
      )}

      {groupByDate && groupedTasks ? (
        <div className="space-y-6">
          {groupedTasks.map((group) => (
            <TaskGroup
              key={group.dateKey}
              group={group}
              onTaskClick={onTaskClick}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                variants={itemVariants}
                exit="exit"
                layout
              >
                <TaskItem
                  task={task}
                  onClick={() => onTaskClick?.(task)}
                  onToggleComplete={() => onToggleComplete?.(task.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

interface TaskGroupProps {
  group: GroupedTasks;
  onTaskClick?: (task: Task) => void;
  onToggleComplete?: (taskId: string) => void;
}

function TaskGroup({ group, onTaskClick, onToggleComplete }: TaskGroupProps) {
  const headerText = group.dateKey === 'no-date' 
    ? 'No Date' 
    : formatGroupDate(group.date);

  return (
    <div className="space-y-2 sm:space-y-2">
      <h3 className="text-base sm:text-sm font-medium text-muted-foreground px-1">
        {headerText}
      </h3>
      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        <AnimatePresence mode="popLayout">
          {group.tasks.map((task) => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              exit="exit"
              layout
            >
              <TaskItem
                task={task}
                onClick={() => onTaskClick?.(task)}
                onToggleComplete={() => onToggleComplete?.(task.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

interface CompletedToggleProps {
  showCompleted: boolean;
  onToggle: () => void;
}

function CompletedToggle({ showCompleted, onToggle }: CompletedToggleProps) {
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className={cn(
          'text-muted-foreground hover:text-foreground',
          // Touch-friendly: larger button on mobile
          'h-10 px-4 sm:h-8 sm:px-3 text-sm'
        )}
      >
        {showCompleted ? (
          <>
            <EyeOff className="h-4 w-4 mr-2" />
            Hide completed
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Show completed
          </>
        )}
      </Button>
    </div>
  );
}

export default TaskList;
