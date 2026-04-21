import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { AutomationsModule } from '../../automations.module';
import { AutomationRuleService } from '../automation-rule.service';
import { ExecutionLogService } from '../execution-log.service';
import { ProvenanceService } from '../provenance.service';
import { ActionRegistry } from '../action-registry';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('Automations (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let ruleService: AutomationRuleService;
  let executionLog: ExecutionLogService;
  let provenance: ProvenanceService;
  let actionRegistry: ActionRegistry;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [AutomationsModule],
      mocks: { automations: false },
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    ruleService = module.get(AutomationRuleService);
    executionLog = module.get(ExecutionLogService);
    provenance = module.get(ProvenanceService);
    actionRegistry = module.get(ActionRegistry);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('AutomationRuleService', () => {
    it('should create and retrieve an automation rule', async () => {
      const rule = await ruleService.create({
        name: 'Send Welcome Email',
        eventName: 'users.Created',
        actions: [{ type: 'send_notification', config: { templateId: 'welcome' } }],
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Send Welcome Email');

      const found = await ruleService.findByIdOrFail(rule.id);
      expect(found.name).toBe('Send Welcome Email');
    });

    it('should list rules with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await ruleService.create({
          name: `Rule ${i}`,
          eventName: 'test.Event',
          actions: [{ type: 'webhook', config: {} }],
        });
      }

      const page = await ruleService.list({ page: 1, limit: 3 });
      expect(page.data).toHaveLength(3);
      expect(page.meta.total).toBe(5);
    });

    it('should find active rules by event name', async () => {
      await ruleService.create({
        name: 'Active Rule',
        eventName: 'test.Created',
        actions: [{ type: 'webhook', config: {} }],
      });
      const inactive = await ruleService.create({
        name: 'Inactive Rule',
        eventName: 'test.Created',
        actions: [{ type: 'webhook', config: {} }],
      });
      await ruleService.update(inactive.id, { isActive: false });

      const active = await ruleService.findActiveByEventName('test.Created');
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('Active Rule');
    });

    it('should update a rule', async () => {
      const rule = await ruleService.create({
        name: 'Original',
        eventName: 'test.Event',
        actions: [{ type: 'webhook', config: {} }],
      });
      const updated = await ruleService.update(rule.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });

    it('should delete a rule', async () => {
      const rule = await ruleService.create({
        name: 'To Delete',
        eventName: 'test.Event',
        actions: [{ type: 'webhook', config: {} }],
      });
      await ruleService.delete(rule.id);
      await expect(ruleService.findByIdOrFail(rule.id)).rejects.toThrow();
    });
  });

  describe('ExecutionLogService', () => {
    it('should log and list executions', async () => {
      const rule = await ruleService.create({
        name: 'Test Rule',
        eventName: 'test.Event',
        actions: [{ type: 'webhook', config: {} }],
      });

      await executionLog.log({
        ruleId: rule.id,
        actionIndex: 0,
        actionType: 'webhook',
        entityType: 'test_entity',
        entityId: randomUUID(),
        status: 'success',
      });
      await executionLog.log({
        ruleId: rule.id,
        actionIndex: 0,
        actionType: 'webhook',
        entityType: 'test_entity',
        entityId: randomUUID(),
        status: 'error',
        errorMessage: 'Connection timeout',
      });

      const result = await executionLog.list({ ruleId: rule.id });
      expect(result.data).toHaveLength(2);

      const errors = await executionLog.list({ ruleId: rule.id, status: 'error' });
      expect(errors.data).toHaveLength(1);
      expect(errors.data[0].errorMessage).toBe('Connection timeout');
    });
  });

  describe('ProvenanceService', () => {
    it('should log and query provenance links', async () => {
      const rule = await ruleService.create({
        name: 'Create Task Rule',
        eventName: 'test.Event',
        actions: [{ type: 'create_entity', config: {} }],
      });

      const sourceId = randomUUID();
      const targetId = randomUUID();

      await provenance.log({
        ruleId: rule.id,
        actionIndex: 0,
        linkName: 'created_task',
        sourceEntityType: 'candidate',
        sourceEntityId: sourceId,
        targetEntityType: 'task',
        targetEntityId: targetId,
      });

      const linked = await provenance.findLinked({
        ruleId: rule.id,
        linkName: 'created_task',
        sourceEntityType: 'candidate',
        sourceEntityId: sourceId,
      });
      expect(linked).toHaveLength(1);
      expect(linked[0].targetEntityId).toBe(targetId);

      const hasLink = await provenance.hasLinked({
        ruleId: rule.id,
        linkName: 'created_task',
        sourceEntityType: 'candidate',
        sourceEntityId: sourceId,
      });
      expect(hasLink).toBe(true);
    });
  });

  describe('ActionRegistry', () => {
    it('should register and retrieve action handlers', () => {
      expect(actionRegistry.has('webhook')).toBe(true);
      expect(actionRegistry.get('webhook')).toBeDefined();
    });

    it('should list all metadata', () => {
      const metadata = actionRegistry.getAllMetadata();
      expect(metadata.length).toBeGreaterThan(0);
      expect(metadata.some((m) => m.type === 'webhook')).toBe(true);
    });
  });
});
