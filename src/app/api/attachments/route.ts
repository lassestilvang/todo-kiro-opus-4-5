import { NextRequest, NextResponse } from 'next/server';
import { 
  attachmentService, 
  TaskNotFoundError,
  FileStorageError 
} from '@/lib/services/attachment.service';
import type { ErrorResponse } from '@/types';

/**
 * POST /api/attachments
 * Uploads a file attachment (multipart form data)
 * Form fields:
 *   - taskId: string (required)
 *   - file: File (required)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const taskId = formData.get('taskId');
    const file = formData.get('file');

    // Validate taskId
    if (!taskId || typeof taskId !== 'string') {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task ID is required',
          details: { taskId: ['Task ID is required'] },
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Validate file
    if (!file || !(file instanceof File)) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File is required',
          details: { file: ['File is required'] },
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileData = Buffer.from(arrayBuffer);

    const attachment = await attachmentService.create({
      taskId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileData,
    });

    return NextResponse.json(attachment, { status: 201 });
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

    if (error instanceof FileStorageError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'FILE_STORAGE_ERROR',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 500 });
    }

    console.error('Error uploading attachment:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload attachment',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
