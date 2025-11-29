---
inclusion: always
---

# Daily Task Planner

A task management app built with Next.js 16 (App Router). Users organize tasks into lists, apply labels, set priorities/deadlines, and track time.

## Domain Model

- **Task**: Core entity with name, description, date, deadline, estimate/actualTime (minutes), priority, recurrence, subtasks, attachments, reminders
- **List**: Task container; "Inbox" is default and immutable (cannot delete/rename)
- **Label**: Cross-list categorization tag with optional icon
- **Subtask**: Nested task item; cascade-deleted with parent
- **Priority**: `'high' | 'medium' | 'low' | 'none'` (default: `'none'`)
- **Recurrence**: `'daily' | 'weekly' | 'weekday' | 'monthly' | 'yearly' | 'custom'`

## Key Business Rules

1. Inbox list always exists, appears first, cannot be deleted or renamed
2. Tasks without a listId default to Inbox
3. Deleting a list moves its tasks to Inbox
4. Deleting a task cascade-deletes subtasks, attachments, reminders, history
5. Deleting a label removes it from all tasks
6. Completing all subtasks does NOT auto-complete parent task
7. All task modifications log to task history (field, old value, new value, timestamp)
8. Completing a recurring task creates next occurrence based on pattern

## Views

- **Today**: Tasks with date = current date
- **Next 7 Days**: Tasks from today through 7 days ahead, grouped by date
- **Upcoming**: Tasks from today onward, grouped by date/period
- **All**: All tasks (scheduled and unscheduled)
- All views support toggle to show/hide completed tasks

## Validation Rules

- Task/List/Label names: required, non-empty, non-whitespace
- Priority: must be valid enum value
- Time estimates: stored as minutes (integer)
- Reminder offsetMinutes: minutes before deadline
- Reminder method: `'push' | 'email' | 'in-app'`

## Features

- Fuzzy search across task names, descriptions, labels (using fuse.js)
- Natural language task entry (using chrono-node for date parsing)
- Smart scheduling suggestions based on existing tasks
- Overdue task detection (incomplete + deadline in past)
- Dark/light theme (system preference default)