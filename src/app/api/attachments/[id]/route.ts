import { NextRequest, NextResponse } from 'next/server';
import { 
  attachmentService, 
  AttachmentNotFoundError,
  FileStorageError 
} from '@/lib/services/attachment.service';
import type { ErrorResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/attachments/[id]
 * Downloads an attachment file
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    
    // Get attachment metadata
    const attachment = await attachmentService.getById(id);
    if (!attachment) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: `Attachment with id "${id}" not found`,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get file data
    const fileData = await attachmentService.getFileData(id);

    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(fileData), {
      status: 200,
      headers: {
        'Content-Type': attachment.fileType,
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': String(attachment.fileSize),
      },
    });
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) {
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

    console.error('Error downloading attachment:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to download attachment',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * DELETE /api/attachments/[id]
 * Deletes an attachment (both file and database record)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    await attachmentService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AttachmentNotFoundError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    console.error('Error deleting attachment:', error);
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete attachment',
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
