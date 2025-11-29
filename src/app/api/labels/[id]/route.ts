import { NextRequest, NextResponse } from 'next/server';
import { 
  labelService, 
  LabelValidationError, 
  LabelNotFoundError 
} from '@/lib/services/label.service';
import type { UpdateLabelInput, ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/labels/[id]
 * Returns a single label by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const label = await labelService.getById(id);

    if (!label) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: `Label with id "${id}" not found`,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    return NextResponse.json(label);
  } catch (error) {
    console.error('Error fetching label:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch label',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * PUT /api/labels/[id]
 * Updates a label
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: UpdateLabelInput = {
      name: body.name,
      icon: body.icon,
    };

    const label = await labelService.update(id, data);
    return NextResponse.json(label);
  } catch (error) {
    if (error instanceof LabelNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    if (error instanceof LabelValidationError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.errors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.error('Error updating label:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update label',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/labels/[id]
 * Deletes a label (cascade removes from all tasks)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    await labelService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof LabelNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    console.error('Error deleting label:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete label',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
