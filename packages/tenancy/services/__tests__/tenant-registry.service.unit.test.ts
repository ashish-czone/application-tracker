import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantRegistryService } from '../tenant-registry.service';
import type { TenantInfo } from '../../types';

// --- Mock helpers ---

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeTenantRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'tenant-1',
    slug: 'acme',
    name: 'ACME Corp',
    databaseUrl: 'postgresql://acme:pass@localhost:5432/acme',
    status: 'active',
    plan: 'professional',
    capabilities: ['automations', 'custom_fields'],
    planExpiry: '2026-12-31',
    clientId: 'client-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function expectedTenantInfo(overrides?: Partial<TenantInfo>): TenantInfo {
  return {
    id: 'tenant-1',
    slug: 'acme',
    name: 'ACME Corp',
    databaseUrl: 'postgresql://acme:pass@localhost:5432/acme',
    status: 'active',
    plan: 'professional',
    capabilities: ['automations', 'custom_fields'],
    planExpiry: '2026-12-31',
    clientId: 'client-1',
    ...overrides,
  };
}

// --- Tests ---

describe('TenantRegistryService', () => {
  let service: TenantRegistryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new TenantRegistryService({ db: mockDb } as any);
  });

  // ──────────────────────────────────────────────────────────
  // findBySlug()
  // ──────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('should return tenant info when tenant exists', async () => {
      const row = makeTenantRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findBySlug('acme');

      expect(result).toEqual(expectedTenantInfo());
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when tenant does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findBySlug('nonexistent');

      expect(result).toBeNull();
    });

    it('should query the tenants table with the correct slug', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.findBySlug('acme');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
      expect(mockDb._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should convert null optional fields to undefined', async () => {
      const row = makeTenantRow({
        plan: null,
        capabilities: null,
        planExpiry: null,
        clientId: null,
      });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findBySlug('acme');

      expect(result).toEqual(
        expectedTenantInfo({
          plan: undefined,
          capabilities: undefined,
          planExpiry: undefined,
          clientId: undefined,
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // findById()
  // ──────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return tenant info when tenant exists', async () => {
      const row = makeTenantRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result).toEqual(expectedTenantInfo());
    });

    it('should return null when tenant does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with limit 1', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.findById('tenant-1');

      expect(mockDb._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should convert null optional fields to undefined', async () => {
      const row = makeTenantRow({
        plan: null,
        capabilities: null,
        planExpiry: null,
        clientId: null,
      });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.plan).toBeUndefined();
      expect(result!.capabilities).toBeUndefined();
      expect(result!.planExpiry).toBeUndefined();
      expect(result!.clientId).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // list()
  // ──────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return all tenants', async () => {
      const rows = [
        makeTenantRow({ id: 'tenant-1', slug: 'acme' }),
        makeTenantRow({ id: 'tenant-2', slug: 'globex', name: 'Globex Corp' }),
      ];
      mockDb._chain.from.mockResolvedValueOnce(rows);

      const result = await service.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('tenant-1');
      expect(result[1].id).toBe('tenant-2');
    });

    it('should return empty array when no tenants exist', async () => {
      mockDb._chain.from.mockResolvedValueOnce([]);

      const result = await service.list();

      expect(result).toEqual([]);
    });

    it('should map all rows through toTenantInfo', async () => {
      const rows = [
        makeTenantRow({ plan: null, capabilities: null }),
      ];
      mockDb._chain.from.mockResolvedValueOnce(rows);

      const result = await service.list();

      expect(result[0].plan).toBeUndefined();
      expect(result[0].capabilities).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // listByStatus()
  // ──────────────────────────────────────────────────────────

  describe('listByStatus', () => {
    it('should return tenants filtered by active status', async () => {
      const rows = [makeTenantRow({ status: 'active' })];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.listByStatus('active');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('active');
    });

    it('should return tenants filtered by suspended status', async () => {
      const rows = [
        makeTenantRow({ id: 'tenant-2', status: 'suspended' }),
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.listByStatus('suspended');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('suspended');
    });

    it('should return tenants filtered by provisioning status', async () => {
      const rows = [
        makeTenantRow({ id: 'tenant-3', status: 'provisioning' }),
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.listByStatus('provisioning');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('provisioning');
    });

    it('should return empty array when no tenants match status', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.listByStatus('suspended');

      expect(result).toEqual([]);
    });

    it('should query from tenants table with status filter', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      await service.listByStatus('active');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a tenant with required fields and return tenant info', async () => {
      const newRow = makeTenantRow({
        id: 'tenant-new',
        slug: 'newco',
        name: 'NewCo',
        databaseUrl: 'postgresql://newco:pass@localhost:5432/newco',
      });
      mockDb._chain.returning.mockResolvedValueOnce([newRow]);

      const result = await service.create({
        slug: 'newco',
        name: 'NewCo',
        databaseUrl: 'postgresql://newco:pass@localhost:5432/newco',
      });

      expect(result.id).toBe('tenant-new');
      expect(result.slug).toBe('newco');
      expect(result.name).toBe('NewCo');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should pass all optional fields to insert', async () => {
      const createData = {
        slug: 'newco',
        name: 'NewCo',
        databaseUrl: 'postgresql://newco:pass@localhost:5432/newco',
        status: 'provisioning' as const,
        plan: 'enterprise',
        capabilities: ['automations', 'webhooks'],
        planExpiry: '2027-06-30',
        clientId: 'client-99',
      };

      const newRow = makeTenantRow({
        id: 'tenant-new',
        ...createData,
      });
      mockDb._chain.returning.mockResolvedValueOnce([newRow]);

      const result = await service.create(createData);

      expect(mockDb._chain.values).toHaveBeenCalledWith(createData);
      expect(result.status).toBe('provisioning');
      expect(result.plan).toBe('enterprise');
      expect(result.capabilities).toEqual(['automations', 'webhooks']);
      expect(result.planExpiry).toBe('2027-06-30');
      expect(result.clientId).toBe('client-99');
    });

    it('should create tenant without optional fields', async () => {
      const newRow = makeTenantRow({
        id: 'tenant-new',
        slug: 'minimal',
        name: 'Minimal',
        databaseUrl: 'postgresql://min:pass@localhost:5432/min',
        status: 'active',
        plan: null,
        capabilities: null,
        planExpiry: null,
        clientId: null,
      });
      mockDb._chain.returning.mockResolvedValueOnce([newRow]);

      const result = await service.create({
        slug: 'minimal',
        name: 'Minimal',
        databaseUrl: 'postgresql://min:pass@localhost:5432/min',
      });

      expect(result.plan).toBeUndefined();
      expect(result.capabilities).toBeUndefined();
      expect(result.planExpiry).toBeUndefined();
      expect(result.clientId).toBeUndefined();
    });

    it('should use returning() to get the inserted row', async () => {
      const newRow = makeTenantRow({ id: 'tenant-new' });
      mockDb._chain.returning.mockResolvedValueOnce([newRow]);

      await service.create({
        slug: 'test',
        name: 'Test',
        databaseUrl: 'postgresql://test:pass@localhost:5432/test',
      });

      expect(mockDb._chain.returning).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update tenant and return updated tenant info', async () => {
      const updatedRow = makeTenantRow({ name: 'ACME Industries' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await service.update('tenant-1', { name: 'ACME Industries' });

      expect(result.name).toBe('ACME Industries');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should include updatedAt in the set data', async () => {
      const updatedRow = makeTenantRow({ name: 'Updated' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      await service.update('tenant-1', { name: 'Updated' });

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should update slug', async () => {
      const updatedRow = makeTenantRow({ slug: 'acme-new' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await service.update('tenant-1', { slug: 'acme-new' });

      expect(result.slug).toBe('acme-new');
    });

    it('should update databaseUrl', async () => {
      const newUrl = 'postgresql://acme:newpass@db.example.com:5432/acme';
      const updatedRow = makeTenantRow({ databaseUrl: newUrl });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await service.update('tenant-1', { databaseUrl: newUrl });

      expect(result.databaseUrl).toBe(newUrl);
    });

    it('should update status', async () => {
      const updatedRow = makeTenantRow({ status: 'suspended' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await service.update('tenant-1', { status: 'suspended' });

      expect(result.status).toBe('suspended');
    });

    it('should update plan and capabilities', async () => {
      const updatedRow = makeTenantRow({
        plan: 'enterprise',
        capabilities: ['automations', 'webhooks', 'api_access'],
      });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await service.update('tenant-1', {
        plan: 'enterprise',
        capabilities: ['automations', 'webhooks', 'api_access'],
      });

      expect(result.plan).toBe('enterprise');
      expect(result.capabilities).toEqual(['automations', 'webhooks', 'api_access']);
    });

    it('should update multiple fields at once', async () => {
      const updatedRow = makeTenantRow({
        name: 'ACME v2',
        plan: 'enterprise',
        status: 'active',
      });
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      await service.update('tenant-1', {
        name: 'ACME v2',
        plan: 'enterprise',
        status: 'active',
      });

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ACME v2',
          plan: 'enterprise',
          status: 'active',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should use returning() to get the updated row', async () => {
      const updatedRow = makeTenantRow();
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      await service.update('tenant-1', { name: 'Test' });

      expect(mockDb._chain.returning).toHaveBeenCalled();
    });

    it('should filter by tenant id in the where clause', async () => {
      const updatedRow = makeTenantRow();
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      await service.update('tenant-1', { name: 'Test' });

      expect(mockDb._chain.where).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // updateStatus()
  // ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update tenant status to suspended', async () => {
      await service.updateStatus('tenant-1', 'suspended');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'suspended',
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should update tenant status to active', async () => {
      await service.updateStatus('tenant-1', 'active');

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        }),
      );
    });

    it('should update tenant status to provisioning', async () => {
      await service.updateStatus('tenant-1', 'provisioning');

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'provisioning',
        }),
      );
    });

    it('should return void (no returning clause)', async () => {
      const result = await service.updateStatus('tenant-1', 'active');

      expect(result).toBeUndefined();
    });

    it('should filter by tenant id', async () => {
      await service.updateStatus('tenant-1', 'active');

      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should include updatedAt timestamp', async () => {
      const beforeCall = new Date();
      await service.updateStatus('tenant-1', 'active');

      const setCallArg = mockDb._chain.set.mock.calls[0][0];
      expect(setCallArg.updatedAt).toBeInstanceOf(Date);
      expect(setCallArg.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    });
  });

  // ──────────────────────────────────────────────────────────
  // toTenantInfo (private, tested indirectly)
  // ──────────────────────────────────────────────────────────

  describe('toTenantInfo mapping', () => {
    it('should map all required fields from row to TenantInfo', async () => {
      const row = makeTenantRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findBySlug('acme');

      expect(result).toEqual({
        id: 'tenant-1',
        slug: 'acme',
        name: 'ACME Corp',
        databaseUrl: 'postgresql://acme:pass@localhost:5432/acme',
        status: 'active',
        plan: 'professional',
        capabilities: ['automations', 'custom_fields'],
        planExpiry: '2026-12-31',
        clientId: 'client-1',
      });
    });

    it('should exclude createdAt and updatedAt from TenantInfo', async () => {
      const row = makeTenantRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findBySlug('acme');

      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should convert null plan to undefined', async () => {
      const row = makeTenantRow({ plan: null });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.plan).toBeUndefined();
    });

    it('should convert null capabilities to undefined', async () => {
      const row = makeTenantRow({ capabilities: null });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.capabilities).toBeUndefined();
    });

    it('should convert null planExpiry to undefined', async () => {
      const row = makeTenantRow({ planExpiry: null });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.planExpiry).toBeUndefined();
    });

    it('should convert null clientId to undefined', async () => {
      const row = makeTenantRow({ clientId: null });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.clientId).toBeUndefined();
    });

    it('should preserve non-null optional fields', async () => {
      const row = makeTenantRow({
        plan: 'enterprise',
        capabilities: ['sso', 'api'],
        planExpiry: '2027-01-01',
        clientId: 'client-42',
      });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findById('tenant-1');

      expect(result!.plan).toBe('enterprise');
      expect(result!.capabilities).toEqual(['sso', 'api']);
      expect(result!.planExpiry).toBe('2027-01-01');
      expect(result!.clientId).toBe('client-42');
    });

    it('should cast status to TenantInfo status type', async () => {
      const row = makeTenantRow({ status: 'provisioning' });
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findBySlug('acme');

      expect(result!.status).toBe('provisioning');
    });
  });

  // ──────────────────────────────────────────────────────────
  // TenantLookup interface compliance
  // ──────────────────────────────────────────────────────────

  describe('TenantLookup interface', () => {
    it('should implement findBySlug from TenantLookup', () => {
      expect(typeof service.findBySlug).toBe('function');
    });

    it('should implement findById from TenantLookup', () => {
      expect(typeof service.findById).toBe('function');
    });
  });
});
