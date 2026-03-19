import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppLoggerService } from '../logger.service';
import type { LoggerProvider, LogEntry } from '../../types';
import { runWithCorrelationId } from '../../correlation/store';

function createMockProvider(): LoggerProvider & { write: ReturnType<typeof vi.fn> } {
  return {
    name: 'mock',
    write: vi.fn(),
  };
}

describe('AppLoggerService', () => {
  let provider: ReturnType<typeof createMockProvider>;
  let service: AppLoggerService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new AppLoggerService(provider);
  });

  it('should build a LogEntry with enriched context and delegate to provider.write()', () => {
    runWithCorrelationId('req-abc', () => {
      service.log('test message', { orderId: '123' });
    });

    expect(provider.write).toHaveBeenCalledTimes(1);
    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.level).toBe('log');
    expect(entry.message).toBe('test message');
    expect(entry.correlationId).toBe('req-abc');
    expect(entry.data).toEqual({ orderId: '123' });
    expect(entry.timestamp).toBeDefined();
  });

  it('should set level to warn for warn()', () => {
    runWithCorrelationId('req-def', () => {
      service.warn('warning message');
    });

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('warning message');
    expect(entry.correlationId).toBe('req-def');
  });

  it('should include trace in error()', () => {
    runWithCorrelationId('req-ghi', () => {
      service.error('error message', { code: 500 }, 'stack trace');
    });

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('error message');
    expect(entry.trace).toBe('stack trace');
    expect(entry.data).toEqual({ code: 500 });
  });

  it('should set level to debug for debug()', () => {
    runWithCorrelationId('req-jkl', () => {
      service.debug('debug message', { query: 'SELECT 1' });
    });

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.level).toBe('debug');
    expect(entry.data).toEqual({ query: 'SELECT 1' });
  });

  it('should auto-generate correlationId outside request context', () => {
    service.log('background task');

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});

describe('ContextLogger', () => {
  let provider: ReturnType<typeof createMockProvider>;
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

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.context).toBe('TasksService');
    expect(entry.message).toBe('task created');
    expect(entry.correlationId).toBe('req-ctx');
    expect(entry.data).toEqual({ taskId: '1' });
  });

  it('should include context and trace in error logs', () => {
    const logger = service.forContext('AuthGuard');

    runWithCorrelationId('req-err', () => {
      logger.error('auth failed', { userId: 'u1' }, 'Error: token expired\n  at ...');
    });

    const entry: LogEntry = provider.write.mock.calls[0][0];
    expect(entry.level).toBe('error');
    expect(entry.context).toBe('AuthGuard');
    expect(entry.trace).toBe('Error: token expired\n  at ...');
    expect(entry.data).toEqual({ userId: 'u1' });
  });
});
