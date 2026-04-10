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

describe('DomainEventEmitter.emitDynamic', () => {
  let emitter: DomainEventEmitter;
  let mockEe: ReturnType<typeof createMockEventEmitter>;
  let contextLogger: ReturnType<typeof createMockAppLogger>['contextLogger'];

  beforeEach(() => {
    mockEe = createMockEventEmitter();
    const mock = createMockAppLogger();
    contextLogger = mock.contextLogger;
    emitter = new DomainEventEmitter(mockEe, mock.appLogger);
  });

  it('should delegate to emitAsync with the dynamic event name', () => {
    emitter.emitDynamic('entities.TaskCreated', {
      entityType: 'task',
      entityId: 'task-1',
      actorId: 'user-1',
      payload: { title: 'My Task' },
    });

    expect(mockEe.emitAsync).toHaveBeenCalledWith(
      'entities.TaskCreated',
      expect.objectContaining({
        eventName: 'entities.TaskCreated',
        entityType: 'task',
        entityId: 'task-1',
        actorId: 'user-1',
        payload: { title: 'My Task' },
      }),
    );
  });

  it('should include correlationId and occurredAt like regular emit', () => {
    emitter.emitDynamic('entities.ProjectUpdated', {
      entityType: 'project',
      entityId: 'proj-42',
      actorId: null,
      payload: { status: 'active' },
    });

    const emittedEvent = mockEe.emitAsync.mock.calls[0][1];
    expect(emittedEvent.correlationId).toBeDefined();
    expect(emittedEvent.occurredAt).toBeDefined();
  });

  it('should handle null actorId', () => {
    emitter.emitDynamic('entities.SystemEvent', {
      entityType: 'system',
      entityId: 'sys-1',
      actorId: null,
      payload: {},
    });

    const emittedEvent = mockEe.emitAsync.mock.calls[0][1];
    expect(emittedEvent.actorId).toBeNull();
  });

  it('should not call synchronous emit (uses emitAsync)', () => {
    emitter.emitDynamic('entities.ItemDeleted', {
      entityType: 'item',
      entityId: 'item-99',
      actorId: 'user-5',
      payload: {},
    });

    expect(mockEe.emitAsync).toHaveBeenCalledTimes(1);
    expect(mockEe.emit).not.toHaveBeenCalled();
  });

  it('should catch and log async listener errors without throwing', async () => {
    const listenerError = new Error('Dynamic listener failed');
    mockEe.emitAsync.mockRejectedValue(listenerError);

    // Should NOT throw
    emitter.emitDynamic('entities.RecordCreated', {
      entityType: 'record',
      entityId: 'rec-1',
      actorId: 'user-1',
      payload: { field: 'value' },
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(contextLogger.error).toHaveBeenCalledWith(
      'Event listener failed',
      expect.objectContaining({
        eventName: 'entities.RecordCreated',
        entityType: 'record',
        entityId: 'rec-1',
        error: 'Dynamic listener failed',
      }),
      expect.stringContaining('Dynamic listener failed'),
    );
  });

  it('should pass arbitrary payload shapes through to the event', () => {
    const complexPayload = {
      before: { status: 'draft', priority: 1 },
      after: { status: 'published', priority: 2 },
      changedFields: ['status', 'priority'],
    };

    emitter.emitDynamic('entities.ArticleUpdated', {
      entityType: 'article',
      entityId: 'art-7',
      actorId: 'editor-3',
      payload: complexPayload,
    });

    const emittedEvent = mockEe.emitAsync.mock.calls[0][1];
    expect(emittedEvent.payload).toEqual(complexPayload);
  });
});
