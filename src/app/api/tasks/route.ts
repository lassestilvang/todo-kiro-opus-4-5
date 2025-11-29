import { NextRequest, NextResponse } from 'next/server';
import { taskService, TaskValidationError } from '@/lib/services/task.service';
import type { CreateTaskInput, ErrorResponse } from '@/types';

/**
 * GET /api/tasks
 * Returns all tasks with optional filtering
 * Query params:
 *   - includeCompleted: boolean (default: true)
 *   - listId: string (optional, filter by list)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';
    const listId = searchParams.get('listId');

    let tasks;
    if (listId) {
      tasks = await taskService.getByListId(listId, includeCompleted);
    } else {
      tasks = await taskService.getAll(includeCompleted);
    }

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tasks',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/tasks
 * Creates a new task
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Parse dates if provided as strings
    const data: CreateTaskInput = {
      ...body,
      date: body.date ? new Date(body.date) : undefined,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    };

    const task = await taskService.create(data);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
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

    console.error('Error creating task:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
