---
inclusion: always
---

# Daily Task Planner — Product Rules

Task management app for organizing tasks into lists with labels, priorities, deadlines, and time tracking.

## Domain Model

| Entity | Required Fields | Optional Fields | Notes |
|--------|-----------------|-----------------|-------|
| Task | name | description, date, deadline, estimate, actualTime, priority, recurrence, listId | Times in minutes; defaults to Inbox if no listId |
| List | name | — | "Inbox" is system-reserved |
| Label | name | icon | For cross-list categorization |
| Subtask | name, taskId | completed | Cascade-deleted with parent task |
| Reminder | taskId, offsetMinutes, method | — | method: `'push' \| 'email' \| 'in-app'` |

## Type Definitions

```typescript
type Priority = 'high' | 'medium' | 'low' | 'none'; // default: 'none'
type Recurrence = 'daily' | 'weekly' | 'weekday' | 'monthly' | 'yearly' | 'custom';
type ReminderMethod = 'push' | 'email' | 'in-app';
```

## Critical Business Rules

These rules MUST be enforced in all service and API implementations:

### Inbox Protection
- Inbox list MUST always exist and appear first in UI
- NEVER allow deletion or renaming of Inbox
- Tasks without explicit listId MUST default to Inbox
- When deleting a list, move all its tasks to Inbox before deletion

### Cascade Operations
- Deleting a Task → delete all subtasks, attachments, reminders, history entries
- Deleting a Label → remove label association from tasks (preserve the tasks)
- Deleting a List → move tasks to Inbox, then delete list

### Task Completion Logic
- Completing all subtasks does NOT auto-complete the parent task
- Completing a recurring task → generate next occurrence based on recurrence pattern
- Mark original as completed, create new task with updated date

### History Tracking
- Log every task field modification with: `{ field, oldValue, newValue, timestamp }`
- Do NOT log initial creation or deletion events

## View Definitions

| View | Route | Filter | Grouping |
|------|-------|--------|----------|
| Today | `/today` | `date === today` | None |
| Next 7 Days | `/next-7-days` | `today <= date <= today + 7` | By date |
| Upcoming | `/upcoming` | `date >= today` | By date/period |
| All | `/all` | None (all tasks) | None |
| List | `/list/[listId]` | `listId === param` | None |

All views MUST support a show/hide completed toggle.

## Validation Rules

Apply these validations in services before database operations:

| Field | Rule | Error Message |
|-------|------|---------------|
| Task/List/Label name | Non-empty after `.trim()` | "Name is required" |
| Priority | Must be valid enum value | "Invalid priority" |
| estimate, actualTime | Integer >= 0 | "Time must be a positive integer" |
| Reminder offsetMinutes | Integer > 0 | "Offset must be a positive integer" |
| Recurrence | Must be valid enum value or null | "Invalid recurrence pattern" |

## Feature Implementation Notes

| Feature | Library | Usage Pattern |
|---------|---------|---------------|
| Search | fuse.js | Fuzzy search on task name, description, and label names |
| NLP Input | chrono-node | Parse natural language dates from user input |
| Overdue | date-fns | Task is overdue when `!completed && deadline && deadline < now` |
| Theme | next-themes | Default to system preference |

## Common Pitfalls to Avoid

- Do not allow empty task names (check after trim)
- Do not delete Inbox under any circumstances
- Do not auto-complete parent tasks when subtasks complete
- Do not forget to cascade delete related entities
- Do not create duplicate recurring task instances
