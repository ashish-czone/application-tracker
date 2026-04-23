import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceRulesController } from '../compliance-rules.controller';
import type { ComplianceRuleService } from '../compliance-rules.service';

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
    controller = new ComplianceRulesController(rules as unknown as ComplianceRuleService);
  });

  describe('previewDeprecation', () => {
    it('delegates to ComplianceRuleService.previewDeprecation', async () => {
      const result = await controller.previewDeprecation('r1');
      expect(rules.previewDeprecation).toHaveBeenCalledWith('r1');
      expect(result.inFlightFilingCount).toBe(3);
    });

    it('requires compliance_rules.update permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceRulesController.prototype.previewDeprecation,
      );
      expect(permission).toBe('compliance_rules.update');
    });
  });

  describe('deprecate', () => {
    it('forwards dto and actor to the service', async () => {
      await controller.deprecate(
        'r1',
        { alsoCancelInFlight: true, comment: 'superseded' },
        { userId: 'u1' } as never,
      );
      expect(rules.deprecate).toHaveBeenCalledWith('r1', {
        alsoCancelInFlight: true,
        actorId: 'u1',
        comment: 'superseded',
      });
    });

    it('defaults alsoCancelInFlight to undefined when omitted (service treats as false)', async () => {
      await controller.deprecate('r1', {}, { userId: 'u1' } as never);
      expect(rules.deprecate).toHaveBeenCalledWith('r1', {
        alsoCancelInFlight: undefined,
        actorId: 'u1',
        comment: undefined,
      });
    });

    it('requires compliance_rules.update permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceRulesController.prototype.deprecate,
      );
      expect(permission).toBe('compliance_rules.update');
    });
  });
});
