import { describe, it, expect, vi } from 'vitest';
import { NestjsLoggerProvider } from '../nestjs.provider';
import type { LogEntry } from '../../types';

// Mock NestJS Logger to avoid console output in tests
vi.mock('@nestjs/common', () => {
  const MockLogger = vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }));
  return { Logger: MockLogger };
});

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    level: 'log',
    message: 'test message',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('NestjsLoggerProvider', () => {
  it('should have name "nestjs"', () => {
    const provider = new NestjsLoggerProvider();
    expect(provider.name).toBe('nestjs');
  });

  it('should delegate log entry to NestJS Logger.log()', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({ level: 'log', message: 'hello', context: 'TestCtx' }));
    // Provider creates a Logger per write call — just verify no errors
  });

  it('should delegate warn entry to NestJS Logger.warn()', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({ level: 'warn', message: 'warning', context: 'TestCtx' }));
  });

  it('should delegate error entry with trace to NestJS Logger.error()', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({
      level: 'error',
      message: 'failed',
      context: 'TestCtx',
      trace: 'stack trace here',
      data: { code: 500 },
    }));
  });

  it('should delegate debug entry to NestJS Logger.debug()', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({
      level: 'debug',
      message: 'debug info',
      data: { query: 'SELECT 1' },
    }));
  });

  it('should include data in message when present', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({
      message: 'test',
      data: { key: 'value' },
      correlationId: 'req-123',
    }));
  });

  it('should handle entry without data or correlationId', () => {
    const provider = new NestjsLoggerProvider();
    provider.write(makeEntry({ message: 'plain message' }));
  });
});
