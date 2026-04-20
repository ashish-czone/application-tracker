import { describe, it, expect } from 'vitest';
import { splitExtensionPayload } from '../split-extension-payload';
import type { ResolvedExtension } from '../../types';

function makeExt(projectedKeys: string[]): ResolvedExtension {
  return {
    parentEntityType: 'tasks',
    parentTable: {} as any,
    foreignKeyColumn: {} as any,
    parentIdColumn: {} as any,
    projectedColumns: projectedKeys.map(fieldKey => ({ fieldKey, column: {} as any })),
    parentDefaults: {},
  };
}

describe('splitExtensionPayload', () => {
  it('routes projected keys to parent and everything else to child', () => {
    const ext = makeExt(['title', 'priority']);
    const result = splitExtensionPayload(
      { title: 'Check', priority: 'high', ruleId: 'r1' },
      ext,
    );
    expect(result.parentFields).toEqual({ title: 'Check', priority: 'high' });
    expect(result.childFields).toEqual({ ruleId: 'r1' });
  });

  it('handles a parent-only payload', () => {
    const ext = makeExt(['title', 'priority']);
    const result = splitExtensionPayload({ title: 'Edit', priority: 'low' }, ext);
    expect(result.parentFields).toEqual({ title: 'Edit', priority: 'low' });
    expect(result.childFields).toEqual({});
  });

  it('handles a child-only payload', () => {
    const ext = makeExt(['title', 'priority']);
    const result = splitExtensionPayload({ ruleId: 'r1', severity: 'high' }, ext);
    expect(result.parentFields).toEqual({});
    expect(result.childFields).toEqual({ ruleId: 'r1', severity: 'high' });
  });

  it('handles an empty payload', () => {
    const ext = makeExt(['title']);
    expect(splitExtensionPayload({}, ext)).toEqual({ parentFields: {}, childFields: {} });
  });

  it('preserves falsy values (null, false, 0, empty string)', () => {
    const ext = makeExt(['title', 'archived']);
    const result = splitExtensionPayload(
      { title: '', archived: false, count: 0, ruleId: null },
      ext,
    );
    expect(result.parentFields).toEqual({ title: '', archived: false });
    expect(result.childFields).toEqual({ count: 0, ruleId: null });
  });

  it('does not include keys that are absent from the payload', () => {
    const ext = makeExt(['title', 'priority', 'kind']);
    const result = splitExtensionPayload({ title: 'X' }, ext);
    expect(result.parentFields).toEqual({ title: 'X' });
    expect(Object.keys(result.parentFields)).not.toContain('priority');
    expect(Object.keys(result.parentFields)).not.toContain('kind');
  });

  it('returns new objects (does not mutate input)', () => {
    const ext = makeExt(['title']);
    const input = { title: 'X', ruleId: 'r1' };
    const result = splitExtensionPayload(input, ext);
    expect(input).toEqual({ title: 'X', ruleId: 'r1' });
    expect(result.parentFields).not.toBe(input);
    expect(result.childFields).not.toBe(input);
  });
});
