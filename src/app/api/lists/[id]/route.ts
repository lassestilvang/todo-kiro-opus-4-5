import { NextRequest, NextResponse } from 'next/server';
import { 
  listService, 
  ListValidationError, 
  ListNotFoundError,
  InboxProtectionError 
} from '@/lib/services/list.service';
import type { UpdateListInput, ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/lists/[id]
 * Returns a single list by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const list = await listService.getById(id);

    if (!list) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: `List with id "${id}" not found`,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching list:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch list',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/lists/[id]
 * Updates a list
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: UpdateListInput = {
      name: body.name,
      color: body.color,
      emoji: body.emoji,
    };

    const list = await listService.update(id, data);
    return NextResponse.json(list);
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (error instanceof InboxProtectionError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    if (error instanceof ListValidationError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.errors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.error('Error updating list:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update list',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/lists/[id]
 * Deletes a list and migrates its tasks to Inbox
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    await listService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (error instanceof InboxProtectionError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 409 });
    }

    console.error('Error deleting list:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete list',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
