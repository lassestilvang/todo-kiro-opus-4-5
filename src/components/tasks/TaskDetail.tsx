'use client';

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  Clock,
  Flag,
  Tag,
  Repeat,
  Paperclip,
  Bell,
  History,
  Edit,
  Trash2,
  Download,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Task, TaskHistoryEntry, Priority, Label, List, CreateTaskInput, UpdateTaskInput } from '@/types';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';
import { TaskForm } from './TaskForm';

interface TaskDetailProps {
  task: Task;
  lists: List[];
  labels: Label[];
  history?: TaskHistoryEntry[];
  onUpdate: (data: CreateTaskInput | UpdateTaskInput) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onToggleSubtask?: (subtaskId: string) => void;
  onDeleteSubtask?: (subtaskId: string) => void;
  onDownloadAttachment?: (attachmentId: string) => void;
  isLoading?: boolean;
}

const priorityConfig: Record<Priority, { color: string; label: string; bgColor: string }> = {
  high: { color: 'text-red-500', label: 'High', bgColor: 'bg-red-500/10' },
  medium: { color: 'text-yellow-500', label: 'Medium', bgColor: 'bg-yellow-500/10' },
  low: { color: 'text-blue-500', label: 'Low', bgColor: 'bg-blue-500/10' },
  none: { color: 'text-muted-foreground', label: 'None', bgColor: '' },
};

/**
 * TaskDetail Component
 * Full task view with all properties, edit mode, and history view.
 * 
 * Requirements: 5.1, 7.3
 */
export function TaskDetail({
  task,
  lists,
  labels,
  history = [],
  onUpdate,
  onDelete,
  onToggleComplete,
  onToggleSubtask,
  onDeleteSubtask,
  onDownloadAttachment,
  isLoading = false,
}: TaskDetailProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const priority = priorityConfig[task.priority];
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const hasReminders = task.reminders && task.reminders.length > 0;
  const hasLabels = task.labels && task.labels.length > 0;

  const handleFormSubmit = (data: CreateTaskInput | UpdateTaskInput) => {
    onUpdate(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Task</h2>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <TaskForm
          task={task}
          lists={lists}
          labels={labels}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsEditing(false)}
          isLoading={isLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Checkbox
            checked={task.completed}
            onCheckedChange={onToggleComplete}
            className="mt-1 h-5 w-5"
          />
          <div className="space-y-1 flex-1">
            <h2 className={cn(
              'text-lg font-semibold',
              task.completed && 'line-through text-muted-foreground'
            )}>
              {task.name}
            </h2>
            {task.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Properties */}
      <div className="space-y-4">
        {/* List */}
        {task.list && (
          <PropertyRow icon={<Tag className="h-4 w-4" />} label="List">
            <span className="flex items-center gap-2">
              {task.list.emoji && <span>{task.list.emoji}</span>}
              {task.list.name}
            </span>
          </PropertyRow>
        )}

        {/* Date */}
        {task.date && (
          <PropertyRow icon={<Calendar className="h-4 w-4" />} label="Date">
            {format(task.date, 'EEEE, MMMM d, yyyy')}
          </PropertyRow>
        )}

        {/* Deadline */}
        {task.deadline && (
          <PropertyRow icon={<Clock className="h-4 w-4" />} label="Deadline">
            {format(task.deadline, 'MMMM d, yyyy h:mm a')}
          </PropertyRow>
        )}

        {/* Priority */}
        {task.priority !== 'none' && (
          <PropertyRow icon={<Flag className="h-4 w-4" />} label="Priority">
            <Badge variant="secondary" className={cn(priority.bgColor, priority.color)}>
              {priority.label}
            </Badge>
          </PropertyRow>
        )}

        {/* Estimate & Actual Time */}
        {(task.estimate || task.actualTime) && (
          <PropertyRow icon={<Clock className="h-4 w-4" />} label="Time">
            <div className="flex items-center gap-4 text-sm">
              {task.estimate && (
                <span>
                  Estimate: {formatMinutes(task.estimate)}
                </span>
              )}
              {task.actualTime && (
                <span>
                  Actual: {formatMinutes(task.actualTime)}
                </span>
              )}
            </div>
          </PropertyRow>
        )}

        {/* Recurrence */}
        {task.recurrence && (
          <PropertyRow icon={<Repeat className="h-4 w-4" />} label="Repeat">
            {formatRecurrencePattern(task.recurrence)}
          </PropertyRow>
        )}

        {/* Labels */}
        {hasLabels && (
          <PropertyRow icon={<Tag className="h-4 w-4" />} label="Labels">
            <div className="flex flex-wrap gap-1">
              {task.labels!.map((label) => (
                <Badge key={label.id} variant="secondary">
                  {label.icon && <span className="mr-1">{label.icon}</span>}
                  {label.name}
                </Badge>
              ))}
            </div>
          </PropertyRow>
        )}

        {/* Reminders */}
        {hasReminders && (
          <PropertyRow icon={<Bell className="h-4 w-4" />} label="Reminders">
            <div className="flex flex-wrap gap-1">
              {task.reminders!.map((reminder) => (
                <Badge key={reminder.id} variant="outline">
                  {formatReminderOffset(reminder.offsetMinutes)} ({reminder.method})
                </Badge>
              ))}
            </div>
          </PropertyRow>
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            Subtasks
            <span className="text-muted-foreground">
              ({task.subtasks!.filter(s => s.completed).length}/{task.subtasks!.length})
            </span>
          </h3>
          <div className="space-y-1 pl-1">
            {task.subtasks!.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={subtask.completed}
                  onCheckedChange={() => onToggleSubtask?.(subtask.id)}
                  className="h-4 w-4"
                />
                <span className={cn(
                  'flex-1 text-sm',
                  subtask.completed && 'line-through text-muted-foreground'
                )}>
                  {subtask.name}
                </span>
                {onDeleteSubtask && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => onDeleteSubtask(subtask.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {hasAttachments && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
          </h3>
          <div className="space-y-1">
            {task.attachments!.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 p-2 rounded-md border text-sm"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{attachment.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </span>
                {onDownloadAttachment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onDownloadAttachment(attachment.id)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Toggle */}
      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="text-muted-foreground"
        >
          <History className="h-4 w-4 mr-2" />
          {showHistory ? 'Hide History' : 'Show History'}
        </Button>

        {showHistory && history.length > 0 && (
          <div className="mt-4 space-y-2">
            {history.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {showHistory && history.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No history available</p>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{task.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setShowDeleteConfirm(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function PropertyRow({ icon, label, children }: PropertyRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1">
        <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}

interface HistoryEntryProps {
  entry: TaskHistoryEntry;
}

function HistoryEntry({ entry }: HistoryEntryProps) {
  const timeAgo = formatDistanceToNow(entry.changedAt, { addSuffix: true });

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{timeAgo}</span>
      <span>
        <span className="font-medium">{entry.field}</span>
        {entry.previousValue && entry.newValue ? (
          <>
            {' changed from '}
            <span className="text-muted-foreground">{entry.previousValue}</span>
            {' to '}
            <span className="text-foreground">{entry.newValue}</span>
          </>
        ) : entry.newValue ? (
          <>
            {' set to '}
            <span className="text-foreground">{entry.newValue}</span>
          </>
        ) : (
          <> changed</>
        )}
      </span>
    </div>
  );
}

// Helper functions

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatReminderOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  const days = Math.floor(minutes / 1440);
  if (days === 7) return '1 week';
  return `${days} day${days > 1 ? 's' : ''}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default TaskDetail;
