import { describe, it, expect } from 'vitest';
import { transitionKind } from '../DataSourcePicker';
import type { DataSource } from '@packages/blocks-contract';

const entities = [{ slug: 'testimonials' }, { slug: 'team' }];

describe('transitionKind', () => {
  it('moves static → static idempotently', () => {
    const next = transitionKind({ kind: 'static' }, 'static', entities);
    expect(next).toEqual({ kind: 'static' });
  });

  it('moves static → entity-query and seeds entity from the first available', () => {
    const next = transitionKind({ kind: 'static' }, 'entity-query', entities);
    expect(next).toEqual({ kind: 'entity-query', entity: 'testimonials', sort: undefined, limit: 10 });
  });

  it('falls back to static when crossing to entity-query with no entities', () => {
    const next = transitionKind({ kind: 'static' }, 'entity-query', []);
    expect(next).toEqual({ kind: 'static' });
  });

  it('preserves entity/sort/limit when staying in entity-query', () => {
    const current: DataSource = {
      kind: 'entity-query',
      entity: 'team',
      sort: '-displayOrder',
      limit: 6,
    };
    const next = transitionKind(current, 'entity-query', entities);
    expect(next).toEqual(current);
  });

  it('preserves entity when moving entity-ids → entity-query', () => {
    const current: DataSource = { kind: 'entity-ids', entity: 'team', ids: ['a'] };
    const next = transitionKind(current, 'entity-query', entities);
    expect(next).toMatchObject({ kind: 'entity-query', entity: 'team', limit: 10 });
  });

  it('moves entity-query → static, dropping entity/sort/limit', () => {
    const current: DataSource = { kind: 'entity-query', entity: 'team', limit: 5 };
    const next = transitionKind(current, 'static', entities);
    expect(next).toEqual({ kind: 'static' });
  });

  it('returns current shape unchanged for entity-ids passthrough (not handled in v1)', () => {
    const current: DataSource = { kind: 'entity-ids', entity: 'team', ids: ['x'] };
    const next = transitionKind(current, 'entity-ids', entities);
    expect(next).toEqual(current);
  });
});
