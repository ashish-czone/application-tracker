import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from '../global-exception.filter';
import { runWithCorrelationId, type AppLoggerService } from '@packages/logger';

function createMockAppLogger() {
  const contextLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const appLogger = {
    forContext: vi.fn().mockReturnValue(contextLogger),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as AppLoggerService;
  return { appLogger, contextLogger };
}

function createMockHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status, json };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/test', method: 'GET' }),
    }),
  } as any;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let contextLogger: ReturnType<typeof createMockAppLogger>['contextLogger'];

  beforeEach(() => {
    const mock = createMockAppLogger();
    contextLogger = mock.contextLogger;
    filter = new GlobalExceptionFilter(mock.appLogger);
  });

  // --- Standard HttpExceptions ---

  it('should return consistent shape for NotFoundException', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new NotFoundException('Task not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Task not found',
    });
  });

  it('should return consistent shape for ConflictException', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new ConflictException('Email already in use'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'CONFLICT',
      message: 'Email already in use',
    });
  });

  it('should return consistent shape for UnauthorizedException', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new UnauthorizedException('Invalid or expired access token'), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Invalid or expired access token',
    });
  });

  it('should return consistent shape for ForbiddenException', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new ForbiddenException('Insufficient permissions'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
  });

  // --- ValidationPipe errors (BadRequestException with message array) ---

  it('should normalize ValidationPipe errors into details array', () => {
    const { host, status, json } = createMockHost();
    const exception = new BadRequestException({
      message: [
        'email must be an email',
        'firstName should not be empty',
      ],
      error: 'Bad Request',
    });
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
      details: [
        { field: 'email', message: 'email must be an email' },
        { field: 'firstName', message: 'firstName should not be empty' },
      ],
    });
  });

  it('should handle BadRequestException with a plain string message', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new BadRequestException('Invalid input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Invalid input',
    });
  });

  // --- 5xx logging via AppLoggerService ---

  it('should log server errors at error level', () => {
    const { host } = createMockHost();

    runWithCorrelationId('req-5xx', () => {
      filter.catch(new InternalServerErrorException('DB connection lost'), host);
    });

    expect(contextLogger.error).toHaveBeenCalledWith(
      'INTERNAL_SERVER_ERROR',
      expect.objectContaining({
        statusCode: 500,
        message: 'DB connection lost',
        method: 'GET',
        url: '/test',
      }),
      expect.any(String), // stack trace
    );
  });

  // --- Warn-level logging (401, 403, 429) ---

  it('should log UnauthorizedException at warn level', () => {
    const { host } = createMockHost();

    filter.catch(new UnauthorizedException('Invalid token'), host);

    expect(contextLogger.warn).toHaveBeenCalledWith(
      'UNAUTHORIZED',
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('should log ForbiddenException at warn level', () => {
    const { host } = createMockHost();

    filter.catch(new ForbiddenException('No permission'), host);

    expect(contextLogger.warn).toHaveBeenCalledWith(
      'FORBIDDEN',
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  it('should not log 400/404/409 at warn or error level', () => {
    const { host } = createMockHost();

    filter.catch(new BadRequestException('Bad input'), host);
    filter.catch(new NotFoundException('Not found'), host);
    filter.catch(new ConflictException('Conflict'), host);

    expect(contextLogger.error).not.toHaveBeenCalled();
    expect(contextLogger.warn).not.toHaveBeenCalled();
  });

  // --- Unknown exceptions ---

  it('should return 500 for non-HttpException errors', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new Error('Something broke'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should log non-HttpException errors via AppLoggerService', () => {
    const { host } = createMockHost();

    filter.catch(new Error('Unexpected crash'), host);

    expect(contextLogger.error).toHaveBeenCalledWith(
      'Unhandled exception',
      expect.objectContaining({ statusCode: 500, message: 'Unexpected crash' }),
      expect.any(String), // stack trace
    );
  });

  it('should hide error details in production for unknown exceptions', () => {
    const { host, json } = createMockHost();
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    filter.catch(new Error('secret DB info leak'), host);

    const body = json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(body.message).not.toContain('secret');

    process.env.NODE_ENV = original;
  });

  it('should expose error details in non-production for unknown exceptions', () => {
    const { host, json } = createMockHost();
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    filter.catch(new Error('debug info here'), host);

    const body = json.mock.calls[0][0];
    expect(body.message).toBe('debug info here');

    process.env.NODE_ENV = original;
  });

  it('should handle non-Error thrown values gracefully', () => {
    const { host, status, json } = createMockHost();
    filter.catch('a string was thrown', host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_SERVER_ERROR');
  });

  // --- Edge cases ---

  it('should handle HttpException with string response', () => {
    const { host, status, json } = createMockHost();
    filter.catch(new HttpException('Custom error', HttpStatus.I_AM_A_TEAPOT), host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({
      statusCode: 418,
      error: 'INTERNAL_SERVER_ERROR', // unmapped status falls back
      message: 'Custom error',
    });
  });

  it('should not include details key when there are no validation errors', () => {
    const { host, json } = createMockHost();
    filter.catch(new NotFoundException('Not found'), host);

    const body = json.mock.calls[0][0];
    expect(body).not.toHaveProperty('details');
  });
});
