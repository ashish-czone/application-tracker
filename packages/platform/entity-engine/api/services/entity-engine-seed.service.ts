import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { EntityRegistryService } from '../entity-registry.service';
import { FieldDefinitionService } from './field-definition.service';
import { seedEntityFields, seedWorkflows } from '../seed-entity-fields';
import { LAYOUT_EXTENSION, type LayoutExtension } from '../extensions/layout-extension.interface';
import { WORKFLOW_EXTENSION, type WorkflowExtension } from '../extensions/workflow-extension.interface';
import type { EntityConfig } from '../types';

/**
 * Owns DB seeding of registered entities: field definitions, picklist options,
 * default layouts, and workflow definitions/states/transitions.
 *
 * Invoked from the `db:seed:system` CLI via the package's `seeds/system.ts`,
 * never at app bootstrap. `EntityEngineModule.onApplicationBootstrap` only runs
 * in-memory registrations; actual DB writes happen here.
 */
@Injectable()
export class EntityEngineSeedService {
  private readonly logger = new Logger(EntityEngineSeedService.name);

  constructor(
    private readonly registry: EntityRegistryService,
    private readonly fieldDefService: FieldDefinitionService,
    @Inject(LAYOUT_EXTENSION) @Optional() private readonly layoutExtension: LayoutExtension | null,
    @Inject(WORKFLOW_EXTENSION) @Optional() private readonly workflowExt: WorkflowExtension | null,
  ) {}

  async seedAll(): Promise<void> {
    const configs = this.registry.getAll();
    this.logger.log(`Seeding ${configs.length} registered entities`);
    for (const config of configs) {
      await this.seedEntity(config);
    }
  }

  async seedEntity(config: EntityConfig): Promise<void> {
    await seedEntityFields(config, this.fieldDefService, this.layoutExtension);
    if (this.workflowExt) {
      await seedWorkflows(config, this.workflowExt);
    }
    this.logger.log(`Seeded entity: ${config.entityType}`);
  }
}
