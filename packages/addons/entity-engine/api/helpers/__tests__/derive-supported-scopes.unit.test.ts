import { describe, it, expect } from 'vitest';
import type { ScopeResolver } from '@packages/rbac';
import type { DataAccessConfig } from '../../types';
import { deriveSupportedScopes } from '../derive-supported-scopes';

function resolver(type: string, requiredAnchors?: readonly string[]): ScopeResolver {
  return { type, requiredAnchors, resolve: () => undefined } as ScopeResolver;
}

const own = resolver('own', ['creator']);
const assigned = resolver('assigned', ['assignee']);
const unit = resolver('unit', ['creator', 'assignee', 'team']);
const descendants = resolver('descendants', ['creator', 'assignee', 'team']);
const custom = resolver('custom-no-anchor'); // no required anchors

describe('deriveSupportedScopes', () => {
  it("always includes 'any'", () => {
    const result = deriveSupportedScopes({ dataAccess: undefined }, []);
    expect(result).toEqual(['any']);
  });

  it('includes resolvers whose required anchors are declared', () => {
    const dataAccess: DataAccessConfig = { anchors: { creator: 'createdBy' } };
    const result = deriveSupportedScopes({ dataAccess }, [own, assigned]);
    expect(result).toContain('own');
    expect(result).not.toContain('assigned');
  });

  it('includes hierarchy resolvers when any of creator/assignee/team is declared', () => {
    const dataAccess: DataAccessConfig = { anchors: { team: 'teamId' } };
    const result = deriveSupportedScopes({ dataAccess }, [unit, descendants]);
    expect(result).toEqual(expect.arrayContaining(['unit', 'descendants']));
  });

  it('always includes resolvers without required anchors', () => {
    const dataAccess: DataAccessConfig = {};
    const result = deriveSupportedScopes({ dataAccess }, [custom, own]);
    expect(result).toContain('custom-no-anchor');
    expect(result).not.toContain('own');
  });

  it('includes entity-inline scope keys', () => {
    const dataAccess: DataAccessConfig = {
      anchors: { creator: 'createdBy' },
      scopes: [
        { key: 'hiring-manager', label: 'Hiring manager', resolve: async () => ({} as any) },
      ],
    };
    const result = deriveSupportedScopes({ dataAccess }, [own]);
    expect(result).toEqual(expect.arrayContaining(['any', 'own', 'hiring-manager']));
  });

  it('returns a deduplicated list when resolvers and inline scopes overlap', () => {
    const dataAccess: DataAccessConfig = {
      anchors: { creator: 'createdBy' },
      scopes: [{ key: 'own', label: 'Own (shadowed)', resolve: async () => ({} as any) }],
    };
    const result = deriveSupportedScopes({ dataAccess }, [own]);
    const ownCount = result.filter((s) => s === 'own').length;
    expect(ownCount).toBe(1);
  });

  it('works with no declared anchors and entity-specific inline scopes', () => {
    const dataAccess: DataAccessConfig = {
      scopes: [
        { key: 'unassigned_in_unit', label: 'Pool', resolve: async () => ({} as any) },
      ],
    };
    const result = deriveSupportedScopes({ dataAccess }, [own, unit]);
    expect(result).toEqual(['any', 'unassigned_in_unit']);
  });
});
