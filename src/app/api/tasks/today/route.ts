import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task.service';
import type { ErrorResponse } from '@/types';

/**
 * GET /api/tasks/today
 * Returns tasks scheduled for today
 * Query params:
 *   - includeCompleted: boolean (default: true)
 * 
 * Requirements: 12.1, 12.2
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';

    const tasks = await taskService.getToday(includeCompleted);

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching today\'s tasks:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch today\'s tasks',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
