import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidatesService } from '../candidates.service';

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn().mockImplementation(() => chain),
    where: vi.fn().mockImplementation(() => Promise.resolve(rows)),
  };
  return chain;
}

describe('CandidatesService.list — annotateApplicationsFor', () => {
  let entities: any;
  let database: any;
  let service: CandidatesService;

  beforeEach(() => {
    entities = { list: vi.fn() };
    database = { db: { select: vi.fn() } };
    service = new CandidatesService(entities, database, {} as any);
  });

  it('passes through unannotated when param missing', async () => {
    entities.list.mockResolvedValue({
      data: [{ id: 'c-1' }, { id: 'c-2' }],
      meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    const result = await service.list({});

    expect(database.db.select).not.toHaveBeenCalled();
    expect(result.data).toEqual([{ id: 'c-1' }, { id: 'c-2' }]);
  });

  it('strips annotateApplicationsFor before delegating to entity service', async () => {
    entities.list.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await service.list({ annotateApplicationsFor: 'jo-1', page: 2 });

    expect(entities.list).toHaveBeenCalledWith({ page: 2 }, undefined);
  });

  it('skips the join query when result is empty', async () => {
    entities.list.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await service.list({ annotateApplicationsFor: 'jo-1' });

    expect(database.db.select).not.toHaveBeenCalled();
  });

  it('annotates rows with matching __existingApplicationId, null otherwise', async () => {
    entities.list.mockResolvedValue({
      data: [
        { id: 'c-1', fullName: 'Alice' },
        { id: 'c-2', fullName: 'Bob' },
        { id: 'c-3', fullName: 'Carol' },
      ],
      meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
    });
    database.db.select.mockReturnValue(
      makeSelectChain([
        { candidateId: 'c-1', applicationId: 'app-A' },
        { candidateId: 'c-3', applicationId: 'app-C' },
      ]),
    );

    const result = await service.list({ annotateApplicationsFor: 'jo-1' });

    expect(result.data).toEqual([
      { id: 'c-1', fullName: 'Alice', __existingApplicationId: 'app-A' },
      { id: 'c-2', fullName: 'Bob', __existingApplicationId: null },
      { id: 'c-3', fullName: 'Carol', __existingApplicationId: 'app-C' },
    ]);
  });

  it('preserves the qualification → filters mapping alongside annotation', async () => {
    entities.list.mockResolvedValue({
      data: [{ id: 'c-1' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });
    database.db.select.mockReturnValue(makeSelectChain([]));

    await service.list({ annotateApplicationsFor: 'jo-1', qualification: 'phd' });

    const [passedQuery] = entities.list.mock.calls[0];
    expect(passedQuery.filters).toBeDefined();
    expect(JSON.parse(passedQuery.filters)).toEqual([
      { field: 'highestQualification', operator: 'eq', value: 'phd' },
    ]);
    expect(passedQuery.annotateApplicationsFor).toBeUndefined();
    expect(passedQuery.qualification).toBeUndefined();
  });
});
