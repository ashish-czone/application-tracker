import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AutomationRuleService } from '../automation-rule.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleRuleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    description: null,
    triggerType: 'event',
    eventName: 'orders.OrderCreated',
    delayAmount: null,
    delayUnit: null,
    scheduleEntityType: null,
    scheduleDateField: null,
    scheduleDateOperator: null,
    scheduleDateAmounts: null,
    scheduleDateUnit: null,
    scheduleDaysOfWeek: null,
    conditions: null,
    actions: [{ type: 'send_notification', config: {} }],
    onSourceUpdated: null,
    onSourceDeleted: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

/**
 * Queue-based mock DB.
 *
 * Every chain method returns an object that is both chainable (has all query
 * methods) AND thenable. When the runtime `await`s the chain, `then()` shifts
 * the next enqueued result. This lets the same mock handle chains of varying
 * lengths (e.g. `.where()` is terminal in `findActiveByEventName` but
 * intermediate in `findByIdOrFail` which continues to `.limit(1)`).
 */
function createMockDb() {
  const results: Promise<unknown>[] = [];

  function shiftResult() {
    return results.length ? results.shift()! : Promise.resolve([]);
  }

  // Every method returns `link` — an object with all chain methods plus then/catch.
  // `then` is lazy: it only shifts a result when the runtime actually awaits.
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  function makeLink() {
    const deferred = {
      then: (resolve: any, reject?: any) => shiftResult().then(resolve, reject),
      catch: (reject: any) => shiftResult().catch(reject),
    };
    return { ...chain, ...deferred };
  }

  chain.select = vi.fn().mockImplementation(() => makeLink());
  chain.from = vi.fn().mockImplementation(() => makeLink());
  chain.where = vi.fn().mockImplementation(() => makeLink());
  chain.limit = vi.fn().mockImplementation(() => makeLink());
  chain.orderBy = vi.fn().mockImplementation(() => makeLink());
  chain.offset = vi.fn().mockImplementation(() => makeLink());
  chain.insert = vi.fn().mockImplementation(() => makeLink());
  chain.values = vi.fn().mockImplementation(() => makeLink());
  chain.returning = vi.fn().mockImplementation(() => makeLink());
  chain.update = vi.fn().mockImplementation(() => makeLink());
  chain.set = vi.fn().mockImplementation(() => makeLink());
  chain.delete = vi.fn().mockImplementation(() => makeLink());

  return {
    db: chain,
    _enqueue: (val: unknown) => results.push(Promise.resolve(val)),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutomationRuleService', () => {
  let service: AutomationRuleService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AutomationRuleService({ db: mockDb.db } as any);
  });

  // -----------------------------------------------------------------------
  // findActiveByEventName
  // -----------------------------------------------------------------------
  describe('findActiveByEventName', () => {
    it('should return rules matching the event name', async () => {
      const row = sampleRuleRow();
      mockDb._enqueue([row]);

      const rules = await service.findActiveByEventName('orders.OrderCreated');

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule-1');
      expect(rules[0].eventName).toBe('orders.OrderCreated');
    });

    it('should return empty array when no rules match', async () => {
      mockDb._enqueue([]);

      const rules = await service.findActiveByEventName('unknown.Event');

      expect(rules).toHaveLength(0);
    });

    it('should map all fields via toRule', async () => {
      const row = sampleRuleRow({
        conditions: [{ field: 'status', op: 'eq', value: 'open' }],
        actions: [{ type: 'webhook', config: { url: 'https://example.com' } }],
        onSourceUpdated: [{ linked: 'task', action: 'update', set: { status: 'done' } }],
        onSourceDeleted: [{ linked: 'task', action: 'delete' }],
        delayAmount: 5,
        delayUnit: 'minutes',
      });
      mockDb._enqueue([row]);

      const [rule] = await service.findActiveByEventName('orders.OrderCreated');

      expect(rule.conditions).toEqual([{ field: 'status', op: 'eq', value: 'open' }]);
      expect(rule.actions).toEqual([{ type: 'webhook', config: { url: 'https://example.com' } }]);
      expect(rule.onSourceUpdated).toHaveLength(1);
      expect(rule.onSourceDeleted).toHaveLength(1);
      expect(rule.delayAmount).toBe(5);
      expect(rule.delayUnit).toBe('minutes');
      expect(rule.triggerType).toBe('event');
    });

    it('should return multiple rules when several match', async () => {
      mockDb._enqueue([sampleRuleRow({ id: 'r-1' }), sampleRuleRow({ id: 'r-2' })]);

      const rules = await service.findActiveByEventName('orders.OrderCreated');

      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.id)).toEqual(['r-1', 'r-2']);
    });
  });

  // -----------------------------------------------------------------------
  // findActiveWithLifecycleBindings
  // -----------------------------------------------------------------------
  describe('findActiveWithLifecycleBindings', () => {
    it('should return rules with onSourceUpdated bindings', async () => {
      mockDb._enqueue([
        sampleRuleRow({ id: 'r-1', onSourceUpdated: [{ linked: 'task', action: 'update', set: {} }] }),
        sampleRuleRow({ id: 'r-2' }), // no bindings
      ]);

      const rules = await service.findActiveWithLifecycleBindings();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r-1');
    });

    it('should return rules with onSourceDeleted bindings', async () => {
      mockDb._enqueue([
        sampleRuleRow({ id: 'r-1', onSourceDeleted: [{ linked: 'task', action: 'delete' }] }),
      ]);

      const rules = await service.findActiveWithLifecycleBindings();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r-1');
    });

    it('should return rules with both lifecycle bindings', async () => {
      mockDb._enqueue([
        sampleRuleRow({
          id: 'r-1',
          onSourceUpdated: [{ linked: 'task', action: 'update', set: {} }],
          onSourceDeleted: [{ linked: 'task', action: 'delete' }],
        }),
      ]);

      const rules = await service.findActiveWithLifecycleBindings();

      expect(rules).toHaveLength(1);
    });

    it('should exclude rules with empty lifecycle arrays', async () => {
      mockDb._enqueue([
        sampleRuleRow({ id: 'r-1', onSourceUpdated: [], onSourceDeleted: [] }),
      ]);

      const rules = await service.findActiveWithLifecycleBindings();

      expect(rules).toHaveLength(0);
    });

    it('should exclude rules with null lifecycle bindings', async () => {
      mockDb._enqueue([sampleRuleRow()]);

      const rules = await service.findActiveWithLifecycleBindings();

      expect(rules).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // findActiveScheduleRules
  // -----------------------------------------------------------------------
  describe('findActiveScheduleRules', () => {
    it('should return schedule_once rules', async () => {
      mockDb._enqueue([sampleRuleRow({ id: 'r-1', triggerType: 'schedule_once' })]);

      const rules = await service.findActiveScheduleRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].triggerType).toBe('schedule_once');
    });

    it('should return schedule_recurring rules', async () => {
      mockDb._enqueue([sampleRuleRow({ id: 'r-1', triggerType: 'schedule_recurring' })]);

      const rules = await service.findActiveScheduleRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].triggerType).toBe('schedule_recurring');
    });

    it('should exclude event-triggered rules', async () => {
      mockDb._enqueue([
        sampleRuleRow({ id: 'r-1', triggerType: 'event' }),
        sampleRuleRow({ id: 'r-2', triggerType: 'schedule_once' }),
      ]);

      const rules = await service.findActiveScheduleRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('r-2');
    });

    it('should return empty array when no schedule rules exist', async () => {
      mockDb._enqueue([sampleRuleRow({ triggerType: 'event' })]);

      const rules = await service.findActiveScheduleRules();

      expect(rules).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // findByIdOrFail
  // -----------------------------------------------------------------------
  describe('findByIdOrFail', () => {
    it('should return the rule when found', async () => {
      const row = sampleRuleRow();
      mockDb._enqueue([row]);

      const rule = await service.findByIdOrFail('rule-1');

      expect(rule.id).toBe('rule-1');
      expect(rule.name).toBe('Test Rule');
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockDb._enqueue([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockDb._enqueue([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow('Automation rule not found');
    });

    it('should call limit(1) to constrain the query', async () => {
      mockDb._enqueue([sampleRuleRow()]);

      await service.findByIdOrFail('rule-1');

      expect(mockDb.db.limit).toHaveBeenCalledWith(1);
    });
  });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------
  describe('list', () => {
    it('should return paginated results with defaults', async () => {
      mockDb._enqueue([{ total: 1 }]); // count query — where terminal
      mockDb._enqueue([sampleRuleRow()]); // data query — offset terminal

      const result = await service.list({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 25, totalPages: 1 });
    });

    it('should use provided page and limit', async () => {
      mockDb._enqueue([{ total: 50 }]);
      mockDb._enqueue([sampleRuleRow()]);

      const result = await service.list({ page: 3, limit: 10 });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10, totalPages: 5 });
    });

    it('should return empty data when no rules exist', async () => {
      mockDb._enqueue([{ total: 0 }]);
      mockDb._enqueue([]);

      const result = await service.list({});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should call orderBy and offset for pagination', async () => {
      mockDb._enqueue([{ total: 0 }]);
      mockDb._enqueue([]);

      await service.list({ page: 2, limit: 10 });

      expect(mockDb.db.orderBy).toHaveBeenCalled();
      expect(mockDb.db.limit).toHaveBeenCalledWith(10);
      expect(mockDb.db.offset).toHaveBeenCalled();
    });

    it('should calculate totalPages correctly with partial page', async () => {
      mockDb._enqueue([{ total: 27 }]);
      mockDb._enqueue([]);

      const result = await service.list({ limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('should apply search filter', async () => {
      mockDb._enqueue([{ total: 0 }]);
      mockDb._enqueue([]);

      await service.list({ search: 'test' });

      // where is called for both count and data queries
      expect(mockDb.db.where).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  describe('create', () => {
    it('should insert a rule and return the mapped result', async () => {
      const row = sampleRuleRow();
      mockDb._enqueue([row]); // returning() result

      const rule = await service.create({
        name: 'Test Rule',
        eventName: 'orders.OrderCreated',
        actions: [{ type: 'send_notification', config: {} }],
      });

      expect(mockDb.db.insert).toHaveBeenCalled();
      expect(mockDb.db.values).toHaveBeenCalled();
      expect(rule.id).toBe('rule-1');
      expect(rule.name).toBe('Test Rule');
    });

    it('should default optional fields to null', async () => {
      const row = sampleRuleRow();
      mockDb._enqueue([row]);

      await service.create({
        name: 'Minimal Rule',
        actions: [{ type: 'webhook', config: {} }],
      });

      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Rule',
          description: null,
          triggerType: 'event',
          eventName: null,
          delayAmount: null,
          delayUnit: null,
          scheduleEntityType: null,
          scheduleDateField: null,
          scheduleDateOperator: null,
          scheduleDateAmounts: null,
          scheduleDateUnit: null,
          scheduleDaysOfWeek: null,
          conditions: null,
          onSourceUpdated: null,
          onSourceDeleted: null,
        }),
      );
    });

    it('should pass provided optional fields', async () => {
      const row = sampleRuleRow({
        description: 'A description',
        triggerType: 'schedule_recurring',
        conditions: [{ field: 'x', op: 'eq', value: '1' }],
        onSourceUpdated: [{ linked: 'task', action: 'update', set: {} }],
        onSourceDeleted: [{ linked: 'task', action: 'delete' }],
      });
      mockDb._enqueue([row]);

      await service.create({
        name: 'Full Rule',
        description: 'A description',
        triggerType: 'schedule_recurring',
        conditions: [{ field: 'x', op: 'eq', value: '1' }] as any,
        actions: [{ type: 'webhook', config: {} }],
        onSourceUpdated: [{ linked: 'task', action: 'update', set: {} }],
        onSourceDeleted: [{ linked: 'task', action: 'delete' }],
      });

      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'A description',
          triggerType: 'schedule_recurring',
          conditions: [{ field: 'x', op: 'eq', value: '1' }],
          onSourceUpdated: [{ linked: 'task', action: 'update', set: {} }],
          onSourceDeleted: [{ linked: 'task', action: 'delete' }],
        }),
      );
    });

    it('should pass schedule fields when provided', async () => {
      const row = sampleRuleRow({ triggerType: 'schedule_once' });
      mockDb._enqueue([row]);

      await service.create({
        name: 'Schedule Rule',
        triggerType: 'schedule_once',
        scheduleEntityType: 'tasks',
        scheduleDateField: 'dueDate',
        scheduleDateOperator: 'before',
        scheduleDateAmounts: [1, 7],
        scheduleDateUnit: 'days',
        scheduleDaysOfWeek: [1, 2, 3, 4, 5],
        actions: [{ type: 'send_notification', config: {} }],
      });

      expect(mockDb.db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleEntityType: 'tasks',
          scheduleDateField: 'dueDate',
          scheduleDateOperator: 'before',
          scheduleDateAmounts: [1, 7],
          scheduleDateUnit: 'days',
          scheduleDaysOfWeek: [1, 2, 3, 4, 5],
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------
  describe('update', () => {
    it('should update and return the updated rule', async () => {
      const original = sampleRuleRow();
      const updated = sampleRuleRow({ name: 'Updated Rule' });

      // 1st findByIdOrFail (guard)
      mockDb._enqueue([original]);
      // update().set().where() — where is terminal
      mockDb._enqueue(undefined);
      // 2nd findByIdOrFail (return)
      mockDb._enqueue([updated]);

      const rule = await service.update('rule-1', { name: 'Updated Rule' });

      expect(rule.name).toBe('Updated Rule');
      expect(mockDb.db.update).toHaveBeenCalled();
      expect(mockDb.db.set).toHaveBeenCalled();
    });

    it('should throw NotFoundException if rule does not exist', async () => {
      mockDb._enqueue([]); // findByIdOrFail returns nothing

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in the update payload', async () => {
      mockDb._enqueue([sampleRuleRow()]);
      mockDb._enqueue(undefined);
      mockDb._enqueue([sampleRuleRow({ isActive: false })]);

      await service.update('rule-1', { isActive: false });

      expect(mockDb.db.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      // name should NOT be in the set call
      const setArg = mockDb.db.set.mock.calls[0][0];
      expect(setArg).not.toHaveProperty('name');
    });

    it('should always set updatedAt', async () => {
      mockDb._enqueue([sampleRuleRow()]);
      mockDb._enqueue(undefined);
      mockDb._enqueue([sampleRuleRow()]);

      await service.update('rule-1', { name: 'Changed' });

      const setArg = mockDb.db.set.mock.calls[0][0];
      expect(setArg.updatedAt).toBeInstanceOf(Date);
    });

    it('should support updating conditions and actions', async () => {
      const newActions = [{ type: 'webhook', config: { url: 'https://example.com' } }];
      const newConditions = [{ field: 'status', op: 'eq', value: 'closed' }] as any;

      mockDb._enqueue([sampleRuleRow()]);
      mockDb._enqueue(undefined);
      mockDb._enqueue([sampleRuleRow({ actions: newActions, conditions: newConditions })]);

      await service.update('rule-1', { actions: newActions, conditions: newConditions });

      const setArg = mockDb.db.set.mock.calls[0][0];
      expect(setArg.actions).toEqual(newActions);
      expect(setArg.conditions).toEqual(newConditions);
    });

    it('should support updating lifecycle bindings', async () => {
      const bindings = [{ linked: 'invoice', action: 'update' as const, set: { status: 'void' } }];

      mockDb._enqueue([sampleRuleRow()]);
      mockDb._enqueue(undefined);
      mockDb._enqueue([sampleRuleRow({ onSourceUpdated: bindings })]);

      await service.update('rule-1', { onSourceUpdated: bindings });

      const setArg = mockDb.db.set.mock.calls[0][0];
      expect(setArg.onSourceUpdated).toEqual(bindings);
    });
  });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('should delete an existing rule', async () => {
      mockDb._enqueue([sampleRuleRow()]); // findByIdOrFail
      mockDb._enqueue(undefined); // delete().where()

      await service.delete('rule-1');

      expect(mockDb.db.delete).toHaveBeenCalled();
      expect(mockDb.db.where).toHaveBeenCalled();
    });

    it('should throw NotFoundException if rule does not exist', async () => {
      mockDb._enqueue([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should not call delete if findByIdOrFail throws', async () => {
      mockDb._enqueue([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockDb.db.delete).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // toRule (private, tested indirectly)
  // -----------------------------------------------------------------------
  describe('toRule mapping', () => {
    it('should cast triggerType to TriggerType', async () => {
      mockDb._enqueue([sampleRuleRow({ triggerType: 'schedule_recurring' })]);

      const [rule] = await service.findActiveByEventName('orders.OrderCreated');

      expect(rule.triggerType).toBe('schedule_recurring');
    });

    it('should cast JSONB columns to typed arrays', async () => {
      const row = sampleRuleRow({
        conditions: [{ field: 'a', op: 'eq', value: '1' }],
        actions: [{ type: 'webhook', config: { url: 'u' } }],
        scheduleDateAmounts: [1, 7, 30],
        scheduleDaysOfWeek: [0, 6],
        onSourceUpdated: [{ linked: 'x', action: 'update', set: {} }],
        onSourceDeleted: [{ linked: 'x', action: 'delete' }],
      });
      mockDb._enqueue([row]);

      const [rule] = await service.findActiveByEventName('orders.OrderCreated');

      expect(Array.isArray(rule.conditions)).toBe(true);
      expect(Array.isArray(rule.actions)).toBe(true);
      expect(Array.isArray(rule.scheduleDateAmounts)).toBe(true);
      expect(Array.isArray(rule.scheduleDaysOfWeek)).toBe(true);
      expect(Array.isArray(rule.onSourceUpdated)).toBe(true);
      expect(Array.isArray(rule.onSourceDeleted)).toBe(true);
    });

    it('should preserve null for optional JSONB fields', async () => {
      mockDb._enqueue([sampleRuleRow()]);

      const [rule] = await service.findActiveByEventName('orders.OrderCreated');

      expect(rule.conditions).toBeNull();
      expect(rule.onSourceUpdated).toBeNull();
      expect(rule.onSourceDeleted).toBeNull();
      expect(rule.scheduleDateAmounts).toBeNull();
      expect(rule.scheduleDaysOfWeek).toBeNull();
    });

    it('should preserve date fields', async () => {
      const now = new Date('2026-03-15T10:00:00Z');
      mockDb._enqueue([sampleRuleRow({ createdAt: now, updatedAt: now })]);

      const [rule] = await service.findActiveByEventName('orders.OrderCreated');

      expect(rule.createdAt).toEqual(now);
      expect(rule.updatedAt).toEqual(now);
    });
  });
});
