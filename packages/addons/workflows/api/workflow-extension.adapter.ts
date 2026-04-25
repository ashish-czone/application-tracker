import { Injectable } from '@nestjs/common';
import type { WorkflowExtension, WorkflowDefinitionRef, ValidatedTransition } from '@packages/entity-engine/extensions';
import type { WorkflowGuardFn } from '@packages/entity-engine/extensions';
import { WorkflowRegistryService } from './services/workflow-registry.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowGuardRegistry } from './services/workflow-guard-registry.service';
import { PipelineResolverService } from './services/pipeline-resolver.service';

/**
 * Adapter that implements entity-engine's WorkflowExtension interface
 * by delegating to the real workflow services.
 */
@Injectable()
export class WorkflowExtensionAdapter implements WorkflowExtension {
  constructor(
    private readonly registry: WorkflowRegistryService,
    private readonly engine: WorkflowEngineService,
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly pipelineResolver: PipelineResolverService,
  ) {}

  getBySlug(slug: string): WorkflowDefinitionRef | undefined {
    return this.registry.getBySlug(slug) as WorkflowDefinitionRef | undefined;
  }

  async createDefinition(data: {
    slug: string;
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
  }) {
    return this.registry.createDefinition(data);
  }

  async createState(definitionId: string, data: {
    name: string;
    label: string;
    color?: string;
    sortOrder: number;
  }) {
    return this.registry.createState(definitionId, data);
  }

  async createTransition(definitionId: string, data: {
    fromStateId: string;
    toStateId: string;
    name: string;
    requiredPermissions?: string[];
    guardNames?: string[];
    sortOrder: number;
    metadata?: Record<string, unknown>;
    reasonRequired?: boolean;
    commentRequired?: boolean;
    reasonOptions?: string[];
  }) {
    return this.registry.createTransition(definitionId, data);
  }

  registerGuard(name: string, fn: WorkflowGuardFn): void {
    this.guardRegistry.register(name, fn);
  }

  async resolveForTransition(entityType: string, entityId: string, fieldName: string) {
    return this.pipelineResolver.resolveForTransition(entityType, entityId, fieldName) as Promise<WorkflowDefinitionRef | undefined>;
  }

  async resolveAndAssign(entityType: string, entityId: string, fieldName: string, discriminatorValue?: string) {
    return this.pipelineResolver.resolveAndAssign(entityType, entityId, fieldName, discriminatorValue) as Promise<WorkflowDefinitionRef | undefined>;
  }

  async validateAndThrow(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    entityData?: Record<string, unknown>;
  }): Promise<ValidatedTransition> {
    return this.engine.validateAndThrow(params);
  }

  async recordHistory(data: {
    workflowDefinitionId: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    fromState: string;
    toState: string;
    transitionId: string;
    actorId: string | null;
    reason?: string;
    comment?: string;
  }, tx?: unknown): Promise<void> {
    await this.engine.recordHistory(data, tx);
  }
}
