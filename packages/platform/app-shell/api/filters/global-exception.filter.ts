import {
  type ExceptionFilter,
  Catch,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
  /** Extra fields passed through from `HttpException` response objects. */
  [key: string]: unknown;
}

/** Keys the filter owns; everything else on a custom exception body is preserved. */
const RESERVED_KEYS = new Set(['statusCode', 'error', 'message', 'details']);

/**
 * Detects a Zod validation error without importing zod into app-shell.
 * `ZodError` instances expose `.issues` (array of `{ code, path, message }`)
 * and identify themselves via `.name === 'ZodError'`. We treat any error
 * matching that shape as a 400.
 */
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

const WARN_STATUS_CODES = new Set([
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.TOO_MANY_REQUESTS,
]);

function errorCodeFromStatus(status: number): string {
  return STATUS_CODE_TO_ERROR[status] ?? 'INTERNAL_SERVER_ERROR';
}

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
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: ContextLogger;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const method = request?.method;
    const url = request?.url;

    const zodError = asZodError(exception);
    if (zodError) {
      const status = HttpStatus.BAD_REQUEST;
      const body: ErrorResponseBody = {
        statusCode: status,
        error: errorCodeFromStatus(status),
        message: 'Validation failed',
        details: zodError.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          message: issue.message,
        })),
      };
      response.status(status).json(body);
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
          body.details = parseValidationMessages(res.message as string[]);
        } else {
          body.message = (res.message as string) ?? exception.message;
        }
        // Preserve any extra metadata callers attach to the exception body
        // (e.g. domain error code, affected fields). The reserved keys are
        // already handled above.
        for (const [key, value] of Object.entries(res)) {
          if (!RESERVED_KEYS.has(key)) body[key] = value;
        }
      }

      const logContext = { statusCode: status, method, url, message: body.message };
      if (status >= 500) {
        this.logger.error(body.error, logContext, exception.stack);
      } else if (WARN_STATUS_CODES.has(status)) {
        this.logger.warn(body.error, logContext);
      }

      response.status(status).json(body);
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    const stack =
      exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      'Unhandled exception',
      { statusCode: 500, method, url, message },
      stack,
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
