'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Tag,
  Repeat,
  Bell,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  Task,
  Label,
  List,
  Priority,
  RecurrencePattern,
  RecurrenceType,
  CreateTaskInput,
  UpdateTaskInput,
  ReminderMethod,
} from '@/types';
import { formatRecurrencePattern } from '@/lib/utils/recurrence';

interface TaskFormProps {
  task?: Task;
  lists: List[];
  labels: Label[];
  defaultListId?: string;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: 'text-red-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' },
  { value: 'none', label: 'None', color: 'text-muted-foreground' },
];

const RECURRENCE_TYPES: { value: RecurrenceType; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'weekday', label: 'Every weekday' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];

const REMINDER_PRESETS: { value: number; label: string }[] = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
  { value: 10080, label: '1 week before' },
];

interface SubtaskInput {
  id: string;
  name: string;
  completed: boolean;
}

interface ReminderInput {
  id: string;
  offsetMinutes: number;
  method: ReminderMethod;
}

/**
 * TaskForm Component
 * Comprehensive form for creating and editing tasks with all fields.
 * 
 * Requirements: 3.2, 24.1, 26.1, 26.2, 26.3
 */
export function TaskForm({
  task,
  lists,
  labels,
  defaultListId,
  onSubmit,
  onCancel,
  isLoading = false,
}: TaskFormProps) {
  const isEditing = !!task;

  // Form state
  const [name, setName] = React.useState(task?.name ?? '');
  const [description, setDescription] = React.useState(task?.description ?? '');
  const [listId, setListId] = React.useState(task?.listId ?? defaultListId ?? lists[0]?.id ?? '');
  const [date, setDate] = React.useState<Date | undefined>(task?.date);
  const [deadline] = React.useState<Date | undefined>(task?.deadline);
  const [deadlineTime, setDeadlineTime] = React.useState(
    task?.deadline ? format(task.deadline, 'HH:mm') : ''
  );
  const [estimate, setEstimate] = React.useState(
    task?.estimate ? formatMinutesToTime(task.estimate) : ''
  );
  const [priority, setPriority] = React.useState<Priority>(task?.priority ?? 'none');
  const [recurrence, setRecurrence] = React.useState<RecurrencePattern | undefined>(
    task?.recurrence
  );
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>(
    task?.labels?.map(l => l.id) ?? []
  );
  const [subtasks, setSubtasks] = React.useState<SubtaskInput[]>(
    task?.subtasks?.map(s => ({ id: s.id, name: s.name, completed: s.completed })) ?? []
  );
  const [newSubtaskName, setNewSubtaskName] = React.useState('');
  const [reminders, setReminders] = React.useState<ReminderInput[]>(
    task?.reminders?.map(r => ({ id: r.id, offsetMinutes: r.offsetMinutes, method: r.method })) ?? []
  );

  // Validation state
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Task name is required';
    }

    if (estimate && !isValidTimeFormat(estimate)) {
      newErrors.estimate = 'Invalid time format. Use HH:mm';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Build deadline with time
    let finalDeadline: Date | undefined;
    if (deadline) {
      finalDeadline = new Date(deadline);
      if (deadlineTime) {
        const [hours, minutes] = deadlineTime.split(':').map(Number);
        finalDeadline.setHours(hours, minutes, 0, 0);
      }
    }

    const data: CreateTaskInput | UpdateTaskInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      listId,
      date,
      deadline: finalDeadline,
      estimate: estimate ? parseTimeToMinutes(estimate) : undefined,
      priority,
      recurrence,
      labelIds: selectedLabelIds,
    };

    onSubmit(data);
  };

  const handleAddSubtask = () => {
    if (!newSubtaskName.trim()) return;
    
    setSubtasks([
      ...subtasks,
      { id: `new-${Date.now()}`, name: newSubtaskName.trim(), completed: false },
    ]);
    setNewSubtaskName('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => 
      s.id === id ? { ...s, completed: !s.completed } : s
    ));
  };

  const handleAddReminder = (offsetMinutes: number) => {
    if (reminders.some(r => r.offsetMinutes === offsetMinutes)) return;
    
    setReminders([
      ...reminders,
      { id: `new-${Date.now()}`, offsetMinutes, method: 'in-app' },
    ]);
  };

  const handleRemoveReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Task Name */}
      <div className="space-y-2">
        <Input
          placeholder="Task name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={cn(
            'h-10 sm:h-9 text-base sm:text-sm',
            errors.name && 'border-destructive'
          )}
          autoFocus
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-base sm:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* List Selection */}
      <div className="flex items-center gap-2">
        <Select value={listId} onValueChange={setListId}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 sm:h-9">
            <SelectValue placeholder="Select list" />
          </SelectTrigger>
          <SelectContent>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id} className="py-2.5 sm:py-1.5">
                {list.emoji && <span className="mr-2">{list.emoji}</span>}
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date and Time Row - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'justify-start h-10 sm:h-8 text-base sm:text-sm',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              {date ? format(date, 'MMM d, yyyy') : 'Set date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
            />
            {date && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDate(undefined)}
                  className="w-full h-10 sm:h-8"
                >
                  Clear date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Deadline Time */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="time"
            value={deadlineTime}
            onChange={(e) => setDeadlineTime(e.target.value)}
            className="flex-1 sm:w-[120px] h-10 sm:h-8 text-base sm:text-sm"
            placeholder="Time"
          />
        </div>
      </div>

      {/* Priority and Estimate Row - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Priority */}
        <div className="flex items-center gap-2 flex-1">
          <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="flex-1 sm:w-[140px] h-10 sm:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value} className="py-2.5 sm:py-1.5">
                  <span className={p.color}>{p.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estimate */}
        <div className="flex items-center gap-2 flex-1">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Estimate (HH:mm)"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            className={cn(
              'flex-1 sm:w-[140px] h-10 sm:h-9 text-base sm:text-sm',
              errors.estimate && 'border-destructive'
            )}
          />
        </div>
      </div>
      {errors.estimate && (
        <p className="text-xs text-destructive -mt-2">{errors.estimate}</p>
      )}

      {/* Recurrence */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={recurrence?.type ?? 'none'}
            onValueChange={(v) => {
              if (v === 'none') {
                setRecurrence(undefined);
              } else {
                setRecurrence({ type: v as RecurrenceType });
              }
            }}
          >
            <SelectTrigger className="flex-1 sm:w-[180px] h-10 sm:h-9">
              <SelectValue placeholder="No repeat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="py-2.5 sm:py-1.5">No repeat</SelectItem>
              {RECURRENCE_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="py-2.5 sm:py-1.5">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {recurrence && (
          <span className="text-xs text-muted-foreground ml-6 sm:ml-0">
            {formatRecurrencePattern(recurrence)}
          </span>
        )}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Labels</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <Badge
                key={label.id}
                variant={selectedLabelIds.includes(label.id) ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer',
                  // Larger touch targets on mobile
                  'py-1.5 px-3 sm:py-1 sm:px-2.5 text-sm sm:text-xs'
                )}
                onClick={() => toggleLabel(label.id)}
              >
                {label.icon && <span className="mr-1">{label.icon}</span>}
                {label.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Subtasks</span>
        </div>
        
        {subtasks.length > 0 && (
          <div className="space-y-2 sm:space-y-1">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                <Checkbox
                  checked={subtask.completed}
                  onCheckedChange={() => handleToggleSubtask(subtask.id)}
                  className="h-5 w-5 sm:h-4 sm:w-4"
                />
                <span className={cn(
                  'flex-1 text-base sm:text-sm',
                  subtask.completed && 'line-through text-muted-foreground'
                )}>
                  {subtask.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-6 sm:w-6"
                  onClick={() => handleRemoveSubtask(subtask.id)}
                >
                  <X className="h-4 w-4 sm:h-3 sm:w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="Add subtask"
            value={newSubtaskName}
            onChange={(e) => setNewSubtaskName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
            className="flex-1 h-10 sm:h-9 text-base sm:text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddSubtask}
            disabled={!newSubtaskName.trim()}
            className="h-10 w-10 sm:h-9 sm:w-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Reminders */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Reminders</span>
        </div>

        {reminders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reminders.map((reminder) => (
              <Badge 
                key={reminder.id} 
                variant="secondary" 
                className="gap-1 py-1.5 px-3 sm:py-1 sm:px-2.5"
              >
                {formatReminderOffset(reminder.offsetMinutes)}
                <button
                  type="button"
                  onClick={() => handleRemoveReminder(reminder.id)}
                  className="ml-1 hover:text-destructive p-0.5"
                >
                  <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Select onValueChange={(v) => handleAddReminder(parseInt(v, 10))}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 sm:h-9">
            <SelectValue placeholder="Add reminder" />
          </SelectTrigger>
          <SelectContent>
            {REMINDER_PRESETS.filter(
              p => !reminders.some(r => r.offsetMinutes === p.value)
            ).map((preset) => (
              <SelectItem key={preset.value} value={String(preset.value)} className="py-2.5 sm:py-1.5">
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Form Actions - Full width buttons on mobile */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="h-11 sm:h-9 text-base sm:text-sm"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="h-11 sm:h-9 text-base sm:text-sm"
        >
          {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}

// Helper functions

function isValidTimeFormat(time: string): boolean {
  const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatReminderOffset(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min before`;
  }
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} before`;
  }
  const days = Math.floor(minutes / 1440);
  if (days === 7) {
    return '1 week before';
  }
  return `${days} day${days > 1 ? 's' : ''} before`;
}

export default TaskForm;
