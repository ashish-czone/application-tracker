import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditRegistryService } from '@packages/audit';
import { NotFoundException } from '@nestjs/common';

import {
  registerComplianceAudit,
  type ComplianceEntityReader,
} from '../register-compliance-audit';

const EXPECTED_SLUGS = [
  'clients',
  'client-contacts',
  'client-registrations',
  'laws',
  'compliance-rules',
  'compliance-filings',
  'law-handlers',
  'organizations',
];

describe('registerComplianceAudit', () => {
  let registry: AuditRegistryService;
  let readers: Map<string, ComplianceEntityReader>;

  beforeEach(() => {
    registry = new AuditRegistryService();
    readers = new Map();
  });

  it('registers every compliance entity slug with wildcard events', () => {
    registerComplianceAudit(registry, readers);

    for (const slug of EXPECTED_SLUGS) {
      const match = registry.findRegistrationByEntityType(slug);
      expect(match, `expected registration for ${slug}`).not.toBeNull();
      expect(match!.registration.events).toBe('*');
    }
  });

  it('redacts taxId on clients and registrationNumber on client-registrations (Q24)', () => {
    registerComplianceAudit(registry, readers);

    expect(
      registry.findRegistrationByEntityType('clients')!.registration.sensitiveFields,
    ).toEqual(['taxId']);
    expect(
      registry.findRegistrationByEntityType('client-registrations')!.registration.sensitiveFields,
    ).toEqual(['registrationNumber']);
  });

  it('non-PII-bearing modules have no sensitive fields configured', () => {
    registerComplianceAudit(registry, readers);

    for (const slug of ['client-contacts', 'laws', 'compliance-rules', 'compliance-filings', 'law-handlers', 'organizations']) {
      const reg = registry.findRegistrationByEntityType(slug)!.registration;
      expect(reg.sensitiveFields ?? []).toEqual([]);
    }
  });

  it('registers the compliance.* custom-event namespace for generator events', () => {
    registerComplianceAudit(registry, readers);

    const match = registry.findRegistration('compliance.ComplianceFilingGenerated');
    expect(match).not.toBeNull();
    expect(match!.moduleName).toBe('compliance');
    // Generator events have no authoriseRead — firm-admin-only via audit.read_all.
    expect(match!.registration.authoriseRead).toBeUndefined();
  });

  it('authoriseRead returns false when no reader is registered for the slug', async () => {
    registerComplianceAudit(registry, readers);

    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;
    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { 'clients.read': 'all' } },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
  });

  it('authoriseRead returns true when the reader resolves', async () => {
    const reader = vi.fn().mockResolvedValue({ id: 'c1' });
    readers.set('clients', reader);

    registerComplianceAudit(registry, readers);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { '*': true } as never },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(true);
    expect(reader).toHaveBeenCalledWith('c1', expect.objectContaining({ userId: 'u1' }));
  });

  it('authoriseRead returns false when the reader throws NotFoundException (out-of-scope)', async () => {
    const reader = vi.fn().mockRejectedValue(new NotFoundException('Client not found'));
    readers.set('clients', reader);

    registerComplianceAudit(registry, readers);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { '*': true } as never },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
  });

  it('authoriseRead returns false when user has no matching permission', async () => {
    const reader = vi.fn().mockResolvedValue({ id: 'c1' });
    readers.set('clients', reader);

    registerComplianceAudit(registry, readers);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: {} },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
    expect(reader).not.toHaveBeenCalled();
  });
});
