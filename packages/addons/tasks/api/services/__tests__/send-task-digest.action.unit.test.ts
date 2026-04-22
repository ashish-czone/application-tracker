import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SendTaskDigestAction } from '../send-task-digest.action';
import type { ActionContext, AutomationRule } from '@packages/automation-contracts';
import type { AppLoggerService } from '@packages/logger';
import type { NotificationTemplate } from '@packages/notifications';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: (_table: unknown, ...conditions: unknown[]) => conditions,
}));

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function buildTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 'tmpl-digest',
    name: 'task-daily-digest',
    channel: 'email',
    subject: 'Your task digest ({{totalCount}})',
    body: [
      '{{#hasOverdue}}OVERDUE:{{#sections.overdue}} {{title}}({{dueDate}});{{/sections.overdue}}{{/hasOverdue}}',
      '{{#hasToday}}TODAY:{{#sections.today}} {{title}}({{dueDate}});{{/sections.today}}{{/hasToday}}',
      '{{#hasThisWeek}}WEEK:{{#sections.thisWeek}} {{title}}({{dueDate}});{{/sections.thisWeek}}{{/hasThisWeek}}',
    ].join('\n'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    rule: { id: 'rule-digest', name: 'task-daily-digest' } as AutomationRule,
    actionIndex: 0,
    actionConfig: {
      type: 'send_task_digest',
      config: { channels: [{ channel: 'email', templateId: 'tmpl-digest' }] },
      users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
    },
    event: {
      eventName: 'schedule.users',
      entityType: 'users',
      entityId: 'user-1',
      actorId: null,
      correlationId: 'corr-digest',
      payload: {},
    },
    resolvedUsers: { recipient: ['user-1'] },
    ...overrides,
  };
}

/**
 * The action makes a single Drizzle `.select()...from()...where()` — the chain
 * resolves to `taskRows`. We don't exercise withTenant (mocked above), and we
 * don't exercise the sub-query SQL literal — we trust Drizzle composition and
 * verify at the application level that the action buckets rows correctly.
 */
function buildMocks(taskRows: Array<{ id: string; title: string; dueDate: string | null }>) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(taskRows);
  const db = { select: vi.fn().mockReturnValue(chain) };

  const templatesService = {
    findByIdOrFail: vi.fn().mockResolvedValue(buildTemplate()),
  };
  const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
  const preferenceService = { isEnabled: vi.fn().mockResolvedValue(true) };

  return { db: { db } as any, templatesService, dispatcher, preferenceService };
}

describe('SendTaskDigestAction', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let action: SendTaskDigestAction;

  beforeEach(() => {
    // Pin today = 2026-03-18 UTC so string date comparisons are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
    // Keep APP_TIMEZONE at its real value (undefined → UTC) so todayInTimezone
    // returns '2026-03-18'.
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function instantiate(taskRows: Array<{ id: string; title: string; dueDate: string | null }>) {
    mocks = buildMocks(taskRows);
    action = new SendTaskDigestAction(
      mocks.db,
      mocks.templatesService as any,
      mocks.dispatcher as any,
      mocks.preferenceService as any,
      createMockAppLogger(),
    );
  }

  it('does nothing when no recipients resolved', async () => {
    instantiate([]);
    await action.execute(buildContext({ resolvedUsers: { recipient: [] } }));
    expect(mocks.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('does nothing when action config lists no channels', async () => {
    instantiate([]);
    await action.execute(buildContext({
      actionConfig: {
        type: 'send_task_digest',
        config: {},
        users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
      },
    }));
    expect(mocks.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('short-circuits when every bucket is empty (no digest sent)', async () => {
    instantiate([]);
    await action.execute(buildContext());
    expect(mocks.dispatcher.dispatch).not.toHaveBeenCalled();
    // Templates not loaded either — we bail before touching them.
    expect(mocks.templatesService.findByIdOrFail).not.toHaveBeenCalled();
  });

  it('buckets tasks into overdue / today / this week by due date', async () => {
    instantiate([
      { id: 't1', title: 'Old', dueDate: '2026-03-10' }, // overdue
      { id: 't2', title: 'Today', dueDate: '2026-03-18' }, // today
      { id: 't3', title: 'Soon', dueDate: '2026-03-22' }, // this week
    ]);
    await action.execute(buildContext());

    expect(mocks.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [, recipientId, content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(recipientId).toBe('user-1');
    expect(content.subject).toBe('Your task digest (3)');
    expect(content.body).toContain('OVERDUE: Old(2026-03-10)');
    expect(content.body).toContain('TODAY: Today(2026-03-18)');
    expect(content.body).toContain('WEEK: Soon(2026-03-22)');
  });

  it('omits empty sections from the rendered body', async () => {
    instantiate([
      { id: 't1', title: 'Today only', dueDate: '2026-03-18' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).not.toContain('OVERDUE:');
    expect(content.body).not.toContain('WEEK:');
    expect(content.body).toContain('TODAY: Today only(2026-03-18)');
  });

  it('sorts each section by due date then title', async () => {
    instantiate([
      { id: 't1', title: 'Zulu', dueDate: '2026-03-10' },
      { id: 't2', title: 'Alpha', dueDate: '2026-03-10' },
      { id: 't3', title: 'Bravo', dueDate: '2026-03-11' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    const overdue = content.body.split('\n').find((l: string) => l.startsWith('OVERDUE:'));
    expect(overdue).toBe('OVERDUE: Alpha(2026-03-10); Zulu(2026-03-10); Bravo(2026-03-11);');
  });

  it('skips tasks whose dueDate is null', async () => {
    instantiate([
      { id: 't1', title: 'Dateless', dueDate: null },
      { id: 't2', title: 'Real', dueDate: '2026-03-18' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).not.toContain('Dateless');
    expect(content.body).toContain('Real');
  });

  it('skips a channel when preference is disabled but still runs others', async () => {
    instantiate([{ id: 't1', title: 'X', dueDate: '2026-03-18' }]);
    mocks.preferenceService.isEnabled = vi.fn()
      .mockResolvedValueOnce(false) // email disabled
      .mockResolvedValueOnce(true); // in_app enabled

    await action.execute(buildContext({
      actionConfig: {
        type: 'send_task_digest',
        config: {
          channels: [
            { channel: 'email', templateId: 'tmpl-digest' },
            { channel: 'in_app', templateId: 'tmpl-digest' },
          ],
        },
        users: { recipient: { strategy: 'entity_field', config: { field: 'id' } } },
      },
    }));

    expect(mocks.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatcher.dispatch.mock.calls[0][0]).toBe('in_app');
  });

  it('skips a channel when its template cannot be loaded', async () => {
    instantiate([{ id: 't1', title: 'X', dueDate: '2026-03-18' }]);
    mocks.templatesService.findByIdOrFail = vi.fn().mockRejectedValue(new Error('not found'));

    await action.execute(buildContext());

    expect(mocks.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('skips empty digests per-recipient when one recipient has no tasks and another does', async () => {
    // Two recipients; same query returns data keyed by task list — the action
    // runs buildSections once per recipient, so we need to control per-call
    // results. Re-bind `where` to a per-call implementation.
    const queue: Array<any[]> = [
      [], // user-1 has no tasks
      [{ id: 't1', title: 'X', dueDate: '2026-03-18' }], // user-2 has one today
    ];
    mocks = buildMocks([]);
    const chain: any = { from: vi.fn().mockReturnThis() };
    chain.where = vi.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? []));
    mocks.db.db.select = vi.fn().mockReturnValue(chain);

    action = new SendTaskDigestAction(
      mocks.db,
      mocks.templatesService as any,
      mocks.dispatcher as any,
      mocks.preferenceService as any,
      createMockAppLogger(),
    );

    await action.execute(buildContext({ resolvedUsers: { recipient: ['user-1', 'user-2'] } }));

    expect(mocks.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatcher.dispatch.mock.calls[0][1]).toBe('user-2');
  });

  it('exposes correct metadata for the action registry', () => {
    instantiate([]);
    expect(action.type).toBe('send_task_digest');
    expect(action.label).toBe('Send Task Digest');
    expect(action.userSlots).toHaveLength(1);
    expect(action.userSlots[0].name).toBe('recipient');
  });
});
