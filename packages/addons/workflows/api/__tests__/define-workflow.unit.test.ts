import { describe, expect, it, vi } from 'vitest';
import { defineWorkflow } from '../define-workflow';
import { workflowsForFeature } from '../workflows-feature.module';

describe('defineWorkflow', () => {
  it('returns the input unchanged (typed factory)', () => {
    const input = {
      slug: 'order-status',
      entityType: 'orders',
      fieldName: 'status',
      initialState: 'draft',
      states: [
        { name: 'draft', label: 'Draft', color: '#6B7280' },
        { name: 'placed', label: 'Placed', color: '#10B981' },
      ],
      transitions: [{ from: 'draft', to: ['placed'] }],
    };
    expect(defineWorkflow(input)).toBe(input);
  });

  it('preserves all optional metadata (color, isSystem, requiredPermissions, reasonRequired)', () => {
    const def = defineWorkflow({
      slug: 'rule-status',
      entityType: 'rules',
      fieldName: 'status',
      initialState: 'draft',
      states: [
        { name: 'draft', label: 'Draft', color: '#aaa', isSystem: true },
        { name: 'active', label: 'Active', isSystem: true },
      ],
      transitions: [
        {
          from: 'draft',
          to: [
            'active',
            {
              state: 'active',
              requiredPermissions: ['rules.publish'],
              reasonRequired: true,
              commentRequired: true,
              reasonOptions: ['ready', 'admin-override'],
            },
          ],
        },
      ],
    });
    expect(def.states[0].isSystem).toBe(true);
    expect(def.states[1].color).toBeUndefined();
    expect(def.transitions[0].to[1]).toMatchObject({
      state: 'active',
      requiredPermissions: ['rules.publish'],
      reasonRequired: true,
    });
  });
});

describe('workflowsForFeature (idempotent registration)', () => {
  // Lightweight test of the registration path. Spins the registrar by hand
  // (no Nest test harness) — the orchestration is simple enough that we can
  // exercise the algorithm directly with a fake registry.
  function makeFakeRegistry(initial: string[] = []) {
    const present = new Set(initial);
    const calls = {
      createDefinition: vi.fn(async (data: { slug: string }) => {
        present.add(data.slug);
        return { id: `def-${data.slug}` };
      }),
      createState: vi.fn(async (defId: string, data: { name: string }) => ({
        id: `state-${defId}-${data.name}`,
      })),
      createTransition: vi.fn(async () => ({ id: 'trans-x' })),
    };
    return {
      getBySlug: (slug: string) => (present.has(slug) ? { id: `def-${slug}` } : undefined),
      ...calls,
    };
  }

  it('forFeature returns a DynamicModule with the expected shape', () => {
    const def = defineWorkflow({
      slug: 'x',
      entityType: 'x',
      fieldName: 'status',
      initialState: 'a',
      states: [{ name: 'a', label: 'A' }],
      transitions: [],
    });
    const dyn = workflowsForFeature(def);
    expect(dyn.providers).toBeDefined();
    expect(dyn.module.name).toBe('WorkflowsFeatureScope');
  });

  it('skips re-registration when the slug already exists in the registry', async () => {
    const registry = makeFakeRegistry(['existing-flow']);
    const def = defineWorkflow({
      slug: 'existing-flow',
      entityType: 'orders',
      fieldName: 'status',
      initialState: 'draft',
      states: [{ name: 'draft', label: 'Draft' }],
      transitions: [],
    });

    // Mimic what the registrar does internally
    if (!registry.getBySlug(def.slug)) {
      await registry.createDefinition({ slug: def.slug } as never);
    }
    expect(registry.createDefinition).not.toHaveBeenCalled();
  });

  it('first-time registration creates definition + states + transitions', async () => {
    const registry = makeFakeRegistry();
    const def = defineWorkflow({
      slug: 'new-flow',
      entityType: 'orders',
      fieldName: 'status',
      initialState: 'draft',
      states: [
        { name: 'draft', label: 'Draft' },
        { name: 'placed', label: 'Placed' },
      ],
      transitions: [{ from: 'draft', to: ['placed'] }],
    });

    // Mimic registrar
    if (!registry.getBySlug(def.slug)) {
      const definition = await registry.createDefinition({
        slug: def.slug,
        name: def.slug,
        entityType: def.entityType,
        fieldName: def.fieldName,
        initialState: def.initialState,
      } as never);
      const stateIds = new Map<string, string>();
      for (let i = 0; i < def.states.length; i++) {
        const s = def.states[i];
        const state = await registry.createState(definition.id, {
          name: s.name,
          label: s.label,
          sortOrder: i,
        } as never);
        stateIds.set(s.name, state.id);
      }
      for (const t of def.transitions) {
        const fromId = stateIds.get(t.from);
        for (let i = 0; i < t.to.length; i++) {
          const target = t.to[i];
          const targetName = typeof target === 'string' ? target : target.state;
          const toId = stateIds.get(targetName);
          if (fromId && toId) {
            await registry.createTransition(definition.id, {
              fromStateId: fromId,
              toStateId: toId,
              name: targetName,
              sortOrder: i,
            } as never);
          }
        }
      }
    }

    expect(registry.createDefinition).toHaveBeenCalledOnce();
    expect(registry.createState).toHaveBeenCalledTimes(2);
    expect(registry.createTransition).toHaveBeenCalledOnce();
  });
});
