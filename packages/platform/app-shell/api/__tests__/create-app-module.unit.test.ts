import { describe, it, expect, beforeAll } from 'vitest';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { DomainBackendManifest } from '@packages/domains';
import { createAppModule } from '../create-app-module';
import { GlobalExceptionFilter } from '../filters/global-exception.filter';
import { ConfigurableThrottlerGuard } from '../guards/configurable-throttler.guard';

@Module({})
class FakeDomainModule {}

const fakeDomain: DomainBackendManifest = {
  name: 'fake',
  displayName: 'Fake',
  module: FakeDomainModule,
};

@Module({})
class FakeAddonModule {}

describe('createAppModule', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.REDIS_URL = 'redis://test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    process.env.ALLOWED_ORIGINS = 'http://localhost';
  });

  it('returns ModuleMetadata with imports and providers', () => {
    const meta = createAppModule({
      domains: [fakeDomain],
      envFilePath: '/tmp/.env',
      appName: 'fake',
    });

    expect(meta.imports).toBeDefined();
    expect(Array.isArray(meta.imports)).toBe(true);
    expect(meta.providers).toBeDefined();
    expect(Array.isArray(meta.providers)).toBe(true);
  });

  it('appends each domain module to imports', () => {
    const meta = createAppModule({
      domains: [fakeDomain],
      envFilePath: '/tmp/.env',
      appName: 'fake',
    });

    expect(meta.imports).toContain(FakeDomainModule);
  });

  it('supports multiple domains', () => {
    @Module({})
    class SecondDomainModule {}
    const second: DomainBackendManifest = {
      name: 'second',
      displayName: 'Second',
      module: SecondDomainModule,
    };

    const meta = createAppModule({
      domains: [fakeDomain, second],
      envFilePath: '/tmp/.env',
      appName: 'fake',
    });

    expect(meta.imports).toContain(FakeDomainModule);
    expect(meta.imports).toContain(SecondDomainModule);
  });

  it('appends extraImports before domain modules', () => {
    const meta = createAppModule({
      domains: [fakeDomain],
      envFilePath: '/tmp/.env',
      appName: 'fake',
      extraImports: [FakeAddonModule],
    });

    const imports = meta.imports!;
    expect(imports).toContain(FakeAddonModule);
    expect(imports).toContain(FakeDomainModule);
    expect(imports.indexOf(FakeAddonModule)).toBeLessThan(
      imports.indexOf(FakeDomainModule),
    );
  });

  it('includes platform-wide global filter and guards', () => {
    const meta = createAppModule({
      domains: [fakeDomain],
      envFilePath: '/tmp/.env',
      appName: 'fake',
    });

    const providers = meta.providers!;
    const filterEntry = providers.find(
      (p): p is { provide: symbol; useClass: unknown } =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        (p as { provide: unknown }).provide === APP_FILTER,
    );
    expect(filterEntry?.useClass).toBe(GlobalExceptionFilter);

    const guards = providers.filter(
      (p): p is { provide: symbol; useClass: unknown } =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        (p as { provide: unknown }).provide === APP_GUARD,
    );
    expect(guards.some((g) => g.useClass === ConfigurableThrottlerGuard)).toBe(true);
  });

  it('handles empty extraImports', () => {
    const meta = createAppModule({
      domains: [fakeDomain],
      envFilePath: '/tmp/.env',
      appName: 'fake',
    });

    expect(meta.imports).toContain(FakeDomainModule);
  });
});
