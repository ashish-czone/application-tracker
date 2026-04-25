import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Test-time exception filter mirroring the production GlobalExceptionFilter
 * (in `@packages/app-shell`) closely enough that integration tests assert
 * against the same HTTP envelopes apps emit:
 *
 *  - ZodError instances → 400 with `details: [{ field, message }]`
 *  - HttpException with object response → status code passes through, plus
 *    any non-reserved keys on the exception body (e.g. domain `code`,
 *    `fields`) so callers can attach error metadata.
 *  - Anything else → 500 with the message in dev (we don't gate on
 *    NODE_ENV here — tests want to see the error).
 *
 * Lives inside platform-testing because adding `@packages/app-shell` to
 * platform-testing's deps creates a cycle (app-shell already depends on
 * packages whose tests use platform-testing).
 */

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
  [key: string]: unknown;
}

const RESERVED_KEYS = new Set(['statusCode', 'error', 'message', 'details']);

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

function asZodError(
  exception: unknown,
): { issues: { path: (string | number)[]; message: string }[] } | undefined {
  if (
    exception !== null &&
    typeof exception === 'object' &&
    (exception as { name?: string }).name === 'ZodError' &&
    Array.isArray((exception as { issues?: unknown }).issues)
  ) {
    return exception as { issues: { path: (string | number)[]; message: string }[] };
  }
  return undefined;
}

@Catch()
@Injectable()
export class TestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const zodError = asZodError(exception);
    if (zodError) {
      const status = HttpStatus.BAD_REQUEST;
      response.status(status).json({
        statusCode: status,
        error: errorCodeFromStatus(status),
        message: 'Validation failed',
        details: zodError.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      } satisfies ErrorResponseBody);
      return;
    }

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
        if (Array.isArray(res.message)) {
          body.message = 'Validation failed';
          body.details = res.message.map((m) => ({ field: 'unknown', message: String(m) }));
        } else {
          body.message = (res.message as string) ?? exception.message;
        }
        for (const [key, value] of Object.entries(res)) {
          if (!RESERVED_KEYS.has(key)) body[key] = value;
        }
      }

      response.status(status).json(body);
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message,
    } satisfies ErrorResponseBody);
  }
}
