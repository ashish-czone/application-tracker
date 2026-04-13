import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PipelineResolverService } from '../pipeline-resolver.service';
import type { CachedWorkflowDefinition } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table, ...conditions) => conditions[0]),
  withTenantInsert: vi.fn((_table, data) => data),
}));

function createMockDb() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  return { db: chain, _chain: chain };
}

const mockRegistry = {
  getBySlug: vi.fn(),
  getAllForField: vi.fn().mockReturnValue([]),
  getDefaultForField: vi.fn(),
  getByDiscriminator: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
};

function makePipeline(overrides: Partial<CachedWorkflowDefinition> = {}): CachedWorkflowDefinition {
  return {
    id: 'def-1',
    slug: 'pipeline-a',
    name: 'Pipeline A',
    entityType: 'candidate',
    fieldName: 'status',
    initialState: 'new',
    isActive: true,
    discriminatorKey: null,
    discriminatorValue: null,
    isDefault: true,
    states: [],
    transitions: [],
    ...overrides,
  };
}

describe('PipelineResolverService', () => {
  let service: PipelineResolverService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new PipelineResolverService(
      mockDb as any,
      mockRegistry as any,
    );
  });

  describe('getAssignment', () => {
    it('should return undefined when no assignment row exists', async () => {
      mockDb._chain.limit.mockResolvedValue([]);

      const result = await service.getAssignment('candidate', 'c-1', 'status');

      expect(result).toBeUndefined();
      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockRegistry.getBySlug).not.toHaveBeenCalled();
    });

    it('should look up definition by slug when assignment row exists', async () => {
      const pipeline = makePipeline();
      mockDb._chain.limit.mockResolvedValue([{ workflowDefinitionId: 'def-1' }]);
      mockRegistry.getAll.mockReturnValue([pipeline]);
      mockRegistry.getBySlug.mockReturnValue(pipeline);

      const result = await service.getAssignment('candidate', 'c-1', 'status');

      expect(mockRegistry.getBySlug).toHaveBeenCalledWith('pipeline-a');
      expect(result).toEqual(pipeline);
    });

    it('should return undefined from getBySlug when slug lookup fails', async () => {
      mockDb._chain.limit.mockResolvedValue([{ workflowDefinitionId: 'unknown-def' }]);
      mockRegistry.getAll.mockReturnValue([]);
      mockRegistry.getBySlug.mockReturnValue(undefined);

      const result = await service.getAssignment('candidate', 'c-1', 'status');

      expect(mockRegistry.getBySlug).toHaveBeenCalledWith('');
      expect(result).toBeUndefined();
    });
  });

  describe('resolveAndAssign', () => {
    it('should return single pipeline without creating assignment', async () => {
      const pipeline = makePipeline();
      mockRegistry.getAllForField.mockReturnValue([pipeline]);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status');

      expect(result).toEqual(pipeline);
      expect(mockDb._chain.insert).not.toHaveBeenCalled();
    });

    it('should return undefined when no pipelines exist for field', async () => {
      mockRegistry.getAllForField.mockReturnValue([]);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status');

      expect(result).toBeUndefined();
      expect(mockDb._chain.insert).not.toHaveBeenCalled();
    });

    it('should resolve by discriminator when multiple pipelines exist', async () => {
      const pipelineA = makePipeline({ id: 'def-1', slug: 'pipeline-a', discriminatorValue: 'internal' });
      const pipelineB = makePipeline({ id: 'def-2', slug: 'pipeline-b', discriminatorValue: 'external', isDefault: false });
      mockRegistry.getAllForField.mockReturnValue([pipelineA, pipelineB]);
      mockRegistry.getByDiscriminator.mockReturnValue(pipelineB);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status', 'external');

      expect(mockRegistry.getByDiscriminator).toHaveBeenCalledWith('candidate', 'status', 'external');
      expect(result).toEqual(pipelineB);
      expect(mockDb._chain.insert).toHaveBeenCalled();
    });

    it('should fall back to default when discriminator does not match', async () => {
      const pipelineA = makePipeline({ id: 'def-1', slug: 'pipeline-a', isDefault: true });
      const pipelineB = makePipeline({ id: 'def-2', slug: 'pipeline-b', isDefault: false });
      mockRegistry.getAllForField.mockReturnValue([pipelineA, pipelineB]);
      mockRegistry.getByDiscriminator.mockReturnValue(undefined);
      mockRegistry.getDefaultForField.mockReturnValue(pipelineA);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status', 'nonexistent');

      expect(mockRegistry.getByDiscriminator).toHaveBeenCalledWith('candidate', 'status', 'nonexistent');
      expect(mockRegistry.getDefaultForField).toHaveBeenCalledWith('candidate', 'status');
      expect(result).toEqual(pipelineA);
      expect(mockDb._chain.insert).toHaveBeenCalled();
    });

    it('should fall back to default when no discriminator value provided', async () => {
      const pipelineA = makePipeline({ id: 'def-1', isDefault: true });
      const pipelineB = makePipeline({ id: 'def-2', isDefault: false });
      mockRegistry.getAllForField.mockReturnValue([pipelineA, pipelineB]);
      mockRegistry.getDefaultForField.mockReturnValue(pipelineA);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status');

      expect(mockRegistry.getByDiscriminator).not.toHaveBeenCalled();
      expect(mockRegistry.getDefaultForField).toHaveBeenCalledWith('candidate', 'status');
      expect(result).toEqual(pipelineA);
    });

    it('should return undefined when multiple pipelines exist but none match and no default', async () => {
      const pipelineA = makePipeline({ id: 'def-1' });
      const pipelineB = makePipeline({ id: 'def-2' });
      mockRegistry.getAllForField.mockReturnValue([pipelineA, pipelineB]);
      mockRegistry.getByDiscriminator.mockReturnValue(undefined);
      mockRegistry.getDefaultForField.mockReturnValue(undefined);

      const result = await service.resolveAndAssign('candidate', 'c-1', 'status', 'nonexistent');

      expect(result).toBeUndefined();
      expect(mockDb._chain.insert).not.toHaveBeenCalled();
    });

    it('should store assignment with correct data when pipeline is resolved', async () => {
      const pipelineA = makePipeline({ id: 'def-1' });
      const pipelineB = makePipeline({ id: 'def-2', discriminatorValue: 'contract' });
      mockRegistry.getAllForField.mockReturnValue([pipelineA, pipelineB]);
      mockRegistry.getByDiscriminator.mockReturnValue(pipelineB);

      await service.resolveAndAssign('candidate', 'c-1', 'status', 'contract');

      expect(mockDb._chain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'candidate',
          entityId: 'c-1',
          fieldName: 'status',
          workflowDefinitionId: 'def-2',
        }),
      );
      expect(mockDb._chain.onConflictDoNothing).toHaveBeenCalled();
    });
  });

  describe('resolveForTransition', () => {
    it('should return assigned pipeline if assignment exists', async () => {
      const pipeline = makePipeline();
      mockDb._chain.limit.mockResolvedValue([{ workflowDefinitionId: 'def-1' }]);
      mockRegistry.getAll.mockReturnValue([pipeline]);
      mockRegistry.getBySlug.mockReturnValue(pipeline);

      const result = await service.resolveForTransition('candidate', 'c-1', 'status');

      expect(result).toEqual(pipeline);
      expect(mockRegistry.getDefaultForField).not.toHaveBeenCalled();
    });

    it('should fall back to default when no assignment exists', async () => {
      const pipeline = makePipeline();
      mockDb._chain.limit.mockResolvedValue([]);
      mockRegistry.getDefaultForField.mockReturnValue(pipeline);

      const result = await service.resolveForTransition('candidate', 'c-1', 'status');

      expect(mockRegistry.getDefaultForField).toHaveBeenCalledWith('candidate', 'status');
      expect(result).toEqual(pipeline);
    });

    it('should return undefined when no assignment and no default pipeline', async () => {
      mockDb._chain.limit.mockResolvedValue([]);
      mockRegistry.getDefaultForField.mockReturnValue(undefined);

      const result = await service.resolveForTransition('candidate', 'c-1', 'status');

      expect(result).toBeUndefined();
    });
  });
});
