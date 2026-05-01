import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceRulesController } from '../rules.controller';
import type { ComplianceRulesService } from '../rules.service';

describe('ComplianceRulesController', () => {
  let rules: {
    previewDeprecation: ReturnType<typeof vi.fn>;
    deprecate: ReturnType<typeof vi.fn>;
  };
  let controller: ComplianceRulesController;

  beforeEach(() => {
    rules = {
      previewDeprecation: vi.fn().mockResolvedValue({ ruleId: 'r1', inFlightFilingCount: 3 }),
      deprecate: vi.fn().mockResolvedValue({ ruleId: 'r1', cancelledFilingIds: [] }),
    };
    controller = new ComplianceRulesController(rules as unknown as ComplianceRulesService);
  });

  describe('previewDeprecation', () => {
    it('delegates to ComplianceRulesService.previewDeprecation with the access context', async () => {
      const accessCtx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
      const result = await controller.previewDeprecation('r1', accessCtx);
      expect(rules.previewDeprecation).toHaveBeenCalledWith('r1', accessCtx);
      expect(result.inFlightFilingCount).toBe(3);
    });

    it('requires compliance-rules.update permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceRulesController.prototype.previewDeprecation,
      );
      expect(permission).toBe('compliance-rules.update');
    });
  });

  describe('deprecate', () => {
    it('forwards dto, actor, and access context to the service', async () => {
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;
      await controller.deprecate(
        'r1',
        { alsoCancelInFlight: true, comment: 'superseded' },
        { userId: 'u1' } as never,
        accessCtx,
      );
      expect(rules.deprecate).toHaveBeenCalledWith(
        'r1',
        {
          alsoCancelInFlight: true,
          actorId: 'u1',
          comment: 'superseded',
        },
        accessCtx,
      );
    });

    it('defaults alsoCancelInFlight to undefined when omitted (service treats as false)', async () => {
      await controller.deprecate('r1', {}, { userId: 'u1' } as never, undefined);
      expect(rules.deprecate).toHaveBeenCalledWith(
        'r1',
        {
          alsoCancelInFlight: undefined,
          actorId: 'u1',
          comment: undefined,
        },
        undefined,
      );
    });

    it('requires compliance-rules.deprecate permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceRulesController.prototype.deprecate,
      );
      expect(permission).toBe('compliance-rules.deprecate');
    });
  });
});
