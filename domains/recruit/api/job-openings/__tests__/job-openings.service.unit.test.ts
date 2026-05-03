import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobOpeningsService } from '../job-openings.service';

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn().mockImplementation(() => chain),
    where: vi.fn().mockImplementation(() => Promise.resolve(rows)),
  };
  return chain;
}

describe('JobOpeningsService.list — annotateApplicationsFor', () => {
  let entities: any;
  let database: any;
  let service: JobOpeningsService;

  beforeEach(() => {
    entities = { list: vi.fn() };
    database = { db: { select: vi.fn() } };
    service = new JobOpeningsService(entities, database, {} as any, {} as any);
  });

  it('passes through unannotated when param missing', async () => {
    entities.list.mockResolvedValue({
      data: [{ id: 'jo-1' }, { id: 'jo-2' }],
      meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    const result = await service.list({});

    expect(database.db.select).not.toHaveBeenCalled();
    expect(result.data).toEqual([{ id: 'jo-1' }, { id: 'jo-2' }]);
  });

  it('strips annotateApplicationsFor before delegating to entity service', async () => {
    entities.list.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await service.list({ annotateApplicationsFor: 'cand-1', page: 2 });

    expect(entities.list).toHaveBeenCalledWith({ page: 2 }, undefined);
  });

  it('skips the join query when result is empty', async () => {
    entities.list.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await service.list({ annotateApplicationsFor: 'cand-1' });

    expect(database.db.select).not.toHaveBeenCalled();
  });

  it('annotates rows with matching __existingApplicationId, null otherwise', async () => {
    entities.list.mockResolvedValue({
      data: [
        { id: 'jo-1', title: 'Engineer' },
        { id: 'jo-2', title: 'Designer' },
        { id: 'jo-3', title: 'PM' },
      ],
      meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
    });
    database.db.select.mockReturnValue(
      makeSelectChain([
        { jobOpeningId: 'jo-1', applicationId: 'app-A' },
        { jobOpeningId: 'jo-3', applicationId: 'app-C' },
      ]),
    );

    const result = await service.list({ annotateApplicationsFor: 'cand-1' });

    expect(result.data).toEqual([
      { id: 'jo-1', title: 'Engineer', __existingApplicationId: 'app-A' },
      { id: 'jo-2', title: 'Designer', __existingApplicationId: null },
      { id: 'jo-3', title: 'PM', __existingApplicationId: 'app-C' },
    ]);
  });

  it('preserves pagination meta in the annotated response', async () => {
    entities.list.mockResolvedValue({
      data: [{ id: 'jo-1' }],
      meta: { total: 42, page: 3, limit: 10, totalPages: 5 },
    });
    database.db.select.mockReturnValue(makeSelectChain([]));

    const result = await service.list({ annotateApplicationsFor: 'cand-1' });

    expect(result.meta).toEqual({ total: 42, page: 3, limit: 10, totalPages: 5 });
  });
});
