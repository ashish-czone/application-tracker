import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditRegistryService } from '@packages/audit';
import { NotFoundException } from '@nestjs/common';

import { registerComplianceAudit } from '../register-compliance-audit';

const EXPECTED_SLUGS = [
  'clients',
  'client-contacts',
  'client-registrations',
  'laws',
  'compliance_rules',
  'compliance-filings',
  'law-handlers',
  'organization',
];

describe('registerComplianceAudit', () => {
  let registry: AuditRegistryService;
  let moduleRef: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registry = new AuditRegistryService();
    moduleRef = { get: vi.fn().mockReturnValue(null) };
  });

  it('registers every compliance entity slug with wildcard events', () => {
    registerComplianceAudit(registry, moduleRef as never);

    for (const slug of EXPECTED_SLUGS) {
      const match = registry.findRegistrationByEntityType(slug);
      expect(match, `expected registration for ${slug}`).not.toBeNull();
      expect(match!.registration.events).toBe('*');
    }
  });

  it('redacts taxId on clients and registrationNumber on client-registrations (Q24)', () => {
    registerComplianceAudit(registry, moduleRef as never);

    expect(
      registry.findRegistrationByEntityType('clients')!.registration.sensitiveFields,
    ).toEqual(['taxId']);
    expect(
      registry.findRegistrationByEntityType('client-registrations')!.registration.sensitiveFields,
    ).toEqual(['registrationNumber']);
  });

  it('non-PII-bearing modules have no sensitive fields configured', () => {
    registerComplianceAudit(registry, moduleRef as never);

    for (const slug of ['client-contacts', 'laws', 'compliance_rules', 'compliance-filings', 'law-handlers', 'organization']) {
      const reg = registry.findRegistrationByEntityType(slug)!.registration;
      expect(reg.sensitiveFields ?? []).toEqual([]);
    }
  });

  it('registers the compliance.* custom-event namespace for generator events', () => {
    registerComplianceAudit(registry, moduleRef as never);

    const match = registry.findRegistration('compliance.ComplianceFilingGenerated');
    expect(match).not.toBeNull();
    expect(match!.moduleName).toBe('compliance');
    // Generator events have no authoriseRead — firm-admin-only via audit.read_all.
    expect(match!.registration.authoriseRead).toBeUndefined();
  });

  it('authoriseRead returns false when entity-service is not registered', async () => {
    registerComplianceAudit(registry, moduleRef as never);

    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;
    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { 'clients.read': 'all' } },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
  });

  it('authoriseRead returns true when findOneOrFail resolves', async () => {
    const findOneOrFail = vi.fn().mockResolvedValue({ id: 'c1' });
    moduleRef.get.mockImplementation((token: string) => {
      if (token === 'ENTITY_SERVICE_clients') return { findOneOrFail };
      return null;
    });

    registerComplianceAudit(registry, moduleRef as never);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { '*': true } as never },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(true);
    expect(findOneOrFail).toHaveBeenCalledWith('c1', expect.objectContaining({ userId: 'u1' }));
  });

  it('authoriseRead returns false when findOneOrFail throws NotFoundException (out-of-scope)', async () => {
    const findOneOrFail = vi.fn().mockRejectedValue(new NotFoundException('Client not found'));
    moduleRef.get.mockImplementation((token: string) => {
      if (token === 'ENTITY_SERVICE_clients') return { findOneOrFail };
      return null;
    });

    registerComplianceAudit(registry, moduleRef as never);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: { '*': true } as never },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
  });

  it('authoriseRead returns false when user has no matching permission', async () => {
    const findOneOrFail = vi.fn().mockResolvedValue({ id: 'c1' });
    moduleRef.get.mockImplementation((token: string) => {
      if (token === 'ENTITY_SERVICE_clients') return { findOneOrFail };
      return null;
    });

    registerComplianceAudit(registry, moduleRef as never);
    const { authoriseRead } = registry.findRegistrationByEntityType('clients')!.registration;

    const result = await authoriseRead!({
      user: { userId: 'u1', permissions: {} },
      entityType: 'clients',
      entityId: 'c1',
    });

    expect(result).toBe(false);
    expect(findOneOrFail).not.toHaveBeenCalled();
  });
});
