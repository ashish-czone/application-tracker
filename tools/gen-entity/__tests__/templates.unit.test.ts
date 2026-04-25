import { describe, it, expect } from 'vitest';
import { serviceTemplate, controllerTemplate } from '../templates';
import type { GeneratorContext } from '../generator';

function ctx(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    entitySlug: 'things',
    domain: 'demo',
    targetDir: '/tmp',
    singularPascal: 'Thing',
    pluralPascal: 'Things',
    pluralUpper: 'THINGS',
    tableIdent: 'things',
    configIdent: 'thingsConfig',
    tagFields: [],
    multiValueFields: [],
    workflowFields: [],
    ...overrides,
  };
}

describe('serviceTemplate', () => {
  it('omits guards block and methods when no workflow fields', () => {
    const out = serviceTemplate(ctx());
    expect(out).not.toContain('THINGS_GUARDS');
    expect(out).not.toContain('runTransitionGuards');
    expect(out).not.toContain('previewTransitionGuards');
    expect(out).not.toContain('transition(');
    expect(out).not.toContain('previewTransition(');
  });

  it('scaffolds GUARDS array, transition + previewTransition when workflow field present', () => {
    const out = serviceTemplate(
      ctx({ workflowFields: [{ key: 'status', workflowSlug: 'thing-status' }] }),
    );

    expect(out).toContain(`import { runTransitionGuards, previewTransitionGuards, type TransitionGuard } from '@packages/workflows';`);
    expect(out).toContain('interface ThingGuardDeps');
    expect(out).toContain('const THINGS_GUARDS: TransitionGuard<ThingRow, ThingGuardDeps>[] = [');
    expect(out).toContain(`if (fieldKey === 'status')`);
    expect(out).toContain('async transition(');
    expect(out).toContain('async previewTransition(');
    expect(out).toContain('runTransitionGuards(THINGS_GUARDS,');
    expect(out).toContain('previewTransitionGuards(THINGS_GUARDS,');
  });
});

describe('controllerTemplate', () => {
  it('omits transition routes when no workflow fields', () => {
    const out = controllerTemplate(ctx());
    expect(out).not.toContain(':id/transition');
    expect(out).not.toContain('transition-preview');
    expect(out).not.toContain('BadRequestException');
  });

  it('adds transition + transition-preview routes when workflow field present', () => {
    const out = controllerTemplate(
      ctx({ workflowFields: [{ key: 'status', workflowSlug: 'thing-status' }] }),
    );

    expect(out).toContain('BadRequestException');
    expect(out).toContain(`@Post(':id/transition')`);
    expect(out).toContain(`@Get(':id/transition-preview')`);
    expect(out).toContain('this.things.transition(');
    expect(out).toContain('this.things.previewTransition(');
  });
});
