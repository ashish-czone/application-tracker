import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DomainEvent } from '@packages/events';
import { ComplianceFilingsGeneratorListener } from '../compliance-filings-generator.listener';

type Mock = ReturnType<typeof vi.fn>;

function event(name: string, entityId: string, payload: Record<string, unknown>): DomainEvent {
  return {
    eventName: name,
    entityType: name.split('.')[0]!,
    entityId,
    actorId: null,
    correlationId: '',
    occurredAt: new Date().toISOString(),
    payload,
  };
}

describe('ComplianceFilingsGeneratorListener', () => {
  let generator: { generateForRule: Mock; generateForRegistration: Mock; generateForClient: Mock };
  let logger: { forContext: Mock; warn: Mock; log: Mock; error: Mock; debug: Mock };
  let listener: ComplianceFilingsGeneratorListener;

  beforeEach(() => {
    generator = {
      generateForRule: vi.fn().mockResolvedValue({ created: 0 }),
      generateForRegistration: vi.fn().mockResolvedValue({ created: 0 }),
      generateForClient: vi.fn().mockResolvedValue({ created: 0 }),
    };
    const ctxLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    logger = { forContext: vi.fn().mockReturnValue(ctxLogger), ...ctxLogger };

    listener = new ComplianceFilingsGeneratorListener(generator as never, logger as never);
  });

  // ---------------------------------------------------------------------------
  // J3 — rule activation
  // ---------------------------------------------------------------------------

  describe('J3 rule activation', () => {
    it('triggers generateForRule when a rule is created already in active', async () => {
      await listener.handle(
        event('compliance-rules.Created', 'r1', { after: { status: 'active' } }),
      );
      expect(generator.generateForRule).toHaveBeenCalledWith('r1');
    });

    it('does not trigger when a rule is created in draft', async () => {
      await listener.handle(
        event('compliance-rules.Created', 'r1', { after: { status: 'draft' } }),
      );
      expect(generator.generateForRule).not.toHaveBeenCalled();
    });

    it('triggers when status flips draft → active', async () => {
      await listener.handle(
        event('compliance-rules.StatusChanged', 'r1', {
          fromState: 'draft',
          toState: 'active',
        }),
      );
      expect(generator.generateForRule).toHaveBeenCalledWith('r1');
    });

    it('does not trigger when status flips active → deprecated', async () => {
      await listener.handle(
        event('compliance-rules.StatusChanged', 'r1', {
          fromState: 'active',
          toState: 'deprecated',
        }),
      );
      expect(generator.generateForRule).not.toHaveBeenCalled();
    });

    it('does not trigger when toState equals fromState (no-op transition)', async () => {
      await listener.handle(
        event('compliance-rules.StatusChanged', 'r1', {
          fromState: 'active',
          toState: 'active',
        }),
      );
      expect(generator.generateForRule).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // J4 — registration created
  // ---------------------------------------------------------------------------

  describe('J4 registration created', () => {
    it('triggers generateForRegistration with clientId + lawId from after snapshot', async () => {
      await listener.handle(
        event('client-registrations.Created', 'reg1', {
          after: { clientId: 'c1', lawId: 'l1' },
        }),
      );
      expect(generator.generateForRegistration).toHaveBeenCalledWith('c1', 'l1');
    });

    it('warns and skips when clientId or lawId are missing on the snapshot', async () => {
      await listener.handle(
        event('client-registrations.Created', 'reg1', { after: { clientId: 'c1' } }),
      );
      expect(generator.generateForRegistration).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // J5 — client reactivation
  // ---------------------------------------------------------------------------

  describe('J5 client reactivation', () => {
    it('triggers generateForClient when status flips dormant → active', async () => {
      await listener.handle(
        event('clients.StatusChanged', 'c1', {
          fromState: 'dormant',
          toState: 'active',
        }),
      );
      expect(generator.generateForClient).toHaveBeenCalledWith('c1');
    });

    it('triggers when status flips onboarding → active (first activation)', async () => {
      await listener.handle(
        event('clients.StatusChanged', 'c1', {
          fromState: 'onboarding',
          toState: 'active',
        }),
      );
      expect(generator.generateForClient).toHaveBeenCalledWith('c1');
    });

    it('does not trigger when status flips active → dormant', async () => {
      await listener.handle(
        event('clients.StatusChanged', 'c1', {
          fromState: 'active',
          toState: 'dormant',
        }),
      );
      expect(generator.generateForClient).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Routing — unrelated events are ignored, errors are swallowed and logged.
  // ---------------------------------------------------------------------------

  describe('routing', () => {
    it('ignores unrelated events', async () => {
      await listener.handle(event('something-else.Updated', 'x', { foo: 1 }));
      expect(generator.generateForRule).not.toHaveBeenCalled();
      expect(generator.generateForRegistration).not.toHaveBeenCalled();
      expect(generator.generateForClient).not.toHaveBeenCalled();
    });

    it('swallows generator errors so one bad event does not poison the listener', async () => {
      generator.generateForRule.mockRejectedValueOnce(new Error('boom'));
      await listener.handle(
        event('compliance-rules.StatusChanged', 'r1', {
          fromState: 'draft',
          toState: 'active',
        }),
      );
      // No re-throw — listener logs and moves on.
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
