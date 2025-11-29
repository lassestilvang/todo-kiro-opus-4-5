import { NextRequest, NextResponse } from 'next/server';
import { labelService, LabelValidationError } from '@/lib/services/label.service';
import type { CreateLabelInput, ErrorResponse } from '@/types';

/**
 * GET /api/labels
 * Returns all labels
 */
export async function GET(): Promise<NextResponse> {
  try {
    const labels = await labelService.getAll();
    return NextResponse.json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch labels',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/labels
 * Creates a new label
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    const data: CreateLabelInput = {
      name: body.name,
      icon: body.icon,
    };

    const label = await labelService.create(data);
    return NextResponse.json(label, { status: 201 });
  } catch (error) {
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

    console.error('Error creating label:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create label',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
