import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/lib/services/task.service';
import type { ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]/history
 * Returns the history of changes for a task
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    
    // First check if task exists
    const task = await taskService.getById(id);
    if (!task) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: `Task with id "${id}" not found`,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    const history = await taskService.getHistory(id);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching task history:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task history',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
