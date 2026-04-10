import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentsCleanupListener } from '../attachments-cleanup.listener';
import type { AttachmentsService } from '../../services/attachments.service';
import type { DomainEvent } from '@packages/events';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function createMockAttachmentsService(): { softDeleteAllForEntity: ReturnType<typeof vi.fn> } {
  return {
    softDeleteAllForEntity: vi.fn().mockResolvedValue(undefined),
  };
}

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventName: 'candidates.Deleted',
    entityType: 'candidates',
    entityId: 'c-1',
    actorId: 'user-1',
    correlationId: 'corr-1',
    occurredAt: '2026-01-01T00:00:00Z',
    payload: {},
    ...overrides,
  };
}

describe('AttachmentsCleanupListener', () => {
  let listener: AttachmentsCleanupListener;
  let mockAttachmentsService: ReturnType<typeof createMockAttachmentsService>;
  let mockLogger: AppLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachmentsService = createMockAttachmentsService();
    mockLogger = createMockAppLogger();
    listener = new AttachmentsCleanupListener(
      mockAttachmentsService as unknown as AttachmentsService,
      mockLogger,
    );
  });

  it('cascades soft-delete when event name ends with .Deleted', async () => {
    await listener.handleDomainEvent(buildEvent());

    expect(mockAttachmentsService.softDeleteAllForEntity).toHaveBeenCalledWith(
      'candidates',
      'c-1',
      'user-1',
    );
  });

  it('ignores events that do not end with .Deleted', async () => {
    await listener.handleDomainEvent(buildEvent({
      eventName: 'candidates.CandidateCreated',
    }));

    expect(mockAttachmentsService.softDeleteAllForEntity).not.toHaveBeenCalled();
  });

  it('ignores events ending with Deleted but not .Deleted suffix', async () => {
    await listener.handleDomainEvent(buildEvent({
      eventName: 'candidates.CandidateDeleted',
    }));

    expect(mockAttachmentsService.softDeleteAllForEntity).not.toHaveBeenCalled();
  });

  it('handles .Updated events without cascading', async () => {
    await listener.handleDomainEvent(buildEvent({
      eventName: 'orders.OrderUpdated',
    }));

    expect(mockAttachmentsService.softDeleteAllForEntity).not.toHaveBeenCalled();
  });

  it('uses "system" as actorId when event has no actorId', async () => {
    await listener.handleDomainEvent(buildEvent({
      actorId: undefined,
    }));

    expect(mockAttachmentsService.softDeleteAllForEntity).toHaveBeenCalledWith(
      'candidates',
      'c-1',
      'system',
    );
  });

  it('does not throw when softDeleteAllForEntity fails', async () => {
    mockAttachmentsService.softDeleteAllForEntity.mockRejectedValueOnce(new Error('db down'));

    // Should not throw
    await listener.handleDomainEvent(buildEvent());

    expect(mockAttachmentsService.softDeleteAllForEntity).toHaveBeenCalled();
  });

  it('logs error when softDeleteAllForEntity fails', async () => {
    mockAttachmentsService.softDeleteAllForEntity.mockRejectedValueOnce(new Error('db down'));

    await listener.handleDomainEvent(buildEvent());

    const loggerCtx = (mockLogger.forContext as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(loggerCtx.error).toHaveBeenCalledWith(
      'Failed to cascade soft-delete attachments',
      expect.objectContaining({
        entityType: 'candidates',
        entityId: 'c-1',
        error: 'db down',
      }),
    );
  });

  it('works with different entity types', async () => {
    await listener.handleDomainEvent(buildEvent({
      eventName: 'jobs.Deleted',
      entityType: 'jobs',
      entityId: 'job-42',
      actorId: 'user-5',
    }));

    expect(mockAttachmentsService.softDeleteAllForEntity).toHaveBeenCalledWith(
      'jobs',
      'job-42',
      'user-5',
    );
  });
});
