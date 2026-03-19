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
import { runWithCorrelationId } from '@packages/logger';

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

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
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

  // --- 5xx logging ---

  it('should log server errors at error level with correlationId', () => {
    const { host } = createMockHost();
    const logSpy = vi.spyOn((filter as any).logger, 'error').mockImplementation(() => {});

    runWithCorrelationId('req-5xx', () => {
      filter.catch(new InternalServerErrorException('DB connection lost'), host);
    });

    expect(logSpy).toHaveBeenCalled();
    const [context] = logSpy.mock.calls[0];
    expect(context).toMatchObject({
      correlationId: 'req-5xx',
      statusCode: 500,
      message: 'DB connection lost',
      method: 'GET',
      url: '/test',
    });
  });

  // --- Warn-level logging (401, 403, 429) ---

  it('should log UnauthorizedException at warn level', () => {
    const { host } = createMockHost();
    const warnSpy = vi.spyOn((filter as any).logger, 'warn').mockImplementation(() => {});

    runWithCorrelationId('req-401', () => {
      filter.catch(new UnauthorizedException('Invalid token'), host);
    });

    expect(warnSpy).toHaveBeenCalled();
    const [context] = warnSpy.mock.calls[0];
    expect(context).toMatchObject({
      correlationId: 'req-401',
      statusCode: 401,
    });
  });

  it('should log ForbiddenException at warn level', () => {
    const { host } = createMockHost();
    const warnSpy = vi.spyOn((filter as any).logger, 'warn').mockImplementation(() => {});

    runWithCorrelationId('req-403', () => {
      filter.catch(new ForbiddenException('No permission'), host);
    });

    expect(warnSpy).toHaveBeenCalled();
    const [context] = warnSpy.mock.calls[0];
    expect(context).toMatchObject({
      correlationId: 'req-403',
      statusCode: 403,
    });
  });

  it('should not log 400/404/409 at warn or error level', () => {
    const { host } = createMockHost();
    const errorSpy = vi.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn((filter as any).logger, 'warn').mockImplementation(() => {});

    filter.catch(new BadRequestException('Bad input'), host);
    filter.catch(new NotFoundException('Not found'), host);
    filter.catch(new ConflictException('Conflict'), host);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
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

  it('should log non-HttpException errors with correlationId', () => {
    const { host } = createMockHost();
    const logSpy = vi.spyOn((filter as any).logger, 'error').mockImplementation(() => {});

    runWithCorrelationId('req-crash', () => {
      filter.catch(new Error('Unexpected crash'), host);
    });

    expect(logSpy).toHaveBeenCalled();
    const [context] = logSpy.mock.calls[0];
    expect(context).toMatchObject({
      correlationId: 'req-crash',
      statusCode: 500,
      message: 'Unexpected crash',
    });
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
