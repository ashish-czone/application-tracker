import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Global, Module } from '@nestjs/common';
import { createIntegrationTestModule, cleanDatabase } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { ActionRegistry } from '@packages/automations/services/action-registry';
import { WorkflowsModule } from '../../workflows.module';
import { WorkflowRegistryService } from '../workflow-registry.service';
import { WorkflowEngineService } from '../workflow-engine.service';
import { WorkflowGuardRegistry } from '../workflow-guard-registry.service';
import { PipelineResolverService } from '../pipeline-resolver.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

@Global()
@Module({
  providers: [ActionRegistry],
  exports: [ActionRegistry],
})
class MockAutomationsModule {}

describe('Workflows (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let registry: WorkflowRegistryService;
  let engine: WorkflowEngineService;
  let guardRegistry: WorkflowGuardRegistry;
  let pipelineResolver: PipelineResolverService;

  beforeAll(async () => {
    const ctx = await createIntegrationTestModule({
      imports: [EventsModule, RbacModule, MockAutomationsModule, WorkflowsModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    registry = module.get(WorkflowRegistryService);
    engine = module.get(WorkflowEngineService);
    guardRegistry = module.get(WorkflowGuardRegistry);
    pipelineResolver = module.get(PipelineResolverService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await registry.invalidateCache();
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createWorkflow(overrides: Partial<{
    slug: string;
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
  }> = {}) {
    const slug = overrides.slug ?? `wf-${randomUUID().slice(0, 8)}`;
    return registry.createDefinition({
      slug,
      name: overrides.name ?? 'Test Workflow',
      entityType: overrides.entityType ?? 'test_entity',
      fieldName: overrides.fieldName ?? 'status',
      initialState: overrides.initialState ?? 'draft',
    });
  }

  describe('WorkflowRegistryService', () => {
    it('should create a workflow definition with states and transitions', async () => {
      const def = await createWorkflow();

      const state1 = await registry.createState(def.id, { name: 'draft', label: 'Draft', sortOrder: 0 });
      const state2 = await registry.createState(def.id, { name: 'published', label: 'Published', sortOrder: 1 });

      await registry.createTransition(def.id, {
        fromStateId: state1.id,
        toStateId: state2.id,
        name: 'publish',
        sortOrder: 0,
      });

      await registry.invalidateCache();

      const cached = registry.getBySlug(def.slug);
      expect(cached).toBeDefined();
      expect(cached!.states).toHaveLength(2);
      expect(cached!.transitions).toHaveLength(1);
      expect(cached!.transitions[0].fromStateName).toBe('draft');
      expect(cached!.transitions[0].toStateName).toBe('published');
    });

    it('should get workflows by entity type', async () => {
      await createWorkflow({ entityType: 'candidates', fieldName: 'status' });
      await createWorkflow({ entityType: 'orders', fieldName: 'status' });
      await registry.invalidateCache();

      const candidateWfs = registry.getByEntityType('candidates');
      expect(candidateWfs).toHaveLength(1);
      expect(candidateWfs[0].entityType).toBe('candidates');
    });

    it('should update a workflow definition', async () => {
      const def = await createWorkflow();
      await registry.updateDefinition(def.id, { name: 'Updated Name' });
      await registry.invalidateCache();

      const cached = registry.getBySlug(def.slug);
      expect(cached!.name).toBe('Updated Name');
    });

    it('should delete a workflow definition', async () => {
      const def = await createWorkflow({ slug: 'to-delete' });
      await registry.invalidateCache();
      expect(registry.getBySlug('to-delete')).toBeDefined();

      await registry.deleteDefinition(def.id);
      await registry.invalidateCache();
      expect(registry.getBySlug('to-delete')).toBeUndefined();
    });

    it('should update workflow states', async () => {
      const def = await createWorkflow();
      const state = await registry.createState(def.id, { name: 'draft', label: 'Draft', sortOrder: 0 });
      await registry.updateState(state.id, { label: 'New Label', color: '#ff0000' });
      await registry.invalidateCache();

      const cached = registry.getBySlug(def.slug);
      expect(cached!.states[0].label).toBe('New Label');
      expect(cached!.states[0].color).toBe('#ff0000');
    });

    it('should delete a workflow state', async () => {
      const def = await createWorkflow();
      const state = await registry.createState(def.id, { name: 'temp', label: 'Temp', sortOrder: 0 });
      await registry.deleteState(state.id);
      await registry.invalidateCache();

      const cached = registry.getBySlug(def.slug);
      expect(cached!.states).toHaveLength(0);
    });
  });

  describe('WorkflowEngineService', () => {
    async function setupWorkflow() {
      const def = await createWorkflow({ initialState: 'draft' });
      const draftState = await registry.createState(def.id, { name: 'draft', label: 'Draft', sortOrder: 0 });
      const publishedState = await registry.createState(def.id, { name: 'published', label: 'Published', sortOrder: 1 });
      const archivedState = await registry.createState(def.id, { name: 'archived', label: 'Archived', sortOrder: 2 });

      await registry.createTransition(def.id, {
        fromStateId: draftState.id,
        toStateId: publishedState.id,
        name: 'publish',
        sortOrder: 0,
      });
      await registry.createTransition(def.id, {
        fromStateId: publishedState.id,
        toStateId: archivedState.id,
        name: 'archive',
        sortOrder: 1,
      });

      await registry.invalidateCache();
      return { def, draftState, publishedState, archivedState };
    }

    it('should list available transitions from a state', async () => {
      const { def } = await setupWorkflow();

      const transitions = engine.getAvailableTransitions(def.slug, 'draft');
      expect(transitions).toHaveLength(1);
      expect(transitions[0].toState).toBe('published');
      expect(transitions[0].transitionName).toBe('publish');
    });

    it('should return empty transitions for terminal state', async () => {
      const { def } = await setupWorkflow();

      const transitions = engine.getAvailableTransitions(def.slug, 'archived');
      expect(transitions).toHaveLength(0);
    });

    it('should validate a valid transition', async () => {
      const { def } = await setupWorkflow();

      const result = await engine.validateTransition(def.slug, 'draft', 'published');
      expect(result.valid).toBe(true);
      expect(result.transitionId).toBeDefined();
    });

    it('should reject an invalid transition', async () => {
      const { def } = await setupWorkflow();

      const result = await engine.validateTransition(def.slug, 'draft', 'archived');
      expect(result.valid).toBe(false);
    });

    it('should record and retrieve transition history', async () => {
      const { def } = await setupWorkflow();
      const entityId = randomUUID();

      const cached = registry.getBySlug(def.slug)!;
      const transition = cached.transitions.find((t) => t.fromStateName === 'draft');

      await engine.recordHistory({
        workflowDefinitionId: cached.id,
        entityType: 'test_entity',
        entityId,
        fieldName: 'status',
        fromState: 'draft',
        toState: 'published',
        transitionId: transition!.id,
        actorId: null,
        reason: 'Ready to publish',
        comment: 'Looks good',
      }, db);

      const history = await engine.getHistory('test_entity', entityId);
      expect(history).toHaveLength(1);
      expect(history[0].fromState).toBe('draft');
      expect(history[0].toState).toBe('published');
      expect(history[0].reason).toBe('Ready to publish');
      expect(history[0].comment).toBe('Looks good');
    });
  });

  describe('WorkflowGuardRegistry', () => {
    it('should register and execute guards', async () => {
      guardRegistry.register('always_allow', async () => true);
      guardRegistry.register('always_deny', async () => false);

      const context = {
        workflowSlug: 'test',
        entityType: 'test_entity',
        entityId: randomUUID(),
        fieldName: 'status',
        fromState: 'draft',
        toState: 'published',
        actorId: null,
      };

      const allowResult = await guardRegistry.executeGuards(['always_allow'], context);
      expect(allowResult.passed).toBe(true);

      const denyResult = await guardRegistry.executeGuards(['always_deny'], context);
      expect(denyResult.passed).toBe(false);
      expect(denyResult.failedGuard).toBe('always_deny');
    });
  });

  describe('PipelineResolverService', () => {
    it('should resolve a single-pipeline entity without persisting assignment', async () => {
      const def = await createWorkflow({ entityType: 'pipeline_test', fieldName: 'status' });
      await registry.createState(def.id, { name: 'draft', label: 'Draft', sortOrder: 0 });
      await registry.invalidateCache();

      const entityId = randomUUID();
      const resolved = await pipelineResolver.resolveAndAssign('pipeline_test', entityId, 'status');
      expect(resolved).toBeDefined();
      expect(resolved!.slug).toBe(def.slug);

      // Single pipeline: no DB assignment stored (optimization)
      const assignment = await pipelineResolver.getAssignment('pipeline_test', entityId, 'status');
      expect(assignment).toBeUndefined();
    });

    it('should resolve for transition via default when no assignment exists', async () => {
      const def = await createWorkflow({ entityType: 'transition_test', fieldName: 'status' });
      await registry.createState(def.id, { name: 'draft', label: 'Draft', sortOrder: 0 });
      await registry.invalidateCache();

      const entityId = randomUUID();
      const resolved = await pipelineResolver.resolveForTransition('transition_test', entityId, 'status');
      expect(resolved).toBeDefined();
      expect(resolved!.slug).toBe(def.slug);
    });
  });
});
