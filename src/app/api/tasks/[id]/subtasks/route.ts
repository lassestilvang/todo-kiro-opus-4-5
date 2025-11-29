import { NextRequest, NextResponse } from 'next/server';
import { taskService, TaskNotFoundError } from '@/lib/services/task.service';
import type { ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/subtasks
 * Adds a subtask to a task
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Subtask name is required',
          details: { name: ['Name is required'] },
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const subtask = await taskService.addSubtask(id, body.name);
    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    console.error('Error adding subtask:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add subtask',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
