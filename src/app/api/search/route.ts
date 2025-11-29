import { NextRequest, NextResponse } from 'next/server';
import { searchService } from '@/lib/services/search.service';
import type { ErrorResponse } from '@/types';

/**
 * GET /api/search?q=query
 * Searches for tasks using fuzzy matching
 * Query params:
 *   - q: search query string (required)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    // Return empty array for empty query (Requirement 17.4)
    if (!query || query.trim() === '') {
      return NextResponse.json([]);
    }

    const tasks = await searchService.search(query);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error searching tasks:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search tasks',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
