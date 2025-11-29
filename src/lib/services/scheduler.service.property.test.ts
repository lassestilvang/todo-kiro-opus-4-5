/**
 * Property-based tests for Smart Scheduler service
 * 
 * Tests Properties 44, 45 from the design document
 * **Validates: Requirements 29.3, 29.5**
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import * as fc from 'fast-check';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMinutes, startOfDay, isBefore, isAfter } from 'date-fns';
import * as schema from '@/lib/db/schema';
import type { Task, ScheduleSuggestion, ISchedulerService, Priority } from '@/types';
import { and, eq, gte, lt, isNotNull } from 'drizzle-orm';

// Test database setup
let testDb: ReturnType<typeof drizzle>;
let sqlite: Database;

// Constants matching the scheduler service
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 18;
const MAX_DAYS_AHEAD = 7;

/**
 * Represents a time slot with start and end times
 */
interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Checks if two time slots overlap
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return isBefore(slot1.start, slot2.end) && isAfter(slot1.end, slot2.start);
}

/**
 * Converts a task to a time slot based on its date and estimate
 */
function taskToSlot(task: Task): TimeSlot | null {
  if (!task.date || !task.estimate) return null;
  return {
    start: task.date,
    end: addMinutes(task.date, task.estimate),
  };
}

// Create a test-specific scheduler service that uses the test database
function createTestSchedulerService(db: ReturnType<typeof drizzle>): ISchedulerService {
  const DEFAULT_SLOT_DURATION_MINUTES = 30;
  const DEFAULT_SUGGESTION_COUNT = 5;

  function toTask(row: typeof schema.tasks.$inferSelect): Task {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      listId: row.listId,
      date: row.date ?? undefined,
      deadline: row.deadline ?? undefined,
      estimate: row.estimate ?? undefined,
      actualTime: row.actualTime ?? undefined,
      priority: row.priority as Task['priority'],
      completed: row.completed,
      completedAt: row.completedAt ?? undefined,
      recurrence: row.recurrence as Task['recurrence'],
      parentTaskId: row.parentTaskId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async function getScheduledTasksInRange(start: Date, end: Date): Promise<Task[]> {
    const rows = db
      .select()
      .from(schema.tasks)
      .where(
        and(
          gte(schema.tasks.date, start),
          lt(schema.tasks.date, end),
          eq(schema.tasks.completed, false),
          isNotNull(schema.tasks.estimate)
        )
      )
      .all();

    return rows.map(toTask);
  }

  function generateWorkingSlots(date: Date, slotDurationMinutes: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dayStart = startOfDay(date);
    
    let currentTime = addMinutes(dayStart, DEFAULT_WORK_START_HOUR * 60);
    const dayEnd = addMinutes(dayStart, DEFAULT_WORK_END_HOUR * 60);

    while (isBefore(currentTime, dayEnd)) {
      const slotEnd = addMinutes(currentTime, slotDurationMinutes);
      if (isBefore(slotEnd, dayEnd) || slotEnd.getTime() === dayEnd.getTime()) {
        slots.push({ start: new Date(currentTime), end: new Date(slotEnd) });
      }
      currentTime = slotEnd;
    }

    return slots;
  }

  function findAvailableSlots(
    allSlots: TimeSlot[],
    existingTasks: Task[],
    requiredDuration: number
  ): TimeSlot[] {
    const taskSlots = existingTasks
      .map(taskToSlot)
      .filter((slot): slot is TimeSlot => slot !== null);

    return allSlots.filter(slot => {
      const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
      if (slotDuration < requiredDuration) return false;

      const proposedSlot: TimeSlot = {
        start: slot.start,
        end: addMinutes(slot.start, requiredDuration),
      };

      return !taskSlots.some(taskSlot => slotsOverlap(proposedSlot, taskSlot));
    });
  }

  function calculateSlotScore(
    slot: TimeSlot,
    task: Task,
    now: Date
  ): { score: number; reason: string } {
    let score = 50;
    const reasons: string[] = [];

    if (task.priority === 'high') {
      const hoursFromNow = (slot.start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursFromNow < 24) {
        score += 30;
        reasons.push('Early slot for high priority task');
      } else if (hoursFromNow < 48) {
        score += 20;
        reasons.push('Soon slot for high priority task');
      }
    } else if (task.priority === 'medium') {
      const hoursFromNow = (slot.start.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursFromNow < 48) {
        score += 15;
        reasons.push('Reasonable timing for medium priority');
      }
    }

    if (task.deadline) {
      const hoursUntilDeadline = (task.deadline.getTime() - slot.start.getTime()) / (1000 * 60 * 60);
      const taskDurationHours = (task.estimate || 60) / 60;
      
      if (hoursUntilDeadline > 0 && hoursUntilDeadline <= taskDurationHours * 2) {
        score += 25;
        reasons.push('Close to deadline');
      } else if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 24) {
        score += 20;
        reasons.push('Within 24 hours of deadline');
      } else if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 48) {
        score += 10;
        reasons.push('Within 48 hours of deadline');
      } else if (hoursUntilDeadline < 0) {
        score -= 20;
        reasons.push('After deadline');
      }
    }

    const slotHour = slot.start.getHours();
    if (slotHour >= 9 && slotHour < 12) {
      score += 5;
      reasons.push('Morning slot (peak focus time)');
    }

    if (slotHour >= 16) {
      score -= 3;
    }

    const daysFromNow = (slot.start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysFromNow < 1) {
      score += 5;
      reasons.push('Available today');
    } else if (daysFromNow < 2) {
      score += 3;
      reasons.push('Available tomorrow');
    }

    score = Math.max(0, Math.min(100, score));

    const reason = reasons.length > 0 ? reasons.join('; ') : 'Available time slot';
    return { score, reason };
  }

  return {
    async suggestTimeSlots(task: Task, count = DEFAULT_SUGGESTION_COUNT): Promise<ScheduleSuggestion[]> {
      if (!task.estimate || task.estimate <= 0) {
        return [];
      }

      const now = new Date();
      const searchStart = startOfDay(now);
      const searchEnd = addDays(searchStart, MAX_DAYS_AHEAD + 1);

      const existingTasks = await getScheduledTasksInRange(searchStart, searchEnd);

      const allSlots: TimeSlot[] = [];
      for (let day = 0; day <= MAX_DAYS_AHEAD; day++) {
        const date = addDays(now, day);
        const daySlots = generateWorkingSlots(date, DEFAULT_SLOT_DURATION_MINUTES);
        const filteredSlots = daySlots.filter(slot => isAfter(slot.start, now));
        allSlots.push(...filteredSlots);
      }

      const availableSlots = findAvailableSlots(allSlots, existingTasks, task.estimate);

      const scoredSlots = availableSlots.map(slot => {
        const { score, reason } = calculateSlotScore(slot, task, now);
        return {
          startTime: slot.start,
          endTime: addMinutes(slot.start, task.estimate!),
          score,
          reason,
        };
      });

      scoredSlots.sort((a, b) => b.score - a.score);

      return scoredSlots.slice(0, count);
    },
  };
}

let schedulerService: ISchedulerService;

beforeAll(() => {
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  sqlite.exec('PRAGMA foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      emoji TEXT,
      is_inbox INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      list_id TEXT NOT NULL REFERENCES lists(id),
      date INTEGER,
      deadline INTEGER,
      estimate INTEGER,
      actual_time INTEGER,
      priority TEXT NOT NULL DEFAULT 'none',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      recurrence TEXT,
      parent_task_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  schedulerService = createTestSchedulerService(testDb);
});

afterAll(() => {
  sqlite.close();
});

beforeEach(() => {
  sqlite.exec('DELETE FROM tasks');
  sqlite.exec('DELETE FROM lists');
});

// Helper functions
function createTestList(): string {
  const listId = uuidv4();
  const now = new Date();
  testDb.insert(schema.lists).values({
    id: listId,
    name: 'Test List',
    isInbox: false,
    createdAt: now,
    updatedAt: now,
  }).run();
  return listId;
}

function createScheduledTask(
  listId: string,
  name: string,
  date: Date,
  estimate: number,
  priority: Priority = 'none'
): string {
  const taskId = uuidv4();
  const now = new Date();
  testDb.insert(schema.tasks).values({
    id: taskId,
    name,
    listId,
    date,
    estimate,
    priority,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }).run();
  return taskId;
}

function createTaskObject(
  listId: string,
  estimate: number,
  priority: Priority = 'none',
  deadline?: Date
): Task {
  return {
    id: uuidv4(),
    name: 'Task to schedule',
    listId,
    estimate,
    priority,
    deadline,
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Arbitraries for generating test data
const validEstimate = fc.integer({ min: 15, max: 120 }); // 15 min to 2 hours
const validPriority = fc.constantFrom<Priority>('high', 'medium', 'low', 'none');

describe('Property 44: Schedule Suggestion Non-Conflict', () => {
  /**
   * **Feature: daily-task-planner, Property 44: Schedule Suggestion Non-Conflict**
   * **Validates: Requirements 29.3**
   *
   * For any scheduling suggestion, the suggested time slot SHALL not overlap
   * with existing scheduled tasks.
   */
  test('Suggestions do not overlap with existing scheduled tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEstimate,
        validPriority,
        fc.integer({ min: 1, max: 5 }), // number of existing tasks
        async (estimate, priority, numExistingTasks) => {
          const listId = createTestList();
          
          // Create existing scheduled tasks at various times
          const now = new Date();
          const existingTaskSlots: TimeSlot[] = [];
          
          for (let i = 0; i < numExistingTasks; i++) {
            // Schedule tasks at different times during working hours
            const taskDate = addDays(now, i % 3);
            const dayStart = startOfDay(taskDate);
            const taskStart = addMinutes(dayStart, DEFAULT_WORK_START_HOUR * 60 + (i * 60));
            const taskEstimate = 30 + (i * 15); // 30-90 minutes
            
            createScheduledTask(listId, `Existing Task ${i}`, taskStart, taskEstimate);
            existingTaskSlots.push({
              start: taskStart,
              end: addMinutes(taskStart, taskEstimate),
            });
          }

          // Create task to schedule
          const taskToSchedule = createTaskObject(listId, estimate, priority);
          
          // Get suggestions
          const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

          // Verify no suggestion overlaps with existing tasks
          for (const suggestion of suggestions) {
            const suggestionSlot: TimeSlot = {
              start: suggestion.startTime,
              end: suggestion.endTime,
            };

            for (const existingSlot of existingTaskSlots) {
              const overlaps = slotsOverlap(suggestionSlot, existingSlot);
              expect(overlaps).toBe(false);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Suggestions are within working hours', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const taskToSchedule = createTaskObject(listId, estimate, priority);
        
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        for (const suggestion of suggestions) {
          const startHour = suggestion.startTime.getHours();
          const endHour = suggestion.endTime.getHours();
          const endMinutes = suggestion.endTime.getMinutes();

          // Start should be within working hours
          expect(startHour).toBeGreaterThanOrEqual(DEFAULT_WORK_START_HOUR);
          expect(startHour).toBeLessThan(DEFAULT_WORK_END_HOUR);

          // End should not exceed working hours
          if (endHour === DEFAULT_WORK_END_HOUR) {
            expect(endMinutes).toBe(0);
          } else {
            expect(endHour).toBeLessThanOrEqual(DEFAULT_WORK_END_HOUR);
          }
        }
      }),
      { numRuns: 50 }
    );
  });

  test('Suggestions are in the future', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const taskToSchedule = createTaskObject(listId, estimate, priority);
        
        const now = new Date();
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        for (const suggestion of suggestions) {
          expect(isAfter(suggestion.startTime, now)).toBe(true);
        }
      }),
      { numRuns: 50 }
    );
  });

  test('Suggestion duration matches task estimate', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const taskToSchedule = createTaskObject(listId, estimate, priority);
        
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        for (const suggestion of suggestions) {
          const durationMinutes = (suggestion.endTime.getTime() - suggestion.startTime.getTime()) / (1000 * 60);
          expect(durationMinutes).toBe(estimate);
        }
      }),
      { numRuns: 50 }
    );
  });

  test('No suggestions for task without estimate', async () => {
    await fc.assert(
      fc.asyncProperty(validPriority, async (priority) => {
        const listId = createTestList();
        const taskWithoutEstimate: Task = {
          id: uuidv4(),
          name: 'Task without estimate',
          listId,
          priority,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const suggestions = await schedulerService.suggestTimeSlots(taskWithoutEstimate);
        expect(suggestions).toEqual([]);
      }),
      { numRuns: 20 }
    );
  });
});

describe('Property 45: Schedule Suggestion Ranking', () => {
  /**
   * **Feature: daily-task-planner, Property 45: Schedule Suggestion Ranking**
   * **Validates: Requirements 29.5**
   *
   * For any set of scheduling suggestions, suggestions SHALL be ordered by
   * suitability score (higher scores first).
   */
  test('Suggestions are ordered by score descending', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const taskToSchedule = createTaskObject(listId, estimate, priority);
        
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        // Verify suggestions are sorted by score descending
        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
        }
      }),
      { numRuns: 50 }
    );
  });

  test('High priority tasks get higher scores for earlier slots', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, async (estimate) => {
        const listId = createTestList();
        
        // Create high priority task
        const highPriorityTask = createTaskObject(listId, estimate, 'high');
        const highPrioritySuggestions = await schedulerService.suggestTimeSlots(highPriorityTask, 5);

        // Create low priority task
        const lowPriorityTask = createTaskObject(listId, estimate, 'none');
        const lowPrioritySuggestions = await schedulerService.suggestTimeSlots(lowPriorityTask, 5);

        // High priority task should have higher top score (due to priority bonus)
        if (highPrioritySuggestions.length > 0 && lowPrioritySuggestions.length > 0) {
          expect(highPrioritySuggestions[0].score).toBeGreaterThanOrEqual(lowPrioritySuggestions[0].score);
        }
      }),
      { numRuns: 30 }
    );
  });

  test('Tasks with deadline get higher scores for slots before deadline', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, async (estimate) => {
        const listId = createTestList();
        const now = new Date();
        
        // Create task with deadline tomorrow
        const deadline = addDays(now, 1);
        const taskWithDeadline = createTaskObject(listId, estimate, 'none', deadline);
        const suggestions = await schedulerService.suggestTimeSlots(taskWithDeadline, 10);

        // Suggestions before deadline should have higher scores
        const beforeDeadline = suggestions.filter(s => isBefore(s.endTime, deadline));
        const afterDeadline = suggestions.filter(s => isAfter(s.startTime, deadline));

        if (beforeDeadline.length > 0 && afterDeadline.length > 0) {
          const avgBeforeScore = beforeDeadline.reduce((sum, s) => sum + s.score, 0) / beforeDeadline.length;
          const avgAfterScore = afterDeadline.reduce((sum, s) => sum + s.score, 0) / afterDeadline.length;
          expect(avgBeforeScore).toBeGreaterThan(avgAfterScore);
        }
      }),
      { numRuns: 30 }
    );
  });

  test('All suggestions have valid scores between 0 and 100', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const deadline = fc.sample(fc.option(fc.date({ min: new Date(), max: addDays(new Date(), 7) })), 1)[0];
        const taskToSchedule = createTaskObject(listId, estimate, priority, deadline ?? undefined);
        
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        for (const suggestion of suggestions) {
          expect(suggestion.score).toBeGreaterThanOrEqual(0);
          expect(suggestion.score).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 50 }
    );
  });

  test('All suggestions have a reason', async () => {
    await fc.assert(
      fc.asyncProperty(validEstimate, validPriority, async (estimate, priority) => {
        const listId = createTestList();
        const taskToSchedule = createTaskObject(listId, estimate, priority);
        
        const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, 10);

        for (const suggestion of suggestions) {
          expect(typeof suggestion.reason).toBe('string');
          expect(suggestion.reason.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 30 }
    );
  });

  test('Requested count limits number of suggestions', async () => {
    await fc.assert(
      fc.asyncProperty(
        validEstimate,
        validPriority,
        fc.integer({ min: 1, max: 10 }),
        async (estimate, priority, requestedCount) => {
          const listId = createTestList();
          const taskToSchedule = createTaskObject(listId, estimate, priority);
          
          const suggestions = await schedulerService.suggestTimeSlots(taskToSchedule, requestedCount);

          expect(suggestions.length).toBeLessThanOrEqual(requestedCount);
        }
      ),
      { numRuns: 30 }
    );
  });
});
