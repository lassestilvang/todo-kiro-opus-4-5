import { NextRequest, NextResponse } from 'next/server';
import { listService, ListValidationError } from '@/lib/services/list.service';
import type { CreateListInput, ErrorResponse } from '@/types';

/**
 * GET /api/lists
 * Returns all lists with Inbox first
 */
export async function GET(): Promise<NextResponse> {
  try {
    const lists = await listService.getAll();
    return NextResponse.json(lists);
  } catch (error) {
    console.error('Error fetching lists:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch lists',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * POST /api/lists
 * Creates a new list
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    const data: CreateListInput = {
      name: body.name,
      color: body.color,
      emoji: body.emoji,
    };

    const list = await listService.create(data);
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
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

    console.error('Error creating list:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create list',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
