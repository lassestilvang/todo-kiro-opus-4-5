import { db, schema } from '@/lib/db';
import { and, eq, gte, lt, isNotNull } from 'drizzle-orm';
import type { Task, ScheduleSuggestion, ISchedulerService } from '@/types';
import { addDays, startOfDay, endOfDay, addMinutes, isBefore, isAfter } from 'date-fns';

// Default working hours (9 AM to 6 PM)
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 18;
const DEFAULT_SLOT_DURATION_MINUTES = 30;
const DEFAULT_SUGGESTION_COUNT = 5;
const MAX_DAYS_AHEAD = 7;

/**
 * Represents a time slot with start and end times
 */
interface TimeSlot {
  start: Date;
  end: Date;
}

/**
 * Gets scheduled tasks within a date range that have both date and estimate
 */
async function getScheduledTasksInRange(start: Date, end: Date): Promise<Task[]> {
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        gte(schema.tasks.date, start),
        lt(schema.tasks.date, end),
        eq(schema.tasks.completed, false),
        isNotNull(schema.tasks.estimate)
      )
    );

  return rows.map(row => ({
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
  }));
}

/**
 * Generates working hour slots for a given day
 */
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

/**
 * Finds available slots that don't conflict with existing tasks
 */
function findAvailableSlots(
  allSlots: TimeSlot[],
  existingTasks: Task[],
  requiredDuration: number
): TimeSlot[] {
  const taskSlots = existingTasks
    .map(taskToSlot)
    .filter((slot): slot is TimeSlot => slot !== null);

  return allSlots.filter(slot => {
    // Check if slot is long enough
    const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
    if (slotDuration < requiredDuration) return false;

    // Check for conflicts with existing tasks
    const proposedSlot: TimeSlot = {
      start: slot.start,
      end: addMinutes(slot.start, requiredDuration),
    };

    return !taskSlots.some(taskSlot => slotsOverlap(proposedSlot, taskSlot));
  });
}

/**
 * Calculates a score for a time slot based on task properties
 * Higher score = better suggestion
 */
function calculateSlotScore(
  slot: TimeSlot,
  task: Task,
  now: Date
): { score: number; reason: string } {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Priority bonus: higher priority tasks get earlier slots preferred
  if (task.priority === 'high') {
    // Prefer earlier slots for high priority
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

  // Deadline proximity bonus
  if (task.deadline) {
    const hoursUntilDeadline = (task.deadline.getTime() - slot.start.getTime()) / (1000 * 60 * 60);
    const taskDurationHours = (task.estimate || 60) / 60;
    
    if (hoursUntilDeadline > 0 && hoursUntilDeadline <= taskDurationHours * 2) {
      // Very close to deadline - high urgency
      score += 25;
      reasons.push('Close to deadline');
    } else if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 24) {
      score += 20;
      reasons.push('Within 24 hours of deadline');
    } else if (hoursUntilDeadline > 0 && hoursUntilDeadline <= 48) {
      score += 10;
      reasons.push('Within 48 hours of deadline');
    } else if (hoursUntilDeadline < 0) {
      // Slot is after deadline - penalize
      score -= 20;
      reasons.push('After deadline');
    }
  }

  // Morning preference (9-12) for focused work
  const slotHour = slot.start.getHours();
  if (slotHour >= 9 && slotHour < 12) {
    score += 5;
    reasons.push('Morning slot (peak focus time)');
  }

  // Avoid late afternoon slots slightly
  if (slotHour >= 16) {
    score -= 3;
  }

  // Prefer slots that start sooner (all else being equal)
  const daysFromNow = (slot.start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysFromNow < 1) {
    score += 5;
    reasons.push('Available today');
  } else if (daysFromNow < 2) {
    score += 3;
    reasons.push('Available tomorrow');
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  const reason = reasons.length > 0 ? reasons.join('; ') : 'Available time slot';
  return { score, reason };
}

/**
 * Smart Scheduler Service Implementation
 * Provides intelligent scheduling suggestions based on existing tasks and task properties
 */
export const schedulerService: ISchedulerService = {
  /**
   * Suggests available time slots for a task based on existing scheduled tasks.
   * Considers priority and deadline proximity for ranking suggestions.
   * 
   * @param task - The task to schedule (must have an estimate)
   * @param count - Number of suggestions to return (default: 5)
   * @returns Array of schedule suggestions ranked by suitability
   */
  async suggestTimeSlots(task: Task, count = DEFAULT_SUGGESTION_COUNT): Promise<ScheduleSuggestion[]> {
    // If task has no estimate, we can't suggest time slots
    if (!task.estimate || task.estimate <= 0) {
      return [];
    }

    const now = new Date();
    const searchStart = startOfDay(now);
    const searchEnd = endOfDay(addDays(now, MAX_DAYS_AHEAD));

    // Get all scheduled tasks in the search range
    const existingTasks = await getScheduledTasksInRange(searchStart, searchEnd);

    // Generate all possible working hour slots
    const allSlots: TimeSlot[] = [];
    for (let day = 0; day <= MAX_DAYS_AHEAD; day++) {
      const date = addDays(now, day);
      const daySlots = generateWorkingSlots(date, DEFAULT_SLOT_DURATION_MINUTES);
      
      // Filter out past slots for today
      const filteredSlots = daySlots.filter(slot => isAfter(slot.start, now));
      allSlots.push(...filteredSlots);
    }

    // Find available slots that don't conflict with existing tasks
    const availableSlots = findAvailableSlots(allSlots, existingTasks, task.estimate);

    // Score and rank the available slots
    const scoredSlots = availableSlots.map(slot => {
      const { score, reason } = calculateSlotScore(slot, task, now);
      return {
        startTime: slot.start,
        endTime: addMinutes(slot.start, task.estimate!),
        score,
        reason,
      };
    });

    // Sort by score (descending) and take top N
    scoredSlots.sort((a, b) => b.score - a.score);

    return scoredSlots.slice(0, count);
  },
};

export default schedulerService;
