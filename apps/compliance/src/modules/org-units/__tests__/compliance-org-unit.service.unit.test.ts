import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ComplianceOrgUnitService } from '../compliance-org-unit.service';

function makeDb(handlerCount: number): any {
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: handlerCount }]),
        }),
      }),
    },
  };
}

describe('ComplianceOrgUnitService.assertCanDelete', () => {
  let service: ComplianceOrgUnitService;

  beforeEach(() => {
    service = new ComplianceOrgUnitService(makeDb(0));
  });

  it('allows delete when no law-handler row references the unit', async () => {
    service = new ComplianceOrgUnitService(makeDb(0));
    await expect(
      (service as any).assertCanDelete('unit-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects delete with HANDLERS_REFERENCE_UNIT when a single handler references the unit', async () => {
    service = new ComplianceOrgUnitService(makeDb(1));
    try {
      await (service as any).assertCanDelete('unit-1');
      expect.fail('expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = err.getResponse();
      expect(body.code).toBe('HANDLERS_REFERENCE_UNIT');
      expect(body.count).toBe(1);
      expect(body.message).toContain('1 law handler ');
    }
  });

  it('uses plural copy when multiple handlers reference the unit', async () => {
    service = new ComplianceOrgUnitService(makeDb(3));
    try {
      await (service as any).assertCanDelete('unit-1');
      expect.fail('expected BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = err.getResponse();
      expect(body.count).toBe(3);
      expect(body.message).toContain('3 law handlers reference');
    }
  });
});
