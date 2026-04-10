export { createPlatformTestModule, type PlatformTestModuleOptions } from './module-builder';
export { createPackageTestApp, withAuth, type PackageTestAppOptions, type PackageTestApp } from './http-test-app';
export { MockQueueModule } from './mock-queue.module';
export { MockAutomationsModule } from './mock-automations.module';
export { MockAuthGuard } from './mock-auth.guard';
export { MockRbacGuard } from './mock-rbac.guard';

// Re-export core testing utilities for convenience
export { cleanDatabase } from '@packages/testing';
