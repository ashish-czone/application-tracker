import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainEventEmitter } from '../domain-event-emitter.service';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger() {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    appLogger: { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLoggerService,
    contextLogger: ctx,
  };
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
    emitAsync: vi.fn().mockResolvedValue([]),
  } as any;
}

describe('DomainEventEmitter', () => {
  let emitter: DomainEventEmitter;
  let mockEe: ReturnType<typeof createMockEventEmitter>;
  let contextLogger: ReturnType<typeof createMockAppLogger>['contextLogger'];

  beforeEach(() => {
    mockEe = createMockEventEmitter();
    const mock = createMockAppLogger();
    contextLogger = mock.contextLogger;
    emitter = new DomainEventEmitter(mockEe, mock.appLogger);
  });

  it('should call emitAsync instead of emit', () => {
    emitter.emit('test.Event' as any, {
      entityType: 'test',
      entityId: '1',
      actorId: 'actor-1',
      payload: {} as any,
    });

    expect(mockEe.emitAsync).toHaveBeenCalledWith(
      'test.Event',
      expect.objectContaining({
        eventName: 'test.Event',
        entityType: 'test',
        entityId: '1',
        actorId: 'actor-1',
      }),
    );
    expect(mockEe.emit).not.toHaveBeenCalled();
  });

  it('should include correlationId and occurredAt in emitted event', () => {
    emitter.emit('test.Event' as any, {
      entityType: 'test',
      entityId: '1',
      actorId: null,
      payload: {} as any,
    });

    const emittedEvent = mockEe.emitAsync.mock.calls[0][1];
    expect(emittedEvent.correlationId).toMatch(/^[0-9a-f]{8}-/);
    expect(emittedEvent.occurredAt).toBeDefined();
  });

  it('should catch async listener errors and log them without throwing', async () => {
    const listenerError = new Error('Listener blew up');
    mockEe.emitAsync.mockRejectedValue(listenerError);

    // This should NOT throw
    emitter.emit('test.Event' as any, {
      entityType: 'test',
      entityId: '1',
      actorId: 'actor-1',
      payload: {} as any,
    });

    // Wait for the catch handler to run
    await new Promise((r) => setTimeout(r, 10));

    expect(contextLogger.error).toHaveBeenCalledWith(
      'Event listener failed',
      expect.objectContaining({
        eventName: 'test.Event',
        entityType: 'test',
        entityId: '1',
        error: 'Listener blew up',
      }),
      expect.stringContaining('Listener blew up'),
    );
  });

  it('should handle non-Error rejections from listeners', async () => {
    mockEe.emitAsync.mockRejectedValue('string error');

    emitter.emit('test.Event' as any, {
      entityType: 'test',
      entityId: '1',
      actorId: null,
      payload: {} as any,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(contextLogger.error).toHaveBeenCalledWith(
      'Event listener failed',
      expect.objectContaining({ error: 'string error' }),
      undefined,
    );
  });
});
