import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_PERMISSIONS,
  COMPLIANCE_PERMISSION_REGISTRATIONS,
} from '../permissions';

describe('compliance permissions', () => {
  it('exposes the UI-surface permission strings as constants', () => {
    expect(COMPLIANCE_PERMISSIONS.OBLIGATIONS_READ).toBe('obligations.read');
    expect(COMPLIANCE_PERMISSIONS.FILINGS_READ).toBe('filings.read');
    expect(COMPLIANCE_PERMISSIONS.REPORTS_READ).toBe('reports.read');
  });

  it('every constant has a matching registration entry', () => {
    const registered = new Set(
      COMPLIANCE_PERMISSION_REGISTRATIONS.map((r) => `${r.module}.${r.action}`),
    );

    for (const value of Object.values(COMPLIANCE_PERMISSIONS)) {
      expect(registered.has(value)).toBe(true);
    }
  });

  it('every registration entry has a non-empty description', () => {
    for (const entry of COMPLIANCE_PERMISSION_REGISTRATIONS) {
      expect(entry.description).toBeTruthy();
      expect(entry.module).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(entry.action).toMatch(/^[a-z][a-z0-9.-]*$/);
    }
  });
});
