import { describe, it, expect, beforeEach } from 'vitest';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { ScopeResolverRegistry, type ScopeResolver } from '../scope-resolver';
import { OwnScopeResolver } from '../scope-resolvers/own.resolver';
import { AssignedScopeResolver } from '../scope-resolvers/assigned.resolver';

// Minimal stand-in for a Drizzle column. The resolvers never introspect the
// column; they pass it to drizzle operators, so any object sentinel works for
// identity checks in these tests.
const mockColumn = (name: string): PgColumn => ({ name } as unknown as PgColumn);

describe('ScopeResolverRegistry', () => {
  let registry: ScopeResolverRegistry;

  beforeEach(() => {
    registry = new ScopeResolverRegistry();
  });

  it('registers and retrieves a resolver by type', () => {
    const resolver: ScopeResolver = { type: 'own', resolve: () => undefined };
    registry.register(resolver);
    expect(registry.get('own')).toBe(resolver);
    expect(registry.has('own')).toBe(true);
  });

  it('returns undefined for unknown scope types', () => {
    expect(registry.get('made-up')).toBeUndefined();
    expect(registry.has('made-up')).toBe(false);
  });

  it('throws on duplicate registration', () => {
    const first: ScopeResolver = { type: 'own', resolve: () => undefined };
    const second: ScopeResolver = { type: 'own', resolve: () => undefined };
    registry.register(first);
    expect(() => registry.register(second)).toThrow(/already registered/);
  });

  it('lists all registered types in insertion order', () => {
    registry.register({ type: 'own', resolve: () => undefined });
    registry.register({ type: 'assigned', resolve: () => undefined });
    expect(registry.list()).toEqual(['own', 'assigned']);
  });
});

describe('OwnScopeResolver', () => {
  const resolver = new OwnScopeResolver();

  it('declares type = "own"', () => {
    expect(resolver.type).toBe('own');
  });

  it('returns a predicate when creator anchor is present', () => {
    const creator = mockColumn('created_by');
    const predicate = resolver.resolve({
      userId: 'user-1',
      anchors: { creator },
    });
    expect(predicate).toBeDefined();
  });

  it('returns undefined when entity has no creator anchor', () => {
    const predicate = resolver.resolve({
      userId: 'user-1',
      anchors: {},
    });
    expect(predicate).toBeUndefined();
  });
});

describe('AssignedScopeResolver', () => {
  const resolver = new AssignedScopeResolver();

  it('declares type = "assigned"', () => {
    expect(resolver.type).toBe('assigned');
  });

  it('returns a predicate when assignee anchor is present', () => {
    const assignee = mockColumn('assignee_id');
    const predicate = resolver.resolve({
      userId: 'user-1',
      anchors: { assignee },
    });
    expect(predicate).toBeDefined();
  });

  it('returns undefined when entity has no assignee anchor', () => {
    const predicate = resolver.resolve({
      userId: 'user-1',
      anchors: { creator: mockColumn('created_by') },
    });
    expect(predicate).toBeUndefined();
  });
});
