import { Global, Module } from '@nestjs/common';
import { ActionRegistry, EntityResolverRegistry, UserResolverRegistry } from '@packages/automation-contracts';

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
