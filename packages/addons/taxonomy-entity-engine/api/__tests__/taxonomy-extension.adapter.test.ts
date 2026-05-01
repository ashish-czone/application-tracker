import { describe, it, expect, vi } from 'vitest';
import { TaxonomyExtensionAdapter } from '../taxonomy-extension.adapter';

describe('TaxonomyExtensionAdapter', () => {
  it('getTagsForEntity delegates to TaxonomyService', async () => {
    const taxonomyService = {
      getTagsForEntity: vi.fn().mockResolvedValue([
        { id: 't-1', name: 'react', groupSlug: 'skills' },
      ]),
    };
    const adapter = new TaxonomyExtensionAdapter(taxonomyService as never);

    const tags = await adapter.getTagsForEntity('candidates', 'c-1');

    expect(tags).toEqual([{ id: 't-1', name: 'react', groupSlug: 'skills' }]);
    expect(taxonomyService.getTagsForEntity).toHaveBeenCalledWith('candidates', 'c-1');
  });

  it('returns whatever the service returns (empty list)', async () => {
    const taxonomyService = {
      getTagsForEntity: vi.fn().mockResolvedValue([]),
    };
    const adapter = new TaxonomyExtensionAdapter(taxonomyService as never);

    expect(await adapter.getTagsForEntity('candidates', 'c-2')).toEqual([]);
  });
});
