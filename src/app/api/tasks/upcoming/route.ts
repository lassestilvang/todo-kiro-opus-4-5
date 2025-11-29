import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task.service';
import type { ErrorResponse } from '@/types';

/**
 * GET /api/tasks/upcoming
 * Returns all upcoming tasks (from today onward)
 * Query params:
 *   - includeCompleted: boolean (default: true)
 *   - grouped: boolean (default: false) - if true, returns tasks grouped by date
 * 
 * Requirements: 14.1, 14.2, 14.3
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const groupedTasks = await taskService.getUpcomingGrouped(includeCompleted);
      return NextResponse.json(groupedTasks);
    }

    const tasks = await taskService.getUpcoming(includeCompleted);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch upcoming tasks',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
