import { describe, it, expect, vi } from 'vitest';
import { WorkflowExtensionAdapter } from '../workflow-extension.adapter';

describe('WorkflowExtensionAdapter', () => {
  function buildAdapter() {
    const registry = {
      getBySlug: vi.fn(),
      createDefinition: vi.fn(),
      updateDefinition: vi.fn(),
      createState: vi.fn(),
      createTransition: vi.fn(),
    };
    const engine = {
      validateAndThrow: vi.fn(),
      preflightTransition: vi.fn(),
      recordHistory: vi.fn(),
    };
    const pipelineResolver = {
      resolveForTransition: vi.fn(),
      resolveAndAssign: vi.fn(),
    };
    const adapter = new WorkflowExtensionAdapter(
      registry as never,
      engine as never,
      pipelineResolver as never,
    );
    return { adapter, registry, engine, pipelineResolver };
  }

  it('getBySlug delegates to the registry', () => {
    const { adapter, registry } = buildAdapter();
    registry.getBySlug.mockReturnValue({ slug: 'lead' });
    expect(adapter.getBySlug('lead')).toEqual({ slug: 'lead' });
    expect(registry.getBySlug).toHaveBeenCalledWith('lead');
  });

  it('validateAndThrow delegates to the engine', async () => {
    const { adapter, engine } = buildAdapter();
    const params = {
      workflowSlug: 'lead',
      entityType: 'leads',
      entityId: 'id-1',
      fromState: 'new',
      toState: 'contacted',
      actorId: 'actor-1',
    };
    engine.validateAndThrow.mockResolvedValue({ ok: true });
    await adapter.validateAndThrow(params);
    expect(engine.validateAndThrow).toHaveBeenCalledWith(params);
  });

  it('preflightTransition delegates to the engine', async () => {
    const { adapter, engine } = buildAdapter();
    engine.preflightTransition.mockResolvedValue({ allowed: true });
    await adapter.preflightTransition({
      workflowSlug: 'lead',
      entityType: 'leads',
      entityId: 'id-1',
      fromState: 'new',
      toState: 'contacted',
      actorId: 'actor-1',
    });
    expect(engine.preflightTransition).toHaveBeenCalledOnce();
  });

  it('resolveForTransition delegates to the pipeline resolver', async () => {
    const { adapter, pipelineResolver } = buildAdapter();
    pipelineResolver.resolveForTransition.mockResolvedValue({ slug: 'lead' });
    await adapter.resolveForTransition('leads', 'id-1', 'status');
    expect(pipelineResolver.resolveForTransition).toHaveBeenCalledWith('leads', 'id-1', 'status');
  });

  it('recordHistory passes the transaction through', async () => {
    const { adapter, engine } = buildAdapter();
    const tx = { kind: 'tx' };
    await adapter.recordHistory({
      workflowDefinitionId: 'def-1',
      entityType: 'leads',
      entityId: 'id-1',
      fieldName: 'status',
      fromState: 'new',
      toState: 'contacted',
      transitionId: 'tr-1',
      actorId: 'actor-1',
    }, tx);
    expect(engine.recordHistory).toHaveBeenCalledWith(expect.any(Object), tx);
  });
});
