import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppLoggerService } from '../logger.service';
import type { LoggerProvider } from '../../types';
import { runWithCorrelationId } from '../../correlation/store';

function createMockProvider(): LoggerProvider {
  return {
    name: 'mock',
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe('AppLoggerService', () => {
  let provider: LoggerProvider;
  let service: AppLoggerService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new AppLoggerService(provider);
  });

  it('should delegate log() to the provider with enriched context', () => {
    runWithCorrelationId('req-abc', () => {
      service.log('test message', { orderId: '123' });
    });

    expect(provider.log).toHaveBeenCalledWith('test message', {
      correlationId: 'req-abc',
      orderId: '123',
    });
  });

  it('should delegate warn() to the provider', () => {
    runWithCorrelationId('req-def', () => {
      service.warn('warning message');
    });

    expect(provider.warn).toHaveBeenCalledWith('warning message', {
      correlationId: 'req-def',
    });
  });

  it('should delegate error() to the provider with trace', () => {
    runWithCorrelationId('req-ghi', () => {
      service.error('error message', { code: 500 }, 'stack trace');
    });

    expect(provider.error).toHaveBeenCalledWith(
      'error message',
      { correlationId: 'req-ghi', code: 500 },
      'stack trace',
    );
  });

  it('should delegate debug() to the provider', () => {
    runWithCorrelationId('req-jkl', () => {
      service.debug('debug message', { query: 'SELECT 1' });
    });

    expect(provider.debug).toHaveBeenCalledWith('debug message', {
      correlationId: 'req-jkl',
      query: 'SELECT 1',
    });
  });

  it('should auto-generate correlationId outside request context', () => {
    service.log('background task');

    const call = (provider.log as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('ContextLogger', () => {
  let provider: LoggerProvider;
  let service: AppLoggerService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new AppLoggerService(provider);
  });

  it('should include context name in every log entry', () => {
    const logger = service.forContext('TasksService');

    runWithCorrelationId('req-ctx', () => {
      logger.log('task created', { taskId: '1' });
    });

    expect(provider.log).toHaveBeenCalledWith('task created', {
      correlationId: 'req-ctx',
      context: 'TasksService',
      taskId: '1',
    });
  });

  it('should include context in error logs with trace', () => {
    const logger = service.forContext('AuthGuard');

    runWithCorrelationId('req-err', () => {
      logger.error('auth failed', { userId: 'u1' }, 'Error: token expired\n  at ...');
    });

    expect(provider.error).toHaveBeenCalledWith(
      'auth failed',
      { correlationId: 'req-err', context: 'AuthGuard', userId: 'u1' },
      'Error: token expired\n  at ...',
    );
  });
});
