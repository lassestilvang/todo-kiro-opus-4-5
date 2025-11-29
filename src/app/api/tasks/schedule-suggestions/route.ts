import { NextRequest, NextResponse } from 'next/server';
import { schedulerService } from '@/lib/services/scheduler.service';
import type { Task, Priority } from '@/types';

/**
 * GET /api/tasks/schedule-suggestions
 * Returns smart scheduling suggestions for a task based on estimate and priority.
 * 
 * Query Parameters:
 * - estimate: number (required) - Task duration in minutes
 * - priority: Priority (optional) - Task priority level
 * - deadline: string (optional) - ISO date string for task deadline
 * - count: number (optional) - Number of suggestions to return (default: 5)
 * 
 * Requirements: 29.1, 29.4, 29.5
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse estimate (required)
    const estimateStr = searchParams.get('estimate');
    if (!estimateStr) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Estimate is required' } },
        { status: 400 }
      );
    }
    
    const estimate = parseInt(estimateStr, 10);
    if (isNaN(estimate) || estimate <= 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Estimate must be a positive number' } },
        { status: 400 }
      );
    }

    // Parse priority (optional, defaults to 'none')
    const priority = (searchParams.get('priority') || 'none') as Priority;
    const validPriorities: Priority[] = ['high', 'medium', 'low', 'none'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid priority value' } },
        { status: 400 }
      );
    }

    // Parse deadline (optional)
    const deadlineStr = searchParams.get('deadline');
    let deadline: Date | undefined;
    if (deadlineStr) {
      deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime())) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid deadline date' } },
          { status: 400 }
        );
      }
    }

    // Parse count (optional, defaults to 5)
    const countStr = searchParams.get('count');
    const count = countStr ? parseInt(countStr, 10) : 5;
    if (isNaN(count) || count < 1 || count > 20) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Count must be between 1 and 20' } },
        { status: 400 }
      );
    }

    // Create a partial task object for the scheduler service
    const taskForScheduling: Task = {
      id: 'temp',
      name: 'temp',
      listId: 'temp',
      estimate,
      priority,
      deadline,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Get suggestions from the scheduler service
    const suggestions = await schedulerService.suggestTimeSlots(taskForScheduling, count);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching schedule suggestions:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedule suggestions' } },
      { status: 500 }
    );
  }
}
