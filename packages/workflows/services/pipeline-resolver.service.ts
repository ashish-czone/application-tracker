import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { entityPipelineAssignments } from '../schema';
import { WorkflowRegistryService } from './workflow-registry.service';
import type { CachedWorkflowDefinition } from '../types';

@Injectable()
export class PipelineResolverService {
  private readonly logger = new Logger(PipelineResolverService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly registry: WorkflowRegistryService,
  ) {}

  /**
   * Get the assigned pipeline for an entity record.
   * Returns undefined if no assignment exists (single-pipeline entities).
   */
  async getAssignment(
    entityType: string,
    entityId: string,
    fieldName: string,
  ): Promise<CachedWorkflowDefinition | undefined> {
    const [row] = await this.database.db
      .select()
      .from(entityPipelineAssignments)
      .where(
        withTenant(
          entityPipelineAssignments,
          eq(entityPipelineAssignments.entityType, entityType),
          eq(entityPipelineAssignments.entityId, entityId),
          eq(entityPipelineAssignments.fieldName, fieldName),
        ),
      )
      .limit(1);

    if (!row) return undefined;
    return this.registry.getBySlug(
      this.findSlugByDefinitionId(row.workflowDefinitionId),
    );
  }

  /**
   * Resolve and assign a pipeline for an entity based on discriminator value.
   * If only one pipeline exists for the field, returns it without creating an assignment.
   */
  async resolveAndAssign(
    entityType: string,
    entityId: string,
    fieldName: string,
    discriminatorValue?: string,
  ): Promise<CachedWorkflowDefinition | undefined> {
    const all = this.registry.getAllForField(entityType, fieldName);

    // Single pipeline — no assignment needed
    if (all.length <= 1) {
      return all[0];
    }

    // Multi-pipeline — resolve by discriminator
    let matched: CachedWorkflowDefinition | undefined;
    if (discriminatorValue) {
      matched = this.registry.getByDiscriminator(entityType, fieldName, discriminatorValue);
    }
    if (!matched) {
      matched = this.registry.getDefaultForField(entityType, fieldName);
    }
    if (!matched) return undefined;

    // Store assignment
    await this.database.db
      .insert(entityPipelineAssignments)
      .values(withTenantInsert(entityPipelineAssignments, {
        entityType,
        entityId,
        fieldName,
        workflowDefinitionId: matched.id,
      }))
      .onConflictDoNothing();

    this.logger.log(`Pipeline assigned: ${matched.slug} for ${entityType}/${entityId}/${fieldName}`);
    return matched;
  }

  /**
   * Resolve the pipeline for a transition: check assignment first, fall back to default.
   */
  async resolveForTransition(
    entityType: string,
    entityId: string,
    fieldName: string,
  ): Promise<CachedWorkflowDefinition | undefined> {
    // Check existing assignment
    const assigned = await this.getAssignment(entityType, entityId, fieldName);
    if (assigned) return assigned;

    // No assignment — use default (backward compat for single-pipeline entities)
    return this.registry.getDefaultForField(entityType, fieldName);
  }

  private findSlugByDefinitionId(definitionId: string): string {
    for (const def of this.registry.getAll()) {
      if (def.id === definitionId) return def.slug;
    }
    return '';
  }
}
