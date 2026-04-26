import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { seedWorkflows } from '../seed-entity-fields';
import { defineEntity } from '../define-entity';
import type { WorkflowExtension } from '../extensions/workflow-extension.interface';

const tbl = pgTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('open'),
});

const config = defineEntity({
  table: tbl,
  slug: 'widgets',
  ui: { icon: 'Box' },
  fields: {
    name: { type: 'text', label: 'Name' },
    status: {
      type: 'workflow',
      label: 'Status',
      workflow: {
        slug: 'widget-status',
        initialState: 'open',
        states: [
          { name: 'open', label: 'Open' },
          { name: 'closed', label: 'Closed' },
        ],
        transitions: [{ from: 'open', to: ['closed'] }],
      },
    },
  },
});

function makeExt(overrides: Partial<WorkflowExtension> = {}): WorkflowExtension {
  return {
    getBySlug: vi.fn(),
    createDefinition: vi.fn().mockResolvedValue({ id: 'def-1' }),
    updateDefinition: vi.fn().mockResolvedValue({ id: 'def-1' }),
    createState: vi.fn().mockImplementation(async (_id, s) => ({ id: `state-${s.name}` })),
    createTransition: vi.fn().mockResolvedValue({ id: 'trn-1' }),
    resolveForTransition: vi.fn(),
    resolveAndAssign: vi.fn(),
    validateAndThrow: vi.fn(),
    preflightTransition: vi.fn(),
    recordHistory: vi.fn(),
    ...overrides,
  } as never;
}

describe('seedWorkflows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates definition + states + transitions when no row exists', async () => {
    const ext = makeExt({ getBySlug: vi.fn().mockReturnValue(undefined) });

    await seedWorkflows(config, ext);

    expect(ext.createDefinition).toHaveBeenCalledWith({
      slug: 'widget-status',
      name: 'Status Workflow',
      entityType: 'widgets',
      fieldName: 'status',
      initialState: 'open',
    });
    expect(ext.createState).toHaveBeenCalledTimes(2);
    expect(ext.createTransition).toHaveBeenCalledTimes(1);
    expect(ext.updateDefinition).not.toHaveBeenCalled();
  });

  it('resyncs entityType/fieldName/initialState/name when an existing row drifts', async () => {
    // Simulate a stale dev DB: existing row was seeded under `widgets_old`.
    const stale = {
      id: 'stale-id',
      slug: 'widget-status',
      transitions: [],
    };
    const ext = makeExt({ getBySlug: vi.fn().mockReturnValue(stale) });

    await seedWorkflows(config, ext);

    expect(ext.updateDefinition).toHaveBeenCalledWith('stale-id', {
      name: 'Status Workflow',
      entityType: 'widgets',
      fieldName: 'status',
      initialState: 'open',
    });
    expect(ext.createDefinition).not.toHaveBeenCalled();
    // States/transitions are NOT re-seeded — they are append-only today, so a
    // re-seed on every boot would duplicate rows.
    expect(ext.createState).not.toHaveBeenCalled();
    expect(ext.createTransition).not.toHaveBeenCalled();
  });

  it('skips entities without workflow fields', async () => {
    const noWorkflowConfig = defineEntity({
      table: tbl,
      slug: 'widgets',
      ui: { icon: 'Box' },
      fields: { name: { type: 'text', label: 'Name' } },
    });
    const ext = makeExt({ getBySlug: vi.fn() });

    await seedWorkflows(noWorkflowConfig, ext);

    expect(ext.getBySlug).not.toHaveBeenCalled();
    expect(ext.createDefinition).not.toHaveBeenCalled();
    expect(ext.updateDefinition).not.toHaveBeenCalled();
  });
});
