import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task.service';
import type { ErrorResponse } from '@/types';

/**
 * GET /api/tasks/next7days
 * Returns tasks for the next 7 days (from today through 7 days ahead)
 * Query params:
 *   - includeCompleted: boolean (default: true)
 *   - grouped: boolean (default: false) - if true, returns tasks grouped by date
 * 
 * Requirements: 13.1, 13.2, 13.3
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';
    const grouped = searchParams.get('grouped') === 'true';

    if (grouped) {
      const groupedTasks = await taskService.getNext7DaysGrouped(includeCompleted);
      return NextResponse.json(groupedTasks);
    }

    const tasks = await taskService.getNext7Days(includeCompleted);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching next 7 days tasks:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch next 7 days tasks',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
