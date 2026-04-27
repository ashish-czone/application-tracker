import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerateComplianceFilingsAction } from '../generate-compliance-filings.action';

type Mock = ReturnType<typeof vi.fn>;

function ctxFor(ruleId: string | undefined): never {
  return {
    event: ruleId
      ? {
          entityId: ruleId,
          entityType: 'compliance-rules',
          eventName: '',
          actorId: null,
          correlationId: '',
          payload: {},
        }
      : undefined,
    resolvedUsers: {},
  } as never;
}

/**
 * The action is a thin pull-side adapter — its job is to extract a rule id
 * from the ActionContext and hand off to the generator service. Iteration
 * coverage lives in `compliance-filings-generator.service.unit.test.ts`.
 */
describe('GenerateComplianceFilingsAction (delegator)', () => {
  let generator: { generateForRule: Mock };
  let logger: { forContext: Mock; warn: Mock; log: Mock; error: Mock; debug: Mock };
  let action: GenerateComplianceFilingsAction;

  beforeEach(() => {
    generator = { generateForRule: vi.fn().mockResolvedValue({ created: 0 }) };
    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = { forContext: vi.fn().mockReturnValue(ctxLogger), ...ctxLogger };

    action = new GenerateComplianceFilingsAction(generator as never, logger as never);
  });

  it('no-ops when context has no rule id', async () => {
    await action.execute(ctxFor(undefined));
    expect(generator.generateForRule).not.toHaveBeenCalled();
  });

  it('passes the rule id from context.event.entityId to the generator', async () => {
    await action.execute(ctxFor('r1'));
    expect(generator.generateForRule).toHaveBeenCalledWith('r1');
  });
});
