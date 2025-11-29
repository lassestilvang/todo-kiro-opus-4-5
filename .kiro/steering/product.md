---
inclusion: always
---

# Daily Task Planner — Product Rules

Task management app: organize tasks into lists, apply labels, set priorities/deadlines, track time.

## Domain Entities

| Entity | Key Fields | Notes |
|--------|------------|-------|
| Task | name, description, date, deadline, estimate, actualTime, priority, recurrence | Core entity; times in minutes |
| List | name | "Inbox" is immutable default |
| Label | name, icon? | Cross-list categorization |
| Subtask | name, completed | Cascade-deleted with parent |
| Reminder | offsetMinutes, method | method: `'push' \| 'email' \| 'in-app'` |

## Enums

```typescript
type Priority = 'high' | 'medium' | 'low' | 'none'; // default: 'none'
type Recurrence = 'daily' | 'weekly' | 'weekday' | 'monthly' | 'yearly' | 'custom';
type ReminderMethod = 'push' | 'email' | 'in-app';
```

## Business Rules (MUST enforce)

### Inbox Behavior
- Inbox list always exists, appears first in UI
- Cannot delete or rename Inbox
- Tasks without listId default to Inbox
- Deleting any other list moves its tasks to Inbox

### Cascade Deletes
- Task deletion → removes subtasks, attachments, reminders, history
- Label deletion → removes label from all tasks (not the tasks themselves)

### Task Completion
- Completing all subtasks does NOT auto-complete parent
- Completing recurring task → create next occurrence based on pattern

### History Tracking
- Log all task modifications: `{ field, oldValue, newValue, timestamp }`

## Views

| View | Filter Logic |
|------|--------------|
| Today | `date === today` |
| Next 7 Days | `today <= date <= today + 7`, grouped by date |
| Upcoming | `date >= today`, grouped by date/period |
| All | All tasks (scheduled + unscheduled) |

All views support show/hide completed toggle.

## Validation

- Names (task/list/label): required, non-empty after trim
- Priority: must match enum
- Time fields: integer minutes
- Reminder offsetMinutes: positive integer

## Feature Implementations

| Feature | Implementation |
|---------|----------------|
| Search | fuse.js fuzzy search on name, description, labels |
| NLP input | chrono-node for date parsing |
| Overdue detection | `!completed && deadline < now` |
| Theme | next-themes, system preference default |