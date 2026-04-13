import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksSeedService, TASK_TAGS_GROUP_SLUG, DEFAULT_TASK_TAGS } from '../tasks-seed.service';

function createMockDb(existingGroup: unknown[] = []) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(existingGroup),
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(selectChain),
    },
    _selectChain: selectChain,
  };
}

function createMockTaxonomy() {
  return {
    createTagGroup: vi.fn().mockResolvedValue({ id: 'group-1', slug: TASK_TAGS_GROUP_SLUG }),
    createTag: vi.fn().mockResolvedValue({ id: 'tag-1' }),
  };
}

function createMockLogger() {
  return {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
}

describe('TasksSeedService', () => {
  let database: ReturnType<typeof createMockDb>;
  let taxonomy: ReturnType<typeof createMockTaxonomy>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    database = createMockDb();
    taxonomy = createMockTaxonomy();
    logger = createMockLogger();
  });

  function makeService(db = database) {
    return new TasksSeedService(
      db as never,
      taxonomy as never,
      logger as never,
    );
  }

  it('creates task-tags group and all default tags on first bootstrap', async () => {
    const service = makeService();

    await service.onApplicationBootstrap();

    expect(taxonomy.createTagGroup).toHaveBeenCalledTimes(1);
    expect(taxonomy.createTagGroup).toHaveBeenCalledWith({
      name: 'Task Tags',
      slug: TASK_TAGS_GROUP_SLUG,
      description: expect.any(String),
      allowMultiple: true,
    });
    expect(taxonomy.createTag).toHaveBeenCalledTimes(DEFAULT_TASK_TAGS.length);
    for (const tag of DEFAULT_TASK_TAGS) {
      expect(taxonomy.createTag).toHaveBeenCalledWith({
        tagGroupId: 'group-1',
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
      });
    }
  });

  it('is idempotent — skips creation when task-tags group already exists', async () => {
    const existing = createMockDb([{ id: 'group-1', slug: TASK_TAGS_GROUP_SLUG }]);
    const service = makeService(existing);

    await service.onApplicationBootstrap();

    expect(taxonomy.createTagGroup).not.toHaveBeenCalled();
    expect(taxonomy.createTag).not.toHaveBeenCalled();
  });

  it('seeds exactly 8 default task tags', () => {
    expect(DEFAULT_TASK_TAGS).toHaveLength(8);
    const slugs = DEFAULT_TASK_TAGS.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
