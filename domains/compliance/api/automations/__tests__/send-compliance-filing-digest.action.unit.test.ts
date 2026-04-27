import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SendComplianceFilingDigestAction } from '../send-compliance-filing-digest.action';
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
    name: 'compliance-filing-daily-digest',
    channel: 'email',
    subject: 'Your filings ({{totalCount}})',
    body: [
      '{{#hasOverdue}}OVERDUE:{{#sections.overdue}} {{title}}({{dueDate}});{{/sections.overdue}}{{/hasOverdue}}',
      '{{#hasThisWeek}}WEEK:{{#sections.thisWeek}} {{title}}({{dueDate}});{{/sections.thisWeek}}{{/hasThisWeek}}',
      '{{#hasNextWeek}}NEXT:{{#sections.nextWeek}} {{title}}({{dueDate}});{{/sections.nextWeek}}{{/hasNextWeek}}',
    ].join('\n'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as NotificationTemplate;
}

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    rule: { id: 'rule-digest', name: 'compliance-filing-daily-digest' } as AutomationRule,
    actionIndex: 0,
    actionConfig: {
      type: 'send_compliance_filing_digest',
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

function buildMocks(filingRows: Array<{ id: string; title: string; dueDate: string | null }>) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(filingRows);
  const db = { select: vi.fn().mockReturnValue(chain) };

  const templatesService = {
    findByIdOrFail: vi.fn().mockResolvedValue(buildTemplate()),
  };
  const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
  const preferenceService = { isEnabled: vi.fn().mockResolvedValue(true) };

  return { db: { db } as any, templatesService, dispatcher, preferenceService };
}

describe('SendComplianceFilingDigestAction', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let action: SendComplianceFilingDigestAction;

  beforeEach(() => {
    // Pin today = 2026-03-18 UTC. Bucket boundaries:
    //   overdue:  < 2026-03-18
    //   week:    [2026-03-18, 2026-03-25]
    //   next:    [2026-03-26, 2026-04-01]
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function instantiate(filingRows: Array<{ id: string; title: string; dueDate: string | null }>) {
    mocks = buildMocks(filingRows);
    action = new SendComplianceFilingDigestAction(
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
        type: 'send_compliance_filing_digest',
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
    expect(mocks.templatesService.findByIdOrFail).not.toHaveBeenCalled();
  });

  it('buckets filings into overdue / this week / next week per US-8.1', async () => {
    instantiate([
      { id: 'f1', title: 'Old', dueDate: '2026-03-10' }, // overdue
      { id: 'f2', title: 'Today', dueDate: '2026-03-18' }, // this week (boundary)
      { id: 'f3', title: 'Soon', dueDate: '2026-03-22' }, // this week
      { id: 'f4', title: 'Later', dueDate: '2026-03-28' }, // next week
    ]);
    await action.execute(buildContext());

    expect(mocks.dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [, recipientId, content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(recipientId).toBe('user-1');
    expect(content.subject).toBe('Your filings (4)');
    expect(content.body).toContain('OVERDUE: Old(2026-03-10)');
    expect(content.body).toContain('WEEK:');
    expect(content.body).toContain('Today(2026-03-18)');
    expect(content.body).toContain('Soon(2026-03-22)');
    expect(content.body).toContain('NEXT: Later(2026-03-28)');
  });

  it('drops filings beyond the 14-day horizon (returned by query but outside any bucket)', async () => {
    instantiate([
      { id: 'f1', title: 'Today', dueDate: '2026-03-18' },
      // Far-future filings would be filtered server-side, but if they leaked
      // through they'd land outside both windows and not be rendered.
      { id: 'f2', title: 'FarFuture', dueDate: '2026-04-15' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).toContain('Today');
    expect(content.body).not.toContain('FarFuture');
  });

  it('omits empty sections from the rendered body', async () => {
    instantiate([
      { id: 'f1', title: 'This week only', dueDate: '2026-03-20' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).not.toContain('OVERDUE:');
    expect(content.body).not.toContain('NEXT:');
    expect(content.body).toContain('WEEK: This week only(2026-03-20)');
  });

  it('sorts each section by due date then title', async () => {
    instantiate([
      { id: 'f1', title: 'Zulu', dueDate: '2026-03-10' },
      { id: 'f2', title: 'Alpha', dueDate: '2026-03-10' },
      { id: 'f3', title: 'Bravo', dueDate: '2026-03-11' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    const overdue = content.body.split('\n').find((l: string) => l.startsWith('OVERDUE:'));
    expect(overdue).toBe('OVERDUE: Alpha(2026-03-10); Zulu(2026-03-10); Bravo(2026-03-11);');
  });

  it('skips filings whose dueDate is null', async () => {
    instantiate([
      { id: 'f1', title: 'Dateless', dueDate: null },
      { id: 'f2', title: 'Real', dueDate: '2026-03-18' },
    ]);
    await action.execute(buildContext());

    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).not.toContain('Dateless');
    expect(content.body).toContain('Real');
  });

  it('skips a channel when preference is disabled but still runs others', async () => {
    instantiate([{ id: 'f1', title: 'X', dueDate: '2026-03-18' }]);
    mocks.preferenceService.isEnabled = vi.fn()
      .mockResolvedValueOnce(false) // email disabled
      .mockResolvedValueOnce(true); // in_app enabled

    await action.execute(buildContext({
      actionConfig: {
        type: 'send_compliance_filing_digest',
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
    instantiate([{ id: 'f1', title: 'X', dueDate: '2026-03-18' }]);
    mocks.templatesService.findByIdOrFail = vi.fn().mockRejectedValue(new Error('not found'));

    await action.execute(buildContext());

    expect(mocks.dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('skips empty digests per-recipient when one recipient has no filings and another does', async () => {
    const queue: Array<any[]> = [
      [], // user-1 has no filings
      [{ id: 'f1', title: 'X', dueDate: '2026-03-18' }], // user-2 has one this week
    ];
    mocks = buildMocks([]);
    const chain: any = { from: vi.fn().mockReturnThis() };
    chain.where = vi.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? []));
    mocks.db.db.select = vi.fn().mockReturnValue(chain);

    action = new SendComplianceFilingDigestAction(
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

  it('uses context.now over wall clock for bucket boundaries (clock injection)', async () => {
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z')); // wall-clock far in the future
    instantiate([{ id: 'f1', title: 'X', dueDate: '2026-03-18' }]);

    await action.execute(buildContext({ now: new Date('2026-03-18T09:00:00Z') }));

    // If wall clock had been used, 2026-03-18 would be 70+ years overdue;
    // with context.now pinned to the same date it falls in "this week".
    const [, , content] = mocks.dispatcher.dispatch.mock.calls[0];
    expect(content.body).toContain('WEEK: X(2026-03-18)');
    expect(content.body).not.toContain('OVERDUE:');
  });

  it('exposes correct metadata for the action registry', () => {
    instantiate([]);
    expect(action.type).toBe('send_compliance_filing_digest');
    expect(action.label).toBe('Send Compliance Filing Digest');
    expect(action.userSlots).toHaveLength(1);
    expect(action.userSlots[0].name).toBe('recipient');
  });
});
