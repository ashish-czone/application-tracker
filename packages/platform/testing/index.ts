export { createPlatformTestModule, type PlatformTestModuleOptions } from './module-builder';
export { MockQueueModule } from './mock-queue.module';
export { MockAutomationsModule } from './mock-automations.module';

// Re-export core testing utilities for convenience
export { cleanDatabase } from '@packages/testing';
