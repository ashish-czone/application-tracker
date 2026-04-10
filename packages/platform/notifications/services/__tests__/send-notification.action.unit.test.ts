import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendNotificationAction } from '../send-notification.action';
import { TemplateRenderer } from '../template-renderer';
import type { ActionContext, AutomationRule } from '@packages/automations';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    rule: { id: 'rule-1', name: 'Test' } as AutomationRule,
    actionIndex: 0,
    actionConfig: {
      type: 'send_notification',
      config: {
        channels: [{ channel: 'email', templateId: 'tmpl-1' }],
      },
      users: { recipient: { strategy: 'actor' } },
    },
    event: {
      eventName: 'tasks.TaskCreated',
      entityType: 'tasks',
      entityId: 'task-1',
      actorId: 'actor-1',
      correlationId: 'corr-1',
      payload: { name: 'Test Task' },
    },
    resolvedUsers: { recipient: ['user-1'] },
    ...overrides,
  };
}

describe('SendNotificationAction', () => {
  let action: SendNotificationAction;
  let mockDispatcher: { dispatch: ReturnType<typeof vi.fn> };
  let mockPreference: { isEnabled: ReturnType<typeof vi.fn> };
  let mockDb: any;

  beforeEach(() => {
    mockDispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
    mockPreference = { isEnabled: vi.fn().mockResolvedValue(true) };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'tmpl-1',
        name: 'Welcome',
        channel: 'email',
        subject: 'Hello {{payload.name}}',
        body: 'Welcome {{payload.name}}!',
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
    };
    mockDb = { db: { select: vi.fn().mockReturnValue(mockSelectChain) } };

    action = new SendNotificationAction(
      mockDispatcher as any,
      new TemplateRenderer(),
      mockPreference as any,
      mockDb as any,
      createMockAppLogger(),
    );
  });

  it('should have correct type and metadata', () => {
    expect(action.type).toBe('send_notification');
    expect(action.label).toBe('Send Notification');
    expect(action.userSlots).toHaveLength(1);
    expect(action.userSlots[0].name).toBe('recipient');
  });

  it('should dispatch notification to each recipient for each channel', async () => {
    await action.execute(buildContext());

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'email',
      'user-1',
      expect.objectContaining({
        subject: 'Hello Test Task',
        body: 'Welcome Test Task!',
      }),
      expect.objectContaining({ eventName: 'tasks.TaskCreated' }),
    );
  });

  it('should skip when no channels configured', async () => {
    await action.execute(buildContext({
      actionConfig: { type: 'send_notification', config: { channels: [] } },
    }));

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should skip when no recipients resolved', async () => {
    await action.execute(buildContext({ resolvedUsers: { recipient: [] } }));

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should skip recipient when preference is disabled', async () => {
    mockPreference.isEnabled.mockResolvedValue(false);

    await action.execute(buildContext());

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should dispatch to multiple recipients', async () => {
    await action.execute(buildContext({
      resolvedUsers: { recipient: ['user-1', 'user-2'] },
    }));

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('should dispatch to multiple channels', async () => {
    await action.execute(buildContext({
      actionConfig: {
        type: 'send_notification',
        config: {
          channels: [
            { channel: 'email', templateId: 'tmpl-1' },
            { channel: 'in_app', templateId: 'tmpl-1' },
          ],
        },
      },
    }));

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
  });
});
