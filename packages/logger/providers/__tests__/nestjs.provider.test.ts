import { describe, it, expect, vi } from 'vitest';
import { NestjsLoggerProvider } from '../nestjs.provider';

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

describe('NestjsLoggerProvider', () => {
  it('should have name "nestjs"', () => {
    const provider = new NestjsLoggerProvider('TestContext');
    expect(provider.name).toBe('nestjs');
  });

  it('should delegate log with context object', () => {
    const provider = new NestjsLoggerProvider('TestContext');
    provider.log('test message', { key: 'value' });

    const logger = (provider as any).logger;
    expect(logger.log).toHaveBeenCalledWith({ key: 'value' }, 'test message');
  });

  it('should delegate log without context', () => {
    const provider = new NestjsLoggerProvider('TestContext');
    provider.log('plain message');

    const logger = (provider as any).logger;
    expect(logger.log).toHaveBeenCalledWith('plain message');
  });

  it('should delegate warn with context object', () => {
    const provider = new NestjsLoggerProvider();
    provider.warn('warning', { detail: 'info' });

    const logger = (provider as any).logger;
    expect(logger.warn).toHaveBeenCalledWith({ detail: 'info' }, 'warning');
  });

  it('should delegate error with context and trace', () => {
    const provider = new NestjsLoggerProvider();
    provider.error('failed', { code: 500 }, 'stack trace here');

    const logger = (provider as any).logger;
    expect(logger.error).toHaveBeenCalledWith({ code: 500 }, 'stack trace here');
  });

  it('should delegate error without context', () => {
    const provider = new NestjsLoggerProvider();
    provider.error('simple error');

    const logger = (provider as any).logger;
    expect(logger.error).toHaveBeenCalledWith('simple error', undefined);
  });

  it('should delegate debug with context object', () => {
    const provider = new NestjsLoggerProvider();
    provider.debug('debug info', { query: 'SELECT 1' });

    const logger = (provider as any).logger;
    expect(logger.debug).toHaveBeenCalledWith({ query: 'SELECT 1' }, 'debug info');
  });
});
