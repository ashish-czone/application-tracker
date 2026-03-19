import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

const STATUS_CODE_TO_ERROR: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

function errorCodeFromStatus(status: number): string {
  return STATUS_CODE_TO_ERROR[status] ?? 'INTERNAL_SERVER_ERROR';
}

/**
 * Parses class-validator messages like "email must be an email" into
 * { field, message } tuples. Falls back to field "unknown" when the
 * first word does not look like a field name.
 */
function parseValidationMessages(
  messages: string[],
): { field: string; message: string }[] {
  return messages.map((msg) => {
    const spaceIndex = msg.indexOf(' ');
    if (spaceIndex === -1) {
      return { field: 'unknown', message: msg };
    }
    const field = msg.slice(0, spaceIndex);
    return { field, message: msg };
  });
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const body: ErrorResponseBody = {
        statusCode: status,
        error: errorCodeFromStatus(status),
        message: '',
      };

      if (typeof exceptionResponse === 'string') {
        body.message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;

        // ValidationPipe returns { message: string[] } for validation errors
        if (Array.isArray(res.message)) {
          body.message = 'Validation failed';
          body.details = parseValidationMessages(res.message as string[]);
        } else {
          body.message = (res.message as string) ?? exception.message;
        }
      }

      // Log 5xx server errors with full stack
      if (status >= 500) {
        this.logger.error(
          { statusCode: status, message: body.message },
          exception.stack ?? 'HttpException (5xx)',
        );
      }

      response.status(status).json(body);
      return;
    }

    // Unknown / unhandled exception → 500
    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    const stack =
      exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      { statusCode: 500, message },
      stack ?? 'Unhandled exception',
    );

    const body: ErrorResponseBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : message,
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}
