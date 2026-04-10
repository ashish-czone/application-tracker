import { Global, Module } from '@nestjs/common';
import { ActionRegistry } from '@packages/automations/services/action-registry';
import { EntityResolverRegistry } from '@packages/automations/services/entity-resolver-registry';
import { UserResolverRegistry } from '@packages/automations/services/user-resolver-registry';

/**
 * Mock AutomationsModule that provides the registries without the full module.
 * Used by platform packages that depend on automations registries (workflows, taxonomy, etc.).
 */
@Global()
@Module({
  providers: [ActionRegistry, EntityResolverRegistry, UserResolverRegistry],
  exports: [ActionRegistry, EntityResolverRegistry, UserResolverRegistry],
})
export class MockAutomationsModule {}
