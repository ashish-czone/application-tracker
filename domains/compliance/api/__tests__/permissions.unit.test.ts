import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_PERMISSIONS,
  COMPLIANCE_PERMISSION_MANIFESTS,
} from '../permissions';

describe('compliance permissions', () => {
  it('exposes the UI-surface permission strings as constants', () => {
    expect(COMPLIANCE_PERMISSIONS.FILINGS_READ).toBe('filings.read');
    expect(COMPLIANCE_PERMISSIONS.REPORTS_READ).toBe('reports.read');
  });

  it('every constant has a matching manifest entry', () => {
    const registered = new Set(COMPLIANCE_PERMISSION_MANIFESTS.map((m) => m.slug));
    for (const value of Object.values(COMPLIANCE_PERMISSIONS)) {
      expect(registered.has(value)).toBe(true);
    }
  });

  it('every manifest entry is well-formed', () => {
    for (const entry of COMPLIANCE_PERMISSION_MANIFESTS) {
      expect(entry.slug).toBe(`${entry.module}.${entry.action}`);
      expect(entry.label).toBeTruthy();
      expect(entry.module).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(entry.action).toMatch(/^[a-z][a-z0-9.-]*$/);
      expect(entry.supportedScopes.length).toBeGreaterThan(0);
    }
  });
});
