import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const migrateMock = vi.fn();
const poolEndMock = vi.fn();
const poolCtorMock = vi.fn();
const drizzleMock = vi.fn();

vi.mock('drizzle-orm/node-postgres/migrator', () => ({
  migrate: (...args: unknown[]) => migrateMock(...args),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: (...args: unknown[]) => {
    drizzleMock(...args);
    return { __fakeDb: true };
  },
}));

vi.mock('pg', () => ({
  Pool: class {
    constructor(config: unknown) {
      poolCtorMock(config);
    }
    end() {
      return poolEndMock();
    }
  },
}));

import { migrationsTableFor, runMigrations } from '../migrator';

describe('migrationsTableFor', () => {
  it('slugifies scoped package names', () => {
    expect(migrationsTableFor('@packages/platform/auth')).toBe(
      '__drizzle_migrations__packages_platform_auth',
    );
  });

  it('handles domain paths', () => {
    expect(migrationsTableFor('@domains/recruit')).toBe(
      '__drizzle_migrations__domains_recruit',
    );
  });

  it('strips leading/trailing separators', () => {
    expect(migrationsTableFor('/foo/bar/')).toBe('__drizzle_migrations__foo_bar');
  });
});

describe('runMigrations', () => {
  beforeEach(() => {
    migrateMock.mockReset();
    poolEndMock.mockReset();
    poolCtorMock.mockReset();
    drizzleMock.mockReset();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('throws when DATABASE_URL is missing', async () => {
    await expect(
      runMigrations({ packages: [{ name: 'a', migrationsFolder: '/tmp/a' }] }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('returns early when no packages provided', async () => {
    const logs: string[] = [];
    await runMigrations({
      packages: [],
      databaseUrl: 'postgres://test',
      logger: (m) => logs.push(m),
    });
    expect(migrateMock).not.toHaveBeenCalled();
    expect(poolCtorMock).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes('nothing to do'))).toBe(true);
  });

  it('calls migrate() once per package with a per-package table name, in order', async () => {
    const logs: string[] = [];
    const packages = [
      { name: '@packages/database', migrationsFolder: '/tmp/a' },
      { name: '@packages/platform/auth', migrationsFolder: '/tmp/b' },
      { name: '@domains/recruit', migrationsFolder: '/tmp/c' },
    ];

    await runMigrations({
      packages,
      databaseUrl: 'postgres://test',
      logger: (m) => logs.push(m),
    });

    expect(poolCtorMock).toHaveBeenCalledOnce();
    expect(poolCtorMock).toHaveBeenCalledWith({ connectionString: 'postgres://test' });
    expect(drizzleMock).toHaveBeenCalledOnce();
    expect(migrateMock).toHaveBeenCalledTimes(3);

    expect(migrateMock.mock.calls[0][1]).toEqual({
      migrationsFolder: '/tmp/a',
      migrationsTable: '__drizzle_migrations__packages_database',
    });
    expect(migrateMock.mock.calls[1][1]).toEqual({
      migrationsFolder: '/tmp/b',
      migrationsTable: '__drizzle_migrations__packages_platform_auth',
    });
    expect(migrateMock.mock.calls[2][1]).toEqual({
      migrationsFolder: '/tmp/c',
      migrationsTable: '__drizzle_migrations__domains_recruit',
    });

    expect(poolEndMock).toHaveBeenCalledOnce();
  });

  it('closes the pool even when migrate() throws', async () => {
    migrateMock.mockRejectedValueOnce(new Error('boom'));
    await expect(
      runMigrations({
        packages: [{ name: 'a', migrationsFolder: '/tmp/a' }],
        databaseUrl: 'postgres://test',
        logger: () => {},
      }),
    ).rejects.toThrow('boom');
    expect(poolEndMock).toHaveBeenCalledOnce();
  });

  it('reads DATABASE_URL from process.env when not passed explicitly', async () => {
    process.env.DATABASE_URL = 'postgres://from-env';
    await runMigrations({
      packages: [{ name: 'a', migrationsFolder: '/tmp/a' }],
      logger: () => {},
    });
    expect(poolCtorMock).toHaveBeenCalledWith({ connectionString: 'postgres://from-env' });
  });
});
