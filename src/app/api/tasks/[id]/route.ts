import { NextRequest, NextResponse } from 'next/server';
import { taskService, TaskValidationError, TaskNotFoundError } from '@/lib/services/task.service';
import type { UpdateTaskInput, ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tasks/[id]
 * Returns a single task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
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

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch task',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/tasks/[id]
 * Updates a task
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    // Parse dates if provided as strings, handle null values
    const data: UpdateTaskInput = {
      ...body,
      date: body.date === null ? null : (body.date ? new Date(body.date) : undefined),
      deadline: body.deadline === null ? null : (body.deadline ? new Date(body.deadline) : undefined),
    };

    const task = await taskService.update(id, data);
    return NextResponse.json(task);
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

    if (error instanceof TaskValidationError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.errors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.error('Error updating task:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/tasks/[id]
 * Deletes a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    await taskService.delete(id);
    return new NextResponse(null, { status: 204 });
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

    console.error('Error deleting task:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
