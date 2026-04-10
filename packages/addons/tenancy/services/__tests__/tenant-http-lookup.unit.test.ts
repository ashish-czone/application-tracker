import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenantHttpLookup } from '../tenant-http-lookup';
import type { TenancyConfig, TenantInfo } from '../../types';

const mockTenant: TenantInfo = {
  id: 'tenant-uuid-1',
  slug: 'acme',
  name: 'ACME Corp',
  databaseUrl: 'postgresql://acme:pass@localhost:5432/acme',
  status: 'active',
  plan: 'professional',
  capabilities: ['automations', 'custom_fields'],
  planExpiry: '2026-12-31',
};

describe('TenantHttpLookup', () => {
  let lookup: TenantHttpLookup;
  const mockGetAuthHeaders = vi.fn();
  const mockLogError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuthHeaders.mockReturnValue({
      Authorization: 'Bearer mock-token',
    });

    const mockServiceAuthClient = {
      getAuthHeaders: mockGetAuthHeaders,
      createToken: vi.fn().mockReturnValue('mock-token'),
    };

    const mockLogger = {
      forContext: vi.fn().mockReturnValue({
        log: vi.fn(),
        warn: vi.fn(),
        error: mockLogError,
        debug: vi.fn(),
      }),
    };

    lookup = new TenantHttpLookup(
      {
        mode: 'database',
        resolver: 'header',
        controlPlaneUrl: 'http://localhost:3013',
      } as TenancyConfig,
      mockServiceAuthClient as any,
      mockLogger as any,
    );
  });

  describe('findBySlug', () => {
    it('should call control-plane API with service auth headers', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenant), { status: 200 }),
      );

      const result = await lookup.findBySlug('acme');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3013/internal/tenants/acme',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
        },
      );
      expect(result).toEqual(mockTenant);
    });

    it('should return null for 404 responses', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(null, { status: 404 }),
      );

      const result = await lookup.findBySlug('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null and log error for non-OK responses', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const result = await lookup.findBySlug('acme');
      expect(result).toBeNull();
      expect(mockLogError).toHaveBeenCalledWith(
        'Control-plane lookup failed',
        expect.objectContaining({ status: 500 }),
      );
    });

    it('should return null and log error on network failure', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await lookup.findBySlug('acme');
      expect(result).toBeNull();
      expect(mockLogError).toHaveBeenCalled();
    });

    it('should cache results and avoid repeated HTTP calls', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenant), { status: 200 }),
      );

      await lookup.findBySlug('acme');
      await lookup.findBySlug('acme');
      await lookup.findBySlug('acme');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should URL-encode the slug', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(null, { status: 404 }),
      );

      await lookup.findBySlug('acme corp');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3013/internal/tenants/acme%20corp',
        expect.any(Object),
      );
    });
  });

  describe('findById', () => {
    it('should call by-id endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenant), { status: 200 }),
      );

      const result = await lookup.findById('tenant-uuid-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3013/internal/tenants/by-id/tenant-uuid-1',
        expect.any(Object),
      );
      expect(result).toEqual(mockTenant);
    });

    it('should use cache populated by findBySlug', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenant), { status: 200 }),
      );

      // First call populates both slug and ID caches
      await lookup.findBySlug('acme');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call should use ID cache — no additional fetch
      const result = await lookup.findById('tenant-uuid-1');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('evict', () => {
    it('should remove tenant from cache and re-fetch on next call', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockTenant), { status: 200 }),
      );

      await lookup.findBySlug('acme');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      lookup.evict('acme');

      await lookup.findBySlug('acme');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
